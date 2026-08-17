import type { TravelOffer } from '@/types/travel';

export const PRIJSVRIJ_PROVIDER_NAME = 'Prijsvrij';
export const CORENDON_PROVIDER_NAME = 'Corendon';
export const SUNWEB_PROVIDER_NAME = 'Sunweb';
export const ELIZA_PROVIDER_NAME = 'Eliza was here';

/**
 * Product rule: only a valid allowed price may be shown.
 * No "Prijs op aanvraag", €0, feed-as-live, Search, or Matrix fallback.
 */
export function isValidNumericPrice(price: unknown): price is number {
  return typeof price === 'number' && Number.isFinite(price) && price > 0;
}

export function hasValidPresentablePrice(offer: TravelOffer): boolean {
  if (!isValidNumericPrice(offer.price)) {
    return false;
  }

  if (offer.provider === PRIJSVRIJ_PROVIDER_NAME) {
    return offer.livePriceStatus === 'proven' && offer.livePriceSource === 'receipt';
  }

  if (offer.provider === CORENDON_PROVIDER_NAME) {
    return offer.livePriceStatus === 'proven' && offer.livePriceSource === 'lowestpricesacco';
  }

  if (offer.provider === ELIZA_PROVIDER_NAME) {
    return offer.livePriceStatus === 'proven' && offer.livePriceSource === 'getPromotedPrice';
  }

  if (offer.provider === SUNWEB_PROVIDER_NAME) {
    if (offer.livePriceStatus === 'unavailable') {
      return false;
    }
    if (offer.livePriceStatus === 'proven') {
      return offer.livePriceSource === 'getPromotedPrice' && isValidNumericPrice(offer.price);
    }
    // Sunweb still has no GetPromotedPriceApi client. Catalog numeric
    // price is presentable only when live was not attempted-and-failed.
    return offer.livePriceSource !== 'search' && offer.livePriceSource !== 'receipt';
  }

  if (offer.livePriceStatus === 'unavailable') {
    return false;
  }

  return true;
}

export function filterToPresentableOffers(offers: TravelOffer[]): TravelOffer[] {
  return offers.filter(hasValidPresentablePrice);
}
