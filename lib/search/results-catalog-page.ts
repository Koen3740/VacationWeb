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
  /**
   * Ordered browse / pagination pool. Equals the ranked filter matchset length —
   * live settlement must not change membership or sort-dependent counts.
   */
  afterPaginationOrder: number;
  pageSize: number;
  pageSliceSize: number;
};

/** Reserve candidates beyond a page slice for live overlay backfill when primary slots fail. */
export const PAGE1_OVERLAY_RESERVE = 40;

/**
 * Max extra ranked offers to scan past the primary page window when collecting
 * listable paint/overlay candidates. Does not change membership or paginationTotal.
 */
export const PAGE_OVERLAY_SCAN_LIMIT = 120;

/**
 * Display ordering helper for a ranked filter matchset.
 *
 * Membership is ALWAYS the full ranked set (same IDs as `filterOffers` + sort).
 * Live overlays may only change relative order (presentable → pending → settled)
 * for paint priority — never add/remove members. Sort mode must not change
 * which offers belong to the resultset.
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

/**
 * Collect listable paint/overlay candidates in ranked sort order.
 * Skips settled non-listable shells so reserve can backfill cards without
 * shrinking the filter matchset used for counts/pagination.
 */
export function collectListablePaintWindow(
  ranked: readonly TravelOffer[],
  startIndex: number,
  need: number,
  params?: SearchParams,
  scanLimit: number = PAGE_OVERLAY_SCAN_LIMIT,
): TravelOffer[] {
  if (need <= 0 || startIndex >= ranked.length) {
    return [];
  }
  const overlaid = params
    ? applyResultsLivePriceOverlays(ranked as TravelOffer[], params)
    : (ranked as TravelOffer[]);
  const end = Math.min(overlaid.length, Math.max(startIndex, 0) + Math.max(scanLimit, need));
  const selected: TravelOffer[] = [];
  for (let index = Math.max(startIndex, 0); index < end && selected.length < need; index += 1) {
    const offer = overlaid[index];
    if (isResultsListableOffer(offer)) {
      selected.push(offer);
    }
  }
  return selected;
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
    afterPaginationOrder: ordered.length,
    pageSize,
    pageSliceSize: paginateResults(ranked as TravelOffer[], safePage, pageSize).length,
  };
}

/**
 * Page slice of the ranked filter matchset.
 *
 * Paginate in sort order (not live-presentable-first) so price sorts keep their
 * ordering. paginationTotal is always the full matchset length.
 */
export function sliceRankedCatalogResultsPage(
  ranked: readonly TravelOffer[],
  page: number,
  pageSize: number = RESULTS_PAGE_SIZE_DEFAULT,
  _params?: SearchParams,
): RankedCatalogResultsPage {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const offers = paginateResults(ranked as TravelOffer[], safePage, pageSize);
  return {
    offers,
    page1Ids: paginateResults(ranked as TravelOffer[], 1, pageSize).map((offer) => offer.id),
    paginationTotal: ranked.length,
  };
}

/** Page-1 live overlay window: primary slice plus reserve for backfill. */
export function selectPage1OverlayCandidates(
  ordered: readonly TravelOffer[],
  pageSize: number,
  reserve: number = PAGE1_OVERLAY_RESERVE,
  params?: SearchParams,
): TravelOffer[] {
  return collectListablePaintWindow(ordered, 0, pageSize + reserve, params);
}

/**
 * Overlay candidate window for an arbitrary page.
 *
 * Same idea as `selectPage1OverlayCandidates`, but starting at the page offset,
 * so that live-price failures on intermediate pages can be backfilled from
 * later listable candidates without leaving mostly-empty pages.
 */
export function selectPageOverlayCandidates(
  ordered: readonly TravelOffer[],
  page: number,
  pageSize: number,
  reserve: number = PAGE1_OVERLAY_RESERVE,
  params?: SearchParams,
): TravelOffer[] {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const startIndex = (safePage - 1) * pageSize;
  return collectListablePaintWindow(ordered, startIndex, pageSize + reserve, params);
}
