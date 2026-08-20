import type { TravelOffer } from '@/types/travel';

export const PRIJSVRIJ_PROVIDER_NAME = 'Prijsvrij';
export const CORENDON_PROVIDER_NAME = 'Corendon';
export const SUNWEB_PROVIDER_NAME = 'Sunweb';
export const ELIZA_PROVIDER_NAME = 'Eliza was here';

/** User-facing Results/Detail copy. UNPRICED must not reuse UNAVAILABLE wording. */
export const RESULTS_PRICE_COPY = {
  pending: 'Actuele prijs volgt',
  unpriced: 'Geen bevestigde prijs voor deze samenstelling',
  unavailable: 'Actuele prijs niet beschikbaar',
} as const;

export type ResultsPricePresentationKind = 'amount' | 'pending' | 'unpriced' | 'unavailable';

/**
 * Product rule: only a valid allowed price may be shown.
 * No "Prijs op aanvraag", €0, feed-as-live, Search, or Matrix fallback.
 */
export function isValidNumericPrice(price: unknown): price is number {
  return typeof price === 'number' && Number.isFinite(price) && price > 0;
}

/** Amounts may only come from a proven live-price route. Feed € is never a live amount. */
export function hasProvenLiveDisplayPrice(offer: TravelOffer): boolean {
  if (!isValidNumericPrice(offer.price) || offer.livePriceStatus !== 'proven') {
    return false;
  }
  if (offer.provider === PRIJSVRIJ_PROVIDER_NAME) {
    return offer.livePriceSource === 'receipt';
  }
  if (offer.provider === CORENDON_PROVIDER_NAME) {
    return offer.livePriceSource === 'lowestpricesacco' || offer.livePriceSource === 'upsales';
  }
  if (offer.provider === ELIZA_PROVIDER_NAME || offer.provider === SUNWEB_PROVIDER_NAME) {
    return offer.livePriceSource === 'getPromotedPrice';
  }
  return false;
}

/**
 * Results price-eligibility: a proven live p.p. price for this occupancy.
 * Catalog/feed € is never presentable. UNPRICED / UNAVAILABLE / ERROR are not.
 */
export function hasValidPresentablePrice(offer: TravelOffer): boolean {
  return hasProvenLiveDisplayPrice(offer);
}

export function filterToPresentableOffers(offers: TravelOffer[]): TravelOffer[] {
  return offers.filter(hasValidPresentablePrice);
}

/** Occupancy is outside the current proven live-price route. Not the same as unavailable. */
export function isUnpricedResultsOffer(offer: TravelOffer): boolean {
  return offer.livePriceStatus === 'unpriced';
}

/**
 * Results shows only offers with a proven live p.p. price.
 * UNPRICED / UNAVAILABLE / ERROR / feed-without-proof are excluded.
 * Pending live slots are handled separately via TravelCard `provisional`.
 */
export function isResultsVisibleOffer(offer: TravelOffer): boolean {
  return hasValidPresentablePrice(offer);
}

export function filterToResultsVisibleOffers(offers: TravelOffer[]): TravelOffer[] {
  return offers.filter(isResultsVisibleOffer);
}

/**
 * Maps TravelOffer live-price status to the Results/Detail price panel.
 * SUCCESS → amount; pending live call → pending; otherwise no amount.
 */
export function resultsPricePresentation(
  offer: TravelOffer,
  options: { provisional?: boolean } = {},
): ResultsPricePresentationKind {
  if (hasProvenLiveDisplayPrice(offer)) {
    return 'amount';
  }
  if (options.provisional) {
    return 'pending';
  }
  if (isUnpricedResultsOffer(offer)) {
    return 'unpriced';
  }
  return 'unavailable';
}
