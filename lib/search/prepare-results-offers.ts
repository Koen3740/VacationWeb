import type { FetchLike } from '../providers/prijsvrij/auth';
import { priceLiveRequiredMatchset, stampUnpricedWhenLiveOccupancyUnsupported } from '../providers/prijsvrij/page1-receipt-pricing';
import type { SearchParams, TravelOffer } from '../../types/travel';
import { filterOffers, sortOffers } from './filtering';
import {
  limitLivePricingCandidatePool,
  paginateResults,
} from './pagination';
import { requiresSunwebResultsLivePrice } from '../providers/sunweb';
import {
  CORENDON_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
  hasValidPresentablePrice,
  PRIJSVRIJ_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
} from './presentable-price';
import { rankResultsOffers } from './rank-results-offers';
import { PAGE1_OVERLAY_RESERVE, PAGE_OVERLAY_SCAN_LIMIT, collectListablePaintWindow } from './results-catalog-page';
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
 *
 * Budget / search filters are applied when the matchset is built — live
 * overlays must not drop members here or sort mode would change the count.
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
  liveWindow: TravelOffer[],
  tail: TravelOffer[],
  params: SearchParams,
): TravelOffer[] {
  // Live refine applies to the technical window only; tail stays in the user set.
  return [...rankLivePricedCandidatePool(liveWindow, params), ...tail];
}

/**
 * Paginate the ranked filter matchset in sort order.
 * paginationTotal is always the full matchset — live settlement / listability
 * must not make counts sort-dependent. The visible paint window skips settled
 * non-listable shells and may include reserve listable candidates for backfill.
 */
export function slicePriceSortPoolPage(
  ranked: readonly TravelOffer[],
  page: number,
  pageSize: number,
  options: { provisional: boolean; params?: SearchParams } = { provisional: false },
): {
  visibleOffers: TravelOffer[];
  page1Ids: string[];
  paginationTotal: number;
} {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const startIndex = (safePage - 1) * pageSize;
  return {
    visibleOffers: collectListablePaintWindow(
      ranked,
      startIndex,
      pageSize + PAGE1_OVERLAY_RESERVE,
      options.params,
      Math.max(PAGE_OVERLAY_SCAN_LIMIT, ranked.length - startIndex),
    ),
    page1Ids: paginateResults(ranked as TravelOffer[], 1, pageSize).map((offer) => offer.id),
    paginationTotal: ranked.length,
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
 * Price-dependent sorts: catalog-rank the FULL matchset (user result set).
 * Await live prices only for a technical candidate window; that window must
 * never become the browse/pagination universe. OPEN: true global live-price
 * ordering over thousands of offers without sync-awaiting all of them.
 */
export async function prepareResultsOffers(
  offers: readonly TravelOffer[],
  params: SearchParams,
  options: { fetchImpl?: FetchLike } = {},
): Promise<PreparedResultsOffers> {
  stampUnpricedWhenLiveOccupancyUnsupported(offers as TravelOffer[], params);

  if (isPriceDependentSort(params.sort)) {
    const catalogRanked = rankCatalogOffers(offers, params);
    const liveWindow = limitLivePricingCandidatePool(catalogRanked);
    const tail = catalogRanked.slice(liveWindow.length);
    const pending = liveWindow.some((offer) => offerNeedsLivePriceWork(offer, params));

    if (!pending) {
      const exact = assemblePriceSortRanking(liveWindow, tail, params);
      return {
        offers: exact,
        exactOffers: Promise.resolve(exact),
        priceSortPending: false,
      };
    }

    const liveWork =
      liveWindow.length > 0
        ? priceLiveRequiredMatchset(liveWindow, params, { fetchImpl: options.fetchImpl })
        : Promise.resolve(liveWindow);
    scheduleResultsMatchsetLivePricing(liveWork);
    const exactOffers = liveWork.then(() => assemblePriceSortRanking(liveWindow, tail, params));
    return {
      offers: [...liveWindow, ...tail],
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
