/**
 * Editorial offers for `/aanbiedingen`.
 *
 * A card is shown only when the TradeTracker stream already carried a
 * concrete amount, percent, voucher, or a named free benefit such as
 * “1 kind gratis”. Homepage claims that are absent from TradeTracker
 * news and banner materials are not copied in here.
 * Materials 2499691–2499700 stay excluded. Kaching is not read.
 */

import type { AanbiedingenCard } from './compose-aanbiedingen';
import { isOwnCreativeImageUrl } from './creative-image-path';
import { concreteFreeBenefit, isRejectedGenericLastminuteMaterial, mentionsKaching } from './displayable-offer';
import { compareCalendarDates, toCalendarDate, utcCalendarDate } from './validity';
import { promotionClickHref } from './promotion-click';
import type { VacationWebPromotionMarket } from './select-displayable';
import type { CreativeAllowedProvider } from './types';

export type EditorialOfferSource = {
  label: string;
  url: string;
};

export type EditorialOffer = {
  id: string;
  market: VacationWebPromotionMarket;
  providerName: CreativeAllowedProvider;
  /** News publish date, or a creative start date when that is all the source has. */
  publishedAt: string | null;
  /** Validity start when it is stored apart from the publish date. */
  validFrom: string | null;
  /** Snapshot or creative fetch time. Last resort for newest-first order. */
  ingestedAt: string | null;
  title: string;
  benefitLead: string;
  benefitAmount: string;
  benefitTail: string;
  summary: string;
  conditions: string;
  imageUrl: string;
  imageAlt: string;
  /** Stored affiliate `/c` template, or an official https page. Never `/i`. */
  clickUrl: string;
  conditionsUrl: string;
  sources: readonly EditorialOfferSource[];
};

const BARE_PROMO = new Set([
  'lastminute',
  'earlybooking',
  'vroegboek',
  'vroegboekkorting',
  'korting',
  'discount',
  'boeknu',
]);

function isBarePromo(value: string): boolean {
  return BARE_PROMO.has(value.toLowerCase().replace(/[\s-]+/g, ''));
}

/** One structured source part: an amount, a percent, a raw discount figure, or a voucher code. */
function concretePart(value: string): boolean {
  const text = value.trim();
  if (!text || isBarePromo(text)) {
    return false;
  }
  if (/€\s?\d|\d\s?%/.test(text)) {
    return true;
  }
  if (/^\d{1,5}(?:[.,]\d{1,2})?$/.test(text)) {
    return true;
  }
  return /^[A-Za-z0-9][A-Za-z0-9_-]{1,24}$/.test(text);
}

function concreteBenefit(value: string | null): boolean {
  if (!value) {
    return false;
  }
  if (concreteFreeBenefit(value)) {
    return true;
  }
  const parts = value
    .split(' · ')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 && parts.every(concretePart);
}

function usableStoredImage(card: AanbiedingenCard): string | null {
  if (!isOwnCreativeImageUrl(card.imageUrl) || !card.imageUrl) {
    return null;
  }
  return card.imageUrl;
}

function isExpired(expirationDate: string | null, asOfMs: number): boolean {
  const end = toCalendarDate(expirationDate);
  if (!end) {
    return false;
  }
  return compareCalendarDates(utcCalendarDate(asOfMs), end) > 0;
}

function cardClick(card: AanbiedingenCard): string | null {
  if (card.source === 'creative' && card.clickUrl && card.campaignId && card.affiliateSiteId && card.materialItemId) {
    return promotionClickHref({
      market: card.market,
      campaignId: card.campaignId,
      affiliateSiteId: card.affiliateSiteId,
      materialItemId: card.materialItemId,
      trackingClickUrlTemplate: card.clickUrl,
    });
  }
  if (!card.campaignUrl || card.campaignUrl.includes('/i?') || card.campaignUrl.includes('/c?')) {
    return null;
  }
  return card.campaignUrl;
}

/**
 * Stream cards that already survived the amount rule.
 * Rejected last-minute materials never pass. An allowed own-storage image is kept at any ratio;
 * the page crops it into the wide card. An expired end date stays off the page.
 */
export function editorialOffersFromCards(cards: readonly AanbiedingenCard[], asOfMs = Date.now()): EditorialOffer[] {
  const offers: EditorialOffer[] = [];
  for (const card of cards) {
    if (isRejectedGenericLastminuteMaterial(card.materialItemId)) {
      continue;
    }
    if (mentionsKaching([card.title, card.summary, card.benefitText, card.discountText, card.campaignName, card.conditions])) {
      continue;
    }
    if (isExpired(card.expirationDate, asOfMs)) {
      continue;
    }
    if (card.providerName !== 'Corendon' && card.providerName !== 'Sunweb' && card.providerName !== 'Eliza was here') {
      continue;
    }
    const providerName = card.providerName;
    if (!concreteBenefit(card.benefitText) && !concreteBenefit(card.discountText)) {
      continue;
    }
    const clickUrl = cardClick(card);
    if (!clickUrl) {
      continue;
    }
    const benefit = card.benefitText ?? card.discountText ?? '';
    offers.push({
      id: card.id,
      market: card.market,
      providerName,
      publishedAt: card.publishDate,
      validFrom: card.publishDate,
      ingestedAt: card.ingestedAt ?? null,
      title: card.title,
      benefitLead: 'Voordeel',
      benefitAmount: benefit,
      benefitTail: '',
      summary: card.summary ?? '',
      conditions: card.conditions ?? '',
      imageUrl: usableStoredImage(card) ?? '',
      imageAlt: card.title,
      clickUrl,
      conditionsUrl: card.campaignUrl && !card.campaignUrl.includes('/c?') && !card.campaignUrl.includes('/i?') ? card.campaignUrl : clickUrl,
      sources: [],
    });
  }
  return offers;
}
