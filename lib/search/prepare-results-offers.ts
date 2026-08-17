import type { FetchLike } from '../providers/prijsvrij/auth';
import { priceLiveRequiredMatchset } from '../providers/prijsvrij/page1-receipt-pricing';
import type { SearchParams, TravelOffer } from '../../types/travel';
import { filterOffers } from './filtering';
import { rankResultsOffers } from './rank-results-offers';
import { applyResultsLivePriceOverlays } from './results-live-price-cache';
import { scheduleResultsMatchsetLivePricing } from './schedule-results-matchset-live-pricing';

const PRICE_DEPENDENT_SORTS = new Set(['price', 'price-desc', 'price-per-day']);

export function isPriceDependentSort(sort?: string): boolean {
  return PRICE_DEPENDENT_SORTS.has(sort ?? '');
}

/**
 * Results request ranking with live-price coordination.
 *
 * Non-price sorts (Recommended, stars, …): rank immediately and schedule
 * full-matchset live pricing in the background. Page 1 must not wait.
 *
 * Price-dependent sorts: wait for live prices of the **current filtered
 * matchset only**, joining in-flight work and starting genuine misses.
 * Do not rank until that required coverage exists.
 */
export async function prepareResultsOffers(
  offers: readonly TravelOffer[],
  params: SearchParams,
  options: { fetchImpl?: FetchLike } = {},
): Promise<TravelOffer[]> {
  if (isPriceDependentSort(params.sort)) {
    const required = filterOffers(
      applyResultsLivePriceOverlays(offers as TravelOffer[], params),
      params,
    );
    if (required.length > 0) {
      await priceLiveRequiredMatchset(required, params, {
        fetchImpl: options.fetchImpl,
      });
    }
    return rankResultsOffers(offers, params);
  }

  const ranked = rankResultsOffers(offers, params);
  if (ranked.length > 0) {
    scheduleResultsMatchsetLivePricing(
      priceLiveRequiredMatchset(ranked, params, { fetchImpl: options.fetchImpl }),
    );
  }
  return ranked;
}
