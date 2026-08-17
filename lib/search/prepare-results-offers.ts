import type { FetchLike } from '../providers/prijsvrij/auth';
import { priceLiveRequiredMatchset } from '../providers/prijsvrij/page1-receipt-pricing';
import type { SearchParams, TravelOffer } from '../../types/travel';
import { filterOffers, sortOffers } from './filtering';
import { limitRankedResultsForPagination } from './pagination';
import { hasValidPresentablePrice } from './presentable-price';
import { rankResultsOffers } from './rank-results-offers';
import { applyResultsLivePriceOverlays } from './results-live-price-cache';
import { scheduleResultsMatchsetLivePricing } from './schedule-results-matchset-live-pricing';

const PRICE_DEPENDENT_SORTS = new Set(['price', 'price-desc', 'price-per-day']);

export function isPriceDependentSort(sort?: string): boolean {
  return PRICE_DEPENDENT_SORTS.has(sort ?? '');
}

/** Current filter/sort ranking from catalog fields only — no live-price overlays. */
export function rankCatalogOffers(
  offers: readonly TravelOffer[],
  params: SearchParams,
): TravelOffer[] {
  return sortOffers(filterOffers(offers as TravelOffer[], params), params.sort);
}

/**
 * Live-price ranking of an already-selected candidate pool.
 * Proven/presentable live prices sort first; catalog price is not used as a
 * stand-in for a missing or unavailable live-required price.
 */
export function rankLivePricedCandidatePool(
  pool: readonly TravelOffer[],
  params: SearchParams,
): TravelOffer[] {
  const overlaid = applyResultsLivePriceOverlays(pool, params);
  const presentable = sortOffers(overlaid.filter(hasValidPresentablePrice), params.sort);
  const notPresentable = overlaid.filter((offer) => !hasValidPresentablePrice(offer));
  return [...presentable, ...notPresentable];
}

/**
 * Results request ranking with live-price coordination.
 *
 * Non-price sorts (Recommended, stars, …): rank immediately and schedule
 * full-matchset live pricing in the background. Page 1 must not wait.
 *
 * Price-dependent sorts: from the CURRENT catalog-filtered matchset, take the
 * maximum-150 candidate pool, await live prices only for that pool (cache
 * overlap is reused), then re-rank the pool with live prices. A previous
 * request's 150 is not the next filter's universe.
 */
export async function prepareResultsOffers(
  offers: readonly TravelOffer[],
  params: SearchParams,
  options: { fetchImpl?: FetchLike } = {},
): Promise<TravelOffer[]> {
  if (isPriceDependentSort(params.sort)) {
    const catalogRanked = rankCatalogOffers(offers, params);
    const pool = limitRankedResultsForPagination(catalogRanked);
    if (pool.length > 0) {
      await priceLiveRequiredMatchset(pool, params, {
        fetchImpl: options.fetchImpl,
      });
    }
    const liveRankedPool = rankLivePricedCandidatePool(pool, params);
    return [...liveRankedPool, ...catalogRanked.slice(pool.length)];
  }

  const ranked = rankResultsOffers(offers, params);
  if (ranked.length > 0) {
    scheduleResultsMatchsetLivePricing(
      priceLiveRequiredMatchset(ranked, params, { fetchImpl: options.fetchImpl }),
    );
  }
  return ranked;
}
