import type { FetchLike } from '../providers/prijsvrij/auth';
import { priceLiveRequiredMatchset, stampUnpricedWhenLiveOccupancyUnsupported } from '../providers/prijsvrij/page1-receipt-pricing';
import type { SearchParams, TravelOffer } from '../../types/travel';
import { filterOffers, sortOffers } from './filtering';
import { paginateResults } from './pagination';
import { requiresSunwebResultsLivePrice } from '../providers/sunweb';
import {
  CORENDON_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
  filterToResultsListableOffers,
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
import {
  livePricingBrowseRemainder,
  selectLivePricingCandidateWindow,
  selectLivePricingInitialWorkset,
} from './live-pricing-workset';
import { countPresentableB, runS6DynamicRefill } from './s6-dynamic-refill';

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
 * Paginate the bookable (non-A) pool in sort order.
 * Provider-confirmed A is removed before the page slice so A never occupies a
 * slot. C / pending / B stay. paginationTotal is the bookable pool length.
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
  const overlaid = options.params
    ? applyResultsLivePriceOverlays(ranked as TravelOffer[], options.params)
    : (ranked as TravelOffer[]);
  const bookable = filterToResultsListableOffers(overlaid);
  const visibleOffers = paginateResults(bookable, safePage, pageSize);
  return {
    visibleOffers,
    page1Ids: paginateResults(bookable, 1, pageSize).map((offer) => offer.id),
    paginationTotal: bookable.length,
  };
}

/**
 * Schedule S6 cursor refill toward 150 presentable B (background).
 * Does not block exactOffers / page1 freeze (AN-059 / S7).
 */
function scheduleS6Refill(
  catalogRanked: readonly TravelOffer[],
  params: SearchParams,
  fetchImpl: FetchLike | undefined,
  after?: Promise<unknown>,
): void {
  const run = async (): Promise<void> => {
    if (after) {
      await after;
    }
    if (countPresentableB(catalogRanked, params) >= 150) {
      return;
    }
    await runS6DynamicRefill(catalogRanked, params, { fetchImpl });
  };
  scheduleResultsMatchsetLivePricing(run());
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
 * Await live prices only for an initial workset (bounded subset of the
 * technical candidate window). S6 then continues in the background through the
 * catalog cursor until 150 presentable B (or a hard stop) — not a blind new W.
 * Page1 freeze after exactOffers is unchanged (S7).
 */
export async function prepareResultsOffers(
  offers: readonly TravelOffer[],
  params: SearchParams,
  options: { fetchImpl?: FetchLike } = {},
): Promise<PreparedResultsOffers> {
  stampUnpricedWhenLiveOccupancyUnsupported(offers as TravelOffer[], params);

  if (isPriceDependentSort(params.sort)) {
    const catalogRanked = rankCatalogOffers(offers, params);
    const liveWindow = selectLivePricingCandidateWindow(catalogRanked, params);
    const workset = selectLivePricingInitialWorkset(liveWindow, params);
    const tail = livePricingBrowseRemainder(catalogRanked, liveWindow);
    const worksetPending = workset.some((offer) => offerNeedsLivePriceWork(offer, params));

    if (!worksetPending) {
      scheduleS6Refill(catalogRanked, params, options.fetchImpl);
      const exact = assemblePriceSortRanking(liveWindow, tail, params);
      return {
        offers: exact,
        exactOffers: Promise.resolve(exact),
        priceSortPending: false,
      };
    }

    const worksetWork =
      workset.length > 0
        ? priceLiveRequiredMatchset(workset, params, { fetchImpl: options.fetchImpl })
        : Promise.resolve(workset);

    // S6 continues past the workset (skips settled overlays) until 150 B.
    // Replaces blind full-window remainder pricing as the coverage engine.
    scheduleS6Refill(catalogRanked, params, options.fetchImpl, worksetWork);

    const exactOffers = worksetWork.then(() => assemblePriceSortRanking(liveWindow, tail, params));
    return {
      // Preserve catalog browse order while price-sort is pending (AN-061).
      offers: catalogRanked,
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
