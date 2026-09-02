import type { SearchParams, TravelOffer } from '../../types/travel';
import { filterOffers, sortOffers } from './filtering';
import { applyResultsLivePriceOverlays } from './results-live-price-cache';

/**
 * Results ranking for non-price sorts.
 *
 * Matchset membership is fixed by catalog `filterOffers` (search filters).
 * Cached live prices overlay afterward so sort/display can use them, but
 * overlays must not add/remove offers from the filter matchset.
 */
export function rankResultsOffers(
  offers: readonly TravelOffer[],
  params: SearchParams,
): TravelOffer[] {
  const matched = filterOffers(offers as TravelOffer[], params);
  return sortOffers(applyResultsLivePriceOverlays(matched, params), params.sort);
}
