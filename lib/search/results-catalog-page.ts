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
  /** Listable offers ordered for pagination (presentable first, then pending). */
  afterPaginationOrder: number;
  pageSize: number;
  pageSliceSize: number;
};

/** Reserve candidates beyond page 1 for live overlay backfill when primary slots fail. */
export const PAGE1_OVERLAY_RESERVE = 10;

/**
 * Pagination pool: proven presentable offers first (stable), then catalog/pending listable.
 * Settled unavailable / unpriced offers are excluded.
 */
export function orderCatalogPageCandidates(
  ranked: readonly TravelOffer[],
  params?: SearchParams,
): TravelOffer[] {
  const listable = filterToResultsListableOffers(ranked as TravelOffer[]);
  const overlaid = params ? applyResultsLivePriceOverlays(listable, params) : listable;
  const presentable: TravelOffer[] = [];
  const pending: TravelOffer[] = [];

  for (const offer of overlaid) {
    if (hasValidPresentablePrice(offer)) {
      presentable.push(offer);
      continue;
    }
    if (isResultsListableOffer(offer)) {
      pending.push(offer);
    }
  }

  return [...presentable, ...pending];
}

export function measureResultsPipelineCounts(
  ranked: readonly TravelOffer[],
  params: SearchParams,
  page: number,
  pageSize: number,
): ResultsPipelineCounts {
  const listable = filterToResultsListableOffers(ranked as TravelOffer[]);
  const overlaid = applyResultsLivePriceOverlays(listable, params);
  const ordered = orderCatalogPageCandidates(ranked, params);
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

  return {
    afterCatalogFilter: ranked.length,
    afterListabilityFilter: listable.length,
    afterPresentableFilter: overlaid.filter(hasValidPresentablePrice).length,
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
