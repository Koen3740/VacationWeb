import { DISPLAYABLE_CAMPAIGN_NEWS_TYPES } from './constants';
import { resolveConnectedProvider } from './connected-providers';
import { isDisplayableOffer, mentionsKaching } from './displayable-offer';
import type {
  TradeTrackerCampaignNewsRecord,
  TradeTrackerIncentiveRecord,
  TradeTrackerPromotionSnapshot,
} from './types';

export type VacationWebPromotionMarket = 'be' | 'nl';

export type DisplayablePromotionKind =
  | 'consumer_promotion'
  | 'vouchercode_update'
  | 'incentive_update'
  | 'incentive_offer'
  | 'voucher';

export type DisplayablePromotion = {
  id: string;
  kind: DisplayablePromotionKind;
  market: VacationWebPromotionMarket;
  providerName: string;
  title: string;
  summary: string;
  campaignUrl: string | null;
  publishDate: string | null;
  expirationDate: string | null;
  /** Unsummarized source copy used to re-check the concrete-benefit rule. */
  sourceText?: string | null;
  discountFixed?: string | null;
  discountVariable?: string | null;
  voucherCode?: string | null;
  conditions?: string | null;
  /** Promotion snapshot ingest time. Not an offer start date. */
  ingestedAt?: string | null;
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

function cleanTitle(rawTitle: string, providerName: string): string {
  let title = stripHtml(rawTitle);
  const escaped = providerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  market: VacationWebPromotionMarket,
): DisplayablePromotion | null {
  if (!item.validity.isActive) {
    return null;
  }
  if (!DISPLAYABLE_NEWS.has(item.newsType)) {
    return null;
  }
  if (mentionsKaching([item.title, item.content, item.campaignName])) {
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

  if (!isDisplayableOffer({ title: item.title, description: item.content })) {
    return null;
  }

  const title = cleanTitle(item.title || item.campaignName || '', providerName);
  const summary = summarize(item.content || item.title || '');
  if (!summary && !title) {
    return null;
  }

  return {
    id: `news:${item.newsItemId}`,
    kind,
    market,
    providerName,
    title,
    summary: summary || title,
    campaignUrl: item.campaignUrl,
    publishDate: item.publishDate,
    expirationDate: item.expirationDate,
    sourceText: stripHtml(item.content || item.title || ''),
  };
}

function fromIncentive(
  item: TradeTrackerIncentiveRecord,
  market: VacationWebPromotionMarket,
): DisplayablePromotion | null {
  if (!item.validity.isActive) {
    return null;
  }
  if (mentionsKaching([item.name, item.description, item.conditions, item.campaignName, item.voucherCode])) {
    return null;
  }

  const providerName = resolveConnectedProvider({
    campaignId: item.campaignId,
    campaignName: item.campaignName,
  });
  if (!providerName) {
    return null;
  }

  if (
    !isDisplayableOffer({
      name: item.name,
      description: item.description,
      conditions: item.conditions,
      discountFixed: item.discountFixed,
      discountVariable: item.discountVariable,
      voucherCode: item.voucherCode,
    })
  ) {
    return null;
  }

  const title = cleanTitle(item.name, providerName);
  const summary = summarize(
    [item.description, item.conditions].filter(Boolean).join(' ') || item.name,
  );

  return {
    id: `${item.kind}:${item.materialItemId}`,
    kind: item.kind,
    market,
    providerName,
    title,
    summary,
    campaignUrl: item.campaignUrl,
    publishDate: item.validFromDate,
    expirationDate: item.validToDate,
    sourceText: [item.description, item.conditions].filter(Boolean).join(' ') || item.name,
    discountFixed: item.discountFixed,
    discountVariable: item.discountVariable,
    voucherCode: item.voucherCode,
    conditions: item.conditions,
  };
}

/**
 * Campaigns accepted on this snapshot's own affiliate site (this market's key and site).
 * The feed-manifest provider mapping has no market dimension, so access is decided here.
 */
function acceptedCampaignIds(snapshot: TradeTrackerPromotionSnapshot): Set<string> {
  return new Set(
    snapshot.campaigns
      .filter((campaign) => campaign.assignmentStatus?.trim().toLowerCase() === 'accepted')
      .map((campaign) => campaign.campaignId),
  );
}

/**
 * Select active TradeTracker promotions that belong to connected VacationWeb travel providers.
 * Does not invent deals from catalog/prices. Unrelated TT advertisers are excluded.
 * Only campaigns accepted on the snapshot's own site pass (SUB 33C); a campaign of the
 * other market, or one that is not accepted here, never becomes a promotion for this market.
 */
export function selectDisplayablePromotions(
  snapshot: TradeTrackerPromotionSnapshot,
  market: VacationWebPromotionMarket,
): DisplayablePromotion[] {
  const out: DisplayablePromotion[] = [];
  const accepted = acceptedCampaignIds(snapshot);
  const hasAccess = (campaignId: string | null | undefined) => Boolean(campaignId && accepted.has(campaignId));

  const ingestedAt = snapshot.ingestedAt;
  for (const item of snapshot.newsItems) {
    const selected = hasAccess(item.campaignId) ? fromNews(item, market) : null;
    if (selected) {
      out.push({ ...selected, ingestedAt });
    }
  }
  for (const item of snapshot.incentiveOffers) {
    const selected = hasAccess(item.campaignId) ? fromIncentive(item, market) : null;
    if (selected) {
      out.push({ ...selected, ingestedAt });
    }
  }
  for (const item of snapshot.vouchers) {
    const selected = hasAccess(item.campaignId) ? fromIncentive(item, market) : null;
    if (selected) {
      out.push({ ...selected, ingestedAt });
    }
  }

  out.sort((a, b) => {
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

  return out;
}
