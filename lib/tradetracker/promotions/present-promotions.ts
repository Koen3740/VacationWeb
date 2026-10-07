import { promotionalValidity } from './validity';
import type { DisplayablePromotion, DisplayablePromotionKind } from './select-displayable';

/**
 * Presentation layer for /aanbiedingen.
 *
 * Input: promotions that already passed the canonical gates
 * (`selectDisplayablePromotions` + `dedupeDisplayablePromotions`: connected
 * provider, displayable news type, active, cross-site dedupe).
 * Output: serialisable card models for the UI.
 *
 * Rules enforced here:
 *  - Re-check validity at render time (the ingest result is cached for 15 min).
 *  - No affiliate site IDs, native keys or content keys leave this module.
 *  - Click-out URLs are passed through unchanged (only http/https is rendered).
 *  - Only text from the source is shown; nothing is computed or invented.
 *
 * Ordering (documented SSOT, see `compareForDisplay`):
 *  1. promotions with a validity the source states explicitly first
 *  2. most recently published/started first
 *  3. earlier end date first
 *  4. provider name, title, id (stable tie-breakers)
 */

export type PromotionCardLink = {
  /** Exactly the URL TradeTracker returned; never rewritten. */
  href: string;
  /** Provider domain for display (e.g. corendon.nl). */
  domain: string | null;
};

export type PromotionCard = {
  /** DOM-safe id; contains no affiliate site ID. */
  id: string;
  providerName: string;
  kindLabel: 'Actie' | 'Kortingscode' | 'Aanbieding';
  title: string;
  /** Verbatim `Actie:` line from the source. */
  highlight: string | null;
  /** Short source description; null when it would only repeat the title or the highlight. */
  description: string | null;
  periodLabel: string | null;
  period: string | null;
  conditions: string | null;
  /** Publication date of a campaign-news item (formatted); null for incentives/vouchers. */
  publishedLabel: string | null;
  /** End date, ONLY for incentives/vouchers where the source states a validity window. */
  validToLabel: string | null;
  voucherCode: string | null;
  /**
   * Provider logo: the official campaign image TradeTracker supplies for the campaign
   * (cdn.tradetracker.net). A provider visual only - never presented as imagery of the action.
   */
  providerLogo: string | null;
  ctaLabel: 'Bekijk actie' | 'Bekijk aanbieding';
  links: PromotionCardLink[];
};

export type ProviderFilterOption = { name: string; count: number };

const MONTHS_NL = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
] as const;

/** `2026-09-15` -> `15 september 2026`; null when the input is not a calendar date. */
export function formatCalendarDateNl(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  const month = MONTHS_NL[Number(match[2]) - 1];
  if (!month) {
    return null;
  }
  return `${Number(match[3])} ${month} ${match[1]}`;
}

function hasPromotionTerms(kind: DisplayablePromotionKind): boolean {
  // incentive offers / vouchers carry a validity window of the offer itself.
  // Campaign news dates are publication/listing dates, not promotion terms.
  return kind === 'incentive_offer' || kind === 'voucher';
}

function kindLabel(kind: DisplayablePromotionKind): PromotionCard['kindLabel'] {
  if (kind === 'voucher' || kind === 'vouchercode_update') return 'Kortingscode';
  if (kind === 'incentive_offer') return 'Aanbieding';
  return 'Actie';
}

function hasExplicitValidity(promotion: DisplayablePromotion): boolean {
  return (
    promotion.facts.period !== null ||
    (hasPromotionTerms(promotion.kind) && promotion.expirationDate !== null)
  );
}

/** Transparent display order. No score, no ranking claim. */
export function compareForDisplay(a: DisplayablePromotion, b: DisplayablePromotion): number {
  const explicitA = hasExplicitValidity(a) ? 0 : 1;
  const explicitB = hasExplicitValidity(b) ? 0 : 1;
  if (explicitA !== explicitB) {
    return explicitA - explicitB;
  }

  const startA = a.publishDate ?? '';
  const startB = b.publishDate ?? '';
  if (startA !== startB) {
    return startB.localeCompare(startA);
  }

  const endA = a.expirationDate ?? '9999-12-31';
  const endB = b.expirationDate ?? '9999-12-31';
  if (endA !== endB) {
    return endA.localeCompare(endB);
  }

  return (
    a.providerName.localeCompare(b.providerName, 'nl') ||
    a.title.localeCompare(b.title, 'nl') ||
    a.id.localeCompare(b.id)
  );
}

function squash(value: string): string {
  return value.toLocaleLowerCase('nl').replace(/[^\p{L}\p{N}]+/gu, '');
}

function descriptionFor(promotion: DisplayablePromotion): string | null {
  if (promotion.facts.highlight) {
    // The labelled `Actie:` text already says what the promotion is.
    return null;
  }
  const summary = promotion.summary.trim();
  if (!summary) {
    return null;
  }
  const flatSummary = squash(summary);
  const flatTitle = squash(promotion.title);
  if (flatSummary === flatTitle) {
    return null;
  }
  // Advertiser boilerplate such as "Corendon NL heeft een nieuwe actie: <title> ."
  // only restates the title.
  if (flatSummary.includes(flatTitle) && flatSummary.length <= flatTitle.length + 40) {
    return null;
  }
  return summary;
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

function linksFor(promotion: DisplayablePromotion): PromotionCardLink[] {
  const seen = new Set<string>();
  const links: PromotionCardLink[] = [];
  for (const context of promotion.affiliateContexts) {
    const href = context.campaignUrl;
    if (!href || seen.has(href) || !isHttpUrl(href)) {
      continue;
    }
    seen.add(href);
    links.push({ href, domain: context.domain });
  }
  return links;
}

const CAMPAIGN_IMAGE_PATH = /^\/[a-z]{2}\/campaign_image_square\/\d+\.(?:png|jpe?g|gif|webp)$/i;

/**
 * Accepts only the official TradeTracker campaign image URL shape (https, cdn.tradetracker.net,
 * /<cc>/campaign_image_square/<campaignId>.<ext>, no query/credentials). This mirrors the
 * narrow next.config.js remotePatterns entry, so the URL is always optimizable by next/image.
 */
export function officialCampaignImageUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value);
    const ok =
      url.protocol === 'https:' &&
      url.hostname === 'cdn.tradetracker.net' &&
      url.port === '' &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      CAMPAIGN_IMAGE_PATH.test(url.pathname);
    return ok ? value : null;
  } catch {
    return null;
  }
}

function sourceSlug(promotion: DisplayablePromotion): string {
  const base = promotion.sourceKey ?? `${promotion.kind}|${promotion.title}`;
  return base.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'item';
}

export function toPromotionCard(promotion: DisplayablePromotion, index: number): PromotionCard {
  const terms = hasPromotionTerms(promotion.kind);
  return {
    id: `promo-${index}-${sourceSlug(promotion)}`,
    providerName: promotion.providerName,
    kindLabel: kindLabel(promotion.kind),
    title: promotion.title,
    highlight: promotion.facts.highlight,
    description: descriptionFor(promotion),
    periodLabel: promotion.facts.periodLabel
      ? promotion.facts.periodLabel.charAt(0).toLocaleUpperCase('nl') +
        promotion.facts.periodLabel.slice(1)
      : null,
    period: promotion.facts.period,
    conditions: promotion.facts.conditions,
    publishedLabel: terms ? null : formatCalendarDateNl(promotion.publishDate),
    validToLabel: terms ? formatCalendarDateNl(promotion.expirationDate) : null,
    voucherCode: promotion.voucherCode,
    providerLogo: officialCampaignImageUrl(promotion.providerLogoUrl),
    ctaLabel: terms ? 'Bekijk aanbieding' : 'Bekijk actie',
    links: linksFor(promotion),
  };
}

/** Keep only promotions that are still valid today (UTC calendar date, same rule as ingest). */
export function activeAt(
  promotions: readonly DisplayablePromotion[],
  asOfMs: number,
): DisplayablePromotion[] {
  return promotions.filter(
    (promotion) =>
      promotionalValidity({
        startDate: promotion.publishDate,
        endDate: promotion.expirationDate,
        asOfMs,
      }).isActive,
  );
}

export function toPromotionCards(
  promotions: readonly DisplayablePromotion[],
  asOfMs: number = Date.now(),
): PromotionCard[] {
  return activeAt(promotions, asOfMs)
    .sort(compareForDisplay)
    .map((promotion, index) => toPromotionCard(promotion, index));
}

/** Only providers that actually have a card; most cards first, then name. */
export function providerFilterOptions(cards: readonly PromotionCard[]): ProviderFilterOption[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    counts.set(card.providerName, (counts.get(card.providerName) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'nl'));
}

/** `A`, `A en B`, `A, B en C` */
export function joinProviderNames(names: readonly string[]): string {
  if (names.length <= 1) {
    return names[0] ?? '';
  }
  return `${names.slice(0, -1).join(', ')} en ${names[names.length - 1]}`;
}
