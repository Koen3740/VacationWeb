import { paginateResults, RESULTS_PAGE_SIZE_DEFAULT } from '@/lib/search/pagination';
import {
  filterToResultsListableOffers,
  hasValidPresentablePrice,
  isResultsListableOffer,
} from '@/lib/search/presentable-price';
import { applyResultsLivePriceOverlays } from '@/lib/search/results-live-price-cache';
import type { SearchParams, TravelOffer } from '@/types/travel';

export type RankedCatalogResultsPage = {
  offers: TravelOffer[];
  page1Ids: string[];
  paginationTotal: number;
};

export type ResultsPipelineCounts = {
  /** Ranked pool after filter + sort (before listability). */
  afterCatalogFilter: number;
  /** Offers admitted for provisional overlay (catalog / unset / proven presentable). */
  afterListabilityFilter: number;
  /** Offers with cached proven live p.p. + total. */
  afterPresentableFilter: number;
  /** Ordered browse pool (presentable → pending → settled); equals ranked.length. */
  afterPaginationOrder: number;
  pageSize: number;
  pageSliceSize: number;
};

/** Reserve candidates beyond page 1 for live overlay backfill when primary slots fail. */
export const PAGE1_OVERLAY_RESERVE = 10;

/**
 * Pagination / browse pool for a ranked filter matchset.
 *
 * Presentable offers first, then other listable (catalog/pending), then
 * settled live failures. Length always equals the ranked matchset — live
 * pricing must not shrink result count or pagination totals.
 */
export function orderCatalogPageCandidates(
  ranked: readonly TravelOffer[],
  params?: SearchParams,
): TravelOffer[] {
  const overlaid = params
    ? applyResultsLivePriceOverlays(ranked as TravelOffer[], params)
    : (ranked as TravelOffer[]);
  const presentable: TravelOffer[] = [];
  const pending: TravelOffer[] = [];
  const settled: TravelOffer[] = [];

  for (const offer of overlaid) {
    if (hasValidPresentablePrice(offer)) {
      presentable.push(offer);
      continue;
    }
    if (isResultsListableOffer(offer)) {
      pending.push(offer);
      continue;
    }
    settled.push(offer);
  }

  return [...presentable, ...pending, ...settled];
}

export function measureResultsPipelineCounts(
  ranked: readonly TravelOffer[],
  params: SearchParams,
  page: number,
  pageSize: number,
): ResultsPipelineCounts {
  const listable = filterToResultsListableOffers(ranked as TravelOffer[]);
  const overlaid = applyResultsLivePriceOverlays(ranked as TravelOffer[], params);
  const ordered = orderCatalogPageCandidates(ranked, params);
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

  return {
    afterCatalogFilter: ranked.length,
    afterListabilityFilter: listable.length,
    afterPresentableFilter: overlaid.filter(hasValidPresentablePrice).length,
    /** Always equals ranked.length — settled live failures stay in the browse pool. */
    afterPaginationOrder: ordered.length,
    pageSize,
    pageSliceSize: paginateResults(ordered, safePage, pageSize).length,
  };
}

/**
 * Ranked catalog slice for a Results page.
 * Presentable offers are prioritized so page 1 can fill when cached live prices exist
 * beyond the first rank-order slots.
 */
export function sliceRankedCatalogResultsPage(
  ranked: readonly TravelOffer[],
  page: number,
  pageSize: number = RESULTS_PAGE_SIZE_DEFAULT,
  params?: SearchParams,
): RankedCatalogResultsPage {
  const ordered = orderCatalogPageCandidates(ranked, params);
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const offers = paginateResults(ordered, safePage, pageSize);
  return {
    offers,
    page1Ids: paginateResults(ordered, 1, pageSize).map((offer) => offer.id),
    paginationTotal: ordered.length,
  };
}

/** Page-1 live overlay window: primary slice plus reserve for backfill. */
export function selectPage1OverlayCandidates(
  ordered: readonly TravelOffer[],
  pageSize: number,
  reserve: number = PAGE1_OVERLAY_RESERVE,
): TravelOffer[] {
  const windowSize = Math.min(ordered.length, pageSize + reserve);
  return ordered.slice(0, windowSize) as TravelOffer[];
}
