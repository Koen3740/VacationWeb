/**
 * Editorial offers for `/aanbiedingen`.
 *
 * A card is shown only when the TradeTracker stream already carried a
 * concrete amount, percent, or voucher. Homepage claims that are absent
 * from TradeTracker news and banner materials are not copied in here.
 * Materials 2499691–2499700 stay excluded. Kaching is not read.
 */

import type { AanbiedingenCard } from './compose-aanbiedingen';
import { isOwnCreativeImageUrl } from './creative-image-path';
import { isRejectedGenericLastminuteMaterial } from './displayable-offer';
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
  /**
   * TradeTracker publish or valid-from date, when the source has one.
   * Null when that date was not in the source. Used only for newest-first order.
   */
  listedAt: string | null;
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
  if (card.imageWidth && card.imageHeight) {
    const ratio = card.imageWidth / card.imageHeight;
    if (ratio > 3.4 || ratio < 0.45) {
      return null;
    }
  }
  return card.imageUrl;
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
 * Rejected last-minute materials never pass. Extreme banner sizes are not used as the picture.
 * `listedAt` is the card publish date already stored on the stream (`validFromDate` or news `publishDate`).
 */
export function editorialOffersFromCards(cards: readonly AanbiedingenCard[]): EditorialOffer[] {
  const offers: EditorialOffer[] = [];
  for (const card of cards) {
    if (isRejectedGenericLastminuteMaterial(card.materialItemId)) {
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
      listedAt: card.publishDate,
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
