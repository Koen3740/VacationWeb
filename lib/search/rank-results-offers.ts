import type { SearchParams, TravelOffer } from '../../types/travel';
import { filterOffers, sortOffers } from './filtering';
import { applyResultsLivePriceOverlays } from './results-live-price-cache';

/**
 * Results ranking: overlay valid cached live prices, then the existing
 * filterOffers → sortOffers pipeline. Price sorts therefore use the live
 * price when one is cached for this occupancy context.
 */
export function rankResultsOffers(
  offers: readonly TravelOffer[],
  params: SearchParams,
): TravelOffer[] {
  return sortOffers(filterOffers(applyResultsLivePriceOverlays(offers, params), params), params.sort);
}
