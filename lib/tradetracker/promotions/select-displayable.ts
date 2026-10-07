import { DISPLAYABLE_CAMPAIGN_NEWS_TYPES } from './constants';
import { resolveConnectedProvider } from './connected-providers';
import { cleanFactText, extractPromotionFacts, type PromotionFacts } from './promotion-facts';
import type {
  TradeTrackerCampaignNewsRecord,
  TradeTrackerIncentiveRecord,
  TradeTrackerPromotionSnapshot,
} from './types';

export type DisplayablePromotionKind =
  | 'consumer_promotion'
  | 'vouchercode_update'
  | 'incentive_update'
  | 'incentive_offer'
  | 'voucher';

export type DisplayablePromotion = {
  id: string;
  kind: DisplayablePromotionKind;
  providerName: string;
  title: string;
  summary: string;
  campaignUrl: string | null;
  publishDate: string | null;
  expirationDate: string | null;
  /** Native TradeTracker identity, scoped to its affiliate site. */
  nativeKey: string;
  /**
   * Conservative cross-site identity built from complete source content.
   * Null means that required content was absent, so the record is not merged
   * with a superficially similar promotion.
   */
  contentKey: string | null;
  affiliateContexts: PromotionAffiliateContext[];
  applicableDomains: string[];
  /**
   * Native TradeTracker item identity that is global across affiliate sites.
   * Proven for campaign news (audit 2026-10-04: the same newsItemId with identical
   * content is returned for the BE and the NL affiliate site). Null for record
   * types where cross-site identity is not proven.
   */
  sourceKey: string | null;
  /** Verbatim labelled facts from the source text (Actie, Periode, Voorwaarden). */
  facts: PromotionFacts;
  voucherCode: string | null;
  /**
   * Official campaign image supplied by TradeTracker (getCampaigns info.imageURL),
   * joined on campaignId. This is the provider's own campaign visual (a logo), never a
   * promotion-specific image. Null when TradeTracker supplies none.
   */
  providerLogoUrl?: string | null;
};

export type PromotionAffiliateContext = {
  affiliateSiteId: string;
  campaignUrl: string | null;
  domain: string | null;
};

const DISPLAYABLE_NEWS = new Set<string>(DISPLAYABLE_CAMPAIGN_NEWS_TYPES);
const SUMMARY_MAX_CHARS = 180;

function newsKind(newsType: string): DisplayablePromotionKind | null {
  if (newsType === 'campaign_update_consumer') return 'consumer_promotion';
  if (newsType === 'campaign_update_vouchercode') return 'vouchercode_update';
  if (newsType === 'campaign_update_incentive') return 'incentive_update';
  return null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function summarize(value: string, maxChars = SUMMARY_MAX_CHARS): string {
  const clean = stripHtml(value);
  if (clean.length <= maxChars) {
    return clean;
  }
  const cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > Math.floor(maxChars * 0.5) ? cut.slice(0, lastSpace) : cut;
  return `${base.trim()}…`;
}

function compactSummary(value: string): string {
  const clean = stripHtml(value);
  if (!clean) {
    return '';
  }
  const sentence = clean.match(/^(.+?[.!?])(?:\s|$)/)?.[1] ?? clean;
  return summarize(sentence, 140);
}

function normalizedText(value: string): string {
  return stripHtml(value).normalize('NFKC').toLocaleLowerCase('nl').replace(/\s+/g, ' ').trim();
}

function landingPath(value: string): string | null {
  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';
    // The host is intentionally omitted: the same action can have a .be and
    // .nl landing page. Path and query remain, so distinct landing pages stay
    // distinct.
    return `${pathname}${url.search}`;
  } catch {
    return null;
  }
}

function domainForUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).hostname.replace(/^www\./i, '').toLocaleLowerCase('nl');
  } catch {
    return null;
  }
}

function normalizedContentWithLinks(value: string): string {
  const linkPaths = [...value.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)]
    .map((match) => landingPath(match[1]!))
    .filter((path): path is string => path !== null)
    .sort();
  return `${normalizedText(value)}|links:${linkPaths.join(',')}`;
}

function contextFor(affiliateSiteId: string, campaignUrl: string | null): PromotionAffiliateContext {
  return { affiliateSiteId, campaignUrl, domain: domainForUrl(campaignUrl) };
}

function domainsFor(contexts: readonly PromotionAffiliateContext[]): string[] {
  return [...new Set(contexts.flatMap((context) => (context.domain ? [context.domain] : [])))].sort(
    (a, b) => a.localeCompare(b, 'nl'),
  );
}

function cleanTitle(rawTitle: string, providerName: string): string {
  let title = stripHtml(rawTitle);
  const escaped = providerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Country suffixes are market context, not a distinct promotion title.
  title = title.replace(new RegExp(`^${escaped}\\s+[a-z]{2}\\s*`, 'i'), `${providerName} `);
  title = title
    .replace(
      new RegExp(`^${escaped}(?:\\s+(?:nl|be|com|benelux|was here))?\\s*[-–:—|]\\s*`, 'i'),
      '',
    )
    .trim();
  if (!title) {
    return `Actie bij ${providerName}`;
  }
  if (title.length > 90) {
    return summarize(title, 90);
  }
  return title;
}

function fromNews(
  item: TradeTrackerCampaignNewsRecord,
  affiliateSiteId: string,
): DisplayablePromotion | null {
  if (!item.validity.isActive) {
    return null;
  }
  if (!DISPLAYABLE_NEWS.has(item.newsType)) {
    return null;
  }
  const kind = newsKind(item.newsType);
  if (!kind) {
    return null;
  }

  const providerName = resolveConnectedProvider({
    campaignId: item.campaignId,
    campaignName: item.campaignName,
  });
  if (!providerName) {
    return null;
  }

  const title = cleanTitle(item.title || item.campaignName || '', providerName);
  const summary = compactSummary(item.content || item.title || '');
  if (!summary && !title) {
    return null;
  }

  const context = contextFor(affiliateSiteId, item.campaignUrl);
  // Do not merge incomplete records merely because their visible title agrees.
  const contentKey =
    item.title && item.content && item.campaignUrl
      ? [
          'news',
          providerName.toLocaleLowerCase('nl'),
          item.newsType,
          normalizedText(cleanTitle(item.title, providerName)),
          normalizedContentWithLinks(item.content),
          item.publishDate ?? '',
          item.expirationDate ?? '',
          landingPath(item.campaignUrl) ?? '',
        ].join('|')
      : null;

  return {
    id: `${affiliateSiteId}:news:${item.newsItemId}`,
    kind,
    providerName,
    title,
    summary: summary || title,
    campaignUrl: item.campaignUrl,
    publishDate: item.publishDate,
    expirationDate: item.expirationDate,
    nativeKey: `${affiliateSiteId}|news|${item.newsItemId}`,
    contentKey,
    sourceKey: `news|${item.newsItemId}`,
    facts: extractPromotionFacts(item.content),
    voucherCode: null,
    affiliateContexts: [context],
    applicableDomains: domainsFor([context]),
  };
}

function incentiveFacts(item: TradeTrackerIncentiveRecord): PromotionFacts {
  const facts = extractPromotionFacts([item.description, item.conditions].filter(Boolean).join('\n'));
  return { ...facts, conditions: facts.conditions ?? cleanFactText(item.conditions, 280) };
}

function fromIncentive(
  item: TradeTrackerIncentiveRecord,
  affiliateSiteId: string,
): DisplayablePromotion | null {
  if (!item.validity.isActive) {
    return null;
  }

  const providerName = resolveConnectedProvider({
    campaignId: item.campaignId,
    campaignName: item.campaignName,
  });
  if (!providerName) {
    return null;
  }

  const title = cleanTitle(item.name, providerName);
  const fullSummary =
    [item.description, item.conditions].filter(Boolean).join(' ') || item.name;
  const summary = compactSummary(fullSummary);
  const context = contextFor(affiliateSiteId, item.campaignUrl);
  // Conditions and landing URL are material for a voucher/incentive. If either
  // is absent, retain the record instead of guessing that it equals another.
  const contentKey =
    item.name && item.description && item.conditions && item.campaignUrl
      ? [
          item.kind,
          providerName.toLocaleLowerCase('nl'),
          normalizedText(cleanTitle(item.name, providerName)),
          normalizedContentWithLinks(item.description),
          normalizedContentWithLinks(item.conditions),
          item.voucherCode?.normalize('NFKC').toLocaleUpperCase('nl') ?? '',
          item.discountFixed ?? '',
          item.discountVariable ?? '',
          item.validFromDate ?? '',
          item.validToDate ?? '',
          landingPath(item.campaignUrl) ?? '',
        ].join('|')
      : null;

  return {
    id: `${affiliateSiteId}:${item.kind}:${item.materialItemId}`,
    kind: item.kind,
    providerName,
    title,
    summary,
    campaignUrl: item.campaignUrl,
    publishDate: item.validFromDate,
    expirationDate: item.validToDate,
    nativeKey: `${affiliateSiteId}|${item.kind}|${item.materialItemId}`,
    contentKey,
    sourceKey: null,
    facts: incentiveFacts(item),
    voucherCode: item.voucherCode,
    affiliateContexts: [context],
    applicableDomains: domainsFor([context]),
  };
}

function mergeContexts(
  left: readonly PromotionAffiliateContext[],
  right: readonly PromotionAffiliateContext[],
): PromotionAffiliateContext[] {
  const seen = new Set<string>();
  return [...left, ...right].filter((context) => {
    const key = `${context.affiliateSiteId}|${context.campaignUrl ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function withMergedContexts(
  promotion: DisplayablePromotion,
  duplicate: DisplayablePromotion,
): DisplayablePromotion {
  const affiliateContexts = mergeContexts(promotion.affiliateContexts, duplicate.affiliateContexts);
  return { ...promotion, affiliateContexts, applicableDomains: domainsFor(affiliateContexts) };
}

function sortPromotions(promotions: DisplayablePromotion[]): DisplayablePromotion[] {
  return promotions.sort((a, b) => {
    const providerCmp = a.providerName.localeCompare(b.providerName, 'nl');
    if (providerCmp !== 0) {
      return providerCmp;
    }
    const aDate = a.publishDate ?? '';
    const bDate = b.publishDate ?? '';
    if (aDate !== bDate) {
      return bDate.localeCompare(aDate);
    }
    return a.title.localeCompare(b.title, 'nl');
  });
}

/**
 * Merge only proven duplicates. Native IDs dedupe a repeated source record on
 * one site; full-content keys dedupe the same promotion across any number of
 * affiliate sites. Records without a full-content key intentionally survive.
 */
export function dedupeDisplayablePromotions(
  promotions: readonly DisplayablePromotion[],
): DisplayablePromotion[] {
  const nativeSeen = new Set<string>();
  const contentIndex = new Map<string, number>();
  const sourceIndex = new Map<string, number>();
  const out: DisplayablePromotion[] = [];

  for (const promotion of promotions) {
    if (nativeSeen.has(promotion.nativeKey)) {
      continue;
    }
    nativeSeen.add(promotion.nativeKey);

    if (promotion.sourceKey) {
      const priorSource = sourceIndex.get(promotion.sourceKey);
      if (priorSource !== undefined) {
        out[priorSource] = withMergedContexts(out[priorSource]!, promotion);
        continue;
      }
    }

    if (promotion.contentKey) {
      const priorIndex = contentIndex.get(promotion.contentKey);
      if (priorIndex !== undefined) {
        out[priorIndex] = withMergedContexts(out[priorIndex]!, promotion);
        continue;
      }
      contentIndex.set(promotion.contentKey, out.length);
    }
    if (promotion.sourceKey) {
      sourceIndex.set(promotion.sourceKey, out.length);
    }
    out.push(promotion);
  }

  return sortPromotions(out);
}

/**
 * Select active TradeTracker promotions that belong to connected VacationWeb travel providers.
 * Does not invent deals from catalog/prices. Unrelated TT advertisers are excluded.
 */
export function selectDisplayablePromotions(
  snapshot: TradeTrackerPromotionSnapshot,
  affiliateSiteId = snapshot.scopedAffiliateSiteId,
): DisplayablePromotion[] {
  const out: DisplayablePromotion[] = [];
  const logoByCampaign = new Map<string, string>();
  for (const campaign of snapshot.campaigns) {
    if (campaign.logoUrl) {
      logoByCampaign.set(campaign.campaignId, campaign.logoUrl);
    }
  }
  const withLogo = (promotion: DisplayablePromotion, campaignId: string | null): DisplayablePromotion => ({
    ...promotion,
    providerLogoUrl: campaignId ? (logoByCampaign.get(campaignId) ?? null) : null,
  });

  for (const item of snapshot.newsItems) {
    const selected = fromNews(item, affiliateSiteId);
    if (selected) {
      out.push(withLogo(selected, item.campaignId));
    }
  }
  for (const item of snapshot.incentiveOffers) {
    const selected = fromIncentive(item, affiliateSiteId);
    if (selected) {
      out.push(withLogo(selected, item.campaignId));
    }
  }
  for (const item of snapshot.vouchers) {
    const selected = fromIncentive(item, affiliateSiteId);
    if (selected) {
      out.push(withLogo(selected, item.campaignId));
    }
  }

  return sortPromotions(out);
}
