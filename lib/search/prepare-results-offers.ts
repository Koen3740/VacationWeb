import type { FetchLike } from '../providers/prijsvrij/auth';
import {
  priceLiveRequiredMatchset,
  stampUnpricedWhenLiveOccupancyUnsupported,
} from '../providers/prijsvrij/page1-receipt-pricing';
import type { SearchParams, TravelOffer } from '../../types/travel';
import { filterOffers, sortOffers } from './filtering';
import { paginateResults, RESULTS_USER_PAGINATION_CAP } from './pagination';
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
  hydrateResultsLivePriceOverlaysFromL2,
} from './results-live-price-cache';
import {
  scheduleCappedMatchsetLiveAfterPage,
} from './schedule-capped-matchset-live-after-page';
import {
  livePricingBrowseRemainder,
  selectLivePricingCandidateWindow,
  selectLivePricingInitialWorkset,
} from './live-pricing-workset';
import {
  beginOrContinuePricingRun,
  buildPricingRunKey,
} from './live-pricing-admission';
import {
  bookableResultsMembership,
  isSharedLivePricingPoolSort,
  selectResultsBrowsePool,
} from './results-catalog-page';

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
  catalogRanked: TravelOffer[],
  params: SearchParams,
): TravelOffer[] {
  // GO11: price sort orders the WHOLE matchset by proven live price (B first),
  // not merely the technical ≤150 window. Unpriced/A/C/Pending follow in catalog order.
  return rankLivePricedCandidatePool(catalogRanked, params);
}

/**
 * Paginate the presentable (B) pool in sort order.
 * A / C / Pending are excluded from card slots; they remain in the underlying
 * matchset for later pricing retries. paginationTotal is the B pool length.
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
  // Budget invariant: budgetMin <= displayed live p.p. price <= budgetMax (checked on
  // the live price inside bookableResultsMembership). GO11: browsable cards capped at
  // 150 (15×10); pool/heading stay uncapped. Laag → Hoog = shared live-pricing pool.
  const browsable = options.params
    ? selectResultsBrowsePool(ranked, options.params, RESULTS_USER_PAGINATION_CAP)
    : bookableResultsMembership(ranked).slice(0, RESULTS_USER_PAGINATION_CAP);
  const visibleOffers = paginateResults(browsable, safePage, pageSize);
  return {
    visibleOffers,
    page1Ids: paginateResults(browsable, 1, pageSize).map((offer) => offer.id),
    paginationTotal: browsable.length,
  };
}

/**
 * Results request ranking with live-price coordination.
 *
 * Non-price sorts: rank immediately; CatalogLiveBody starts P0 overlays then the
 * single P1→P2 orchestrator ({@link scheduleCappedMatchsetLiveAfterPage}).
 *
 * Price-dependent sorts: await a bounded workset, then one orchestrator (P1+P2).
 * No duplicate S6 + full-matchset schedules.
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
    void livePricingBrowseRemainder(catalogRanked, liveWindow);
    const pricingRun = beginOrContinuePricingRun(buildPricingRunKey(params));

    await hydrateResultsLivePriceOverlaysFromL2(
      workset.map((offer) => offer.id),
      params,
      { offers: workset },
    );
    const worksetPending = workset.some((offer) => offerNeedsLivePriceWork(offer, params));

    if (!worksetPending) {
      // Single orchestrator: P1 coverage + P2 warm (no duplicate S6 schedule).
      scheduleCappedMatchsetLiveAfterPage(catalogRanked, params, {
        fetchImpl: options.fetchImpl,
        cheapestFirst: isSharedLivePricingPoolSort(params.sort),
        pricingRun,
        headstartMs: 0,
      });
      const exact = assemblePriceSortRanking(catalogRanked, params);
      return {
        offers: exact,
        exactOffers: Promise.resolve(exact),
        priceSortPending: false,
      };
    }

    const worksetWork =
      workset.length > 0
        ? priceLiveRequiredMatchset(workset, params, {
            fetchImpl: options.fetchImpl,
            pricingRunId: pricingRun.runId,
            lane: 'P1',
          })
        : Promise.resolve(workset);

    // One orchestrator after workset — replaces prior dual S6 + full-pool schedules.
    scheduleCappedMatchsetLiveAfterPage(catalogRanked, params, {
      fetchImpl: options.fetchImpl,
      cheapestFirst: isSharedLivePricingPoolSort(params.sort),
      pricingRun,
      afterPageOverlays: worksetWork,
      headstartMs: 0,
    });

    const exactOffers = worksetWork.then(() => assemblePriceSortRanking(catalogRanked, params));
    return {
      offers: catalogRanked,
      exactOffers,
      priceSortPending: true,
    };
  }

  const ranked = rankResultsOffers(offers, params);
  // GO5: do NOT schedule matchset-wide live here. CatalogLiveBody starts page
  // overlays first, then scheduleCappedMatchsetLiveAfterPage (P1→P2).
  return {
    offers: ranked,
    exactOffers: Promise.resolve(ranked),
    priceSortPending: false,
  };
}
