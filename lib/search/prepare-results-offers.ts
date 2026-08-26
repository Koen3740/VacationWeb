import type { FetchLike } from '../providers/prijsvrij/auth';
import { priceLiveRequiredMatchset, stampUnpricedWhenLiveOccupancyUnsupported } from '../providers/prijsvrij/page1-receipt-pricing';
import type { SearchParams, TravelOffer } from '../../types/travel';
import { filterOffers, offerMatchesBudget, sortOffers } from './filtering';
import { limitRankedResultsForPagination, paginateResults } from './pagination';
import { requiresSunwebResultsLivePrice } from '../providers/sunweb';
import {
  CORENDON_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
  hasValidPresentablePrice,
  PRIJSVRIJ_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
} from './presentable-price';
import { rankResultsOffers } from './rank-results-offers';
import {
  applyResultsLivePriceOverlays,
  hasResultsLivePriceOverlay,
} from './results-live-price-cache';
import { scheduleResultsMatchsetLivePricing } from './schedule-results-matchset-live-pricing';

const PRICE_DEPENDENT_SORTS = new Set(['price', 'price-desc', 'price-per-day']);

export function isPriceDependentSort(sort?: string): boolean {
  return PRICE_DEPENDENT_SORTS.has(sort ?? '');
}

export type PreparedResultsOffers = {
  /** Immediate ranking: catalog pool for pending price sorts; otherwise ready. */
  offers: TravelOffer[];
  /** Exact live-ranked list. Resolves without extra HTTP when the pool is cached. */
  exactOffers: Promise<TravelOffer[]>;
  /** True only while a price-sort pool still has uncached live-required offers. */
  priceSortPending: boolean;
};

/** Current filter/sort ranking from catalog fields only — no live-price overlays. */
export function rankCatalogOffers(
  offers: readonly TravelOffer[],
  params: SearchParams,
): TravelOffer[] {
  return sortOffers(filterOffers(offers as TravelOffer[], params), params.sort);
}

/**
 * Live-price ranking of an already-selected candidate pool.
 * Proven live prices sort first; catalog offers without a proven price stay
 * in the matchset (not removed) and follow in catalog order.
 */
export function rankLivePricedCandidatePool(
  pool: readonly TravelOffer[],
  params: SearchParams,
): TravelOffer[] {
  const overlaid = applyResultsLivePriceOverlays(pool, params).filter((offer) =>
    offerMatchesBudget(offer, params),
  );
  const presentable = sortOffers(overlaid.filter(hasValidPresentablePrice), params.sort);
  const notPresentable = overlaid.filter((offer) => !hasValidPresentablePrice(offer));
  return [...presentable, ...notPresentable];
}

export function offerNeedsLivePriceWork(offer: TravelOffer, params: SearchParams): boolean {
  if (hasResultsLivePriceOverlay(offer.id, params)) {
    return false;
  }
  return (
    offer.provider === PRIJSVRIJ_PROVIDER_NAME ||
    offer.provider === CORENDON_PROVIDER_NAME ||
    offer.provider === ELIZA_PROVIDER_NAME ||
    (offer.provider === SUNWEB_PROVIDER_NAME && requiresSunwebResultsLivePrice(params))
  );
}

function assemblePriceSortRanking(
  pool: TravelOffer[],
  tail: TravelOffer[],
  params: SearchParams,
): TravelOffer[] {
  return rankLivePricedCandidatePool([...pool, ...tail], params);
}

/** Visible page of the max-150 price-sort pool. Not Package-1 diversity selection. */
export function slicePriceSortPoolPage(
  ranked: readonly TravelOffer[],
  page: number,
  pageSize: number,
  _options: { provisional: boolean; params?: SearchParams } = { provisional: false },
): {
  visibleOffers: TravelOffer[];
  page1Ids: string[];
  paginationTotal: number;
} {
  const pool = limitRankedResultsForPagination(ranked as TravelOffer[]);
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  return {
    visibleOffers: paginateResults(pool, safePage, pageSize),
    page1Ids: paginateResults(pool, 1, pageSize).map((offer) => offer.id),
    paginationTotal: pool.length,
  };
}

/**
 * Results request ranking with live-price coordination.
 *
 * Non-price sorts (Recommended, stars, …): rank immediately and schedule
 * full-matchset live pricing in the background (not awaited). Page overlays
 * (`startCatalogPageLiveOverlays`) still give the current page priority and
 * join the same cache / in-flight maps.
 *
 * Price-dependent sorts: from the CURRENT catalog-filtered matchset, take the
 * maximum-150 candidate pool and return that catalog ranking immediately.
 * Live pricing of that pool continues on the same request; `exactOffers`
 * resolves to the exact live ranking when every pool candidate has a terminal
 * live result. A previous request's 150 is not the next filter's universe.
 * That 150-pool is a price-sort await path; Recommended uses the full filtered
 * matchset as the background coverage set.
 */
export async function prepareResultsOffers(
  offers: readonly TravelOffer[],
  params: SearchParams,
  options: { fetchImpl?: FetchLike } = {},
): Promise<PreparedResultsOffers> {
  stampUnpricedWhenLiveOccupancyUnsupported(offers as TravelOffer[], params);

  if (isPriceDependentSort(params.sort)) {
    const catalogRanked = rankCatalogOffers(offers, params);
    const pool = limitRankedResultsForPagination(catalogRanked);
    const tail = catalogRanked.slice(pool.length);
    const pending = pool.some((offer) => offerNeedsLivePriceWork(offer, params));

    if (!pending) {
      const exact = assemblePriceSortRanking(pool, tail, params);
      return {
        offers: exact,
        exactOffers: Promise.resolve(exact),
        priceSortPending: false,
      };
    }

    const liveWork =
      pool.length > 0
        ? priceLiveRequiredMatchset(pool, params, { fetchImpl: options.fetchImpl })
        : Promise.resolve(pool);
    scheduleResultsMatchsetLivePricing(liveWork);
    const exactOffers = liveWork.then(() => assemblePriceSortRanking(pool, tail, params));
    return {
      offers: [...pool, ...tail],
      exactOffers,
      priceSortPending: true,
    };
  }

  const ranked = rankResultsOffers(offers, params);
  if (ranked.length > 0) {
    scheduleResultsMatchsetLivePricing(
      priceLiveRequiredMatchset(ranked, params, { fetchImpl: options.fetchImpl }),
    );
  }
  return {
    offers: ranked,
    exactOffers: Promise.resolve(ranked),
    priceSortPending: false,
  };
}
