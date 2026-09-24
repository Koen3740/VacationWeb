import {
  paginateResults,
  RESULTS_LIVE_PRICING_CANDIDATE_CAP,
  RESULTS_USER_PAGINATION_CAP,
  RESULTS_PAGE_SIZE_DEFAULT,
} from '@/lib/search/pagination';
import {
  filterToResultsListableOffers,
  hasValidPresentablePrice,
  isResultsLivePriceCandidateOffer,
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
  /** Presentable B pool (card admission). */
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
 * live-price overlay candidates. Does not change matchset membership.
 */
export const PAGE_OVERLAY_SCAN_LIMIT = 120;

/**
 * Display ordering helper for a ranked filter matchset.
 *
 * Membership is ALWAYS the full ranked set (same IDs as `filterOffers` + sort).
 * Live overlays may only change relative order
 * (presentable B → live-price candidates → A/parked) for paint priority —
 * never add/remove members. Sort mode must not change which offers belong to
 * the resultset.
 */
export function orderCatalogPageCandidates(
  ranked: readonly TravelOffer[],
  params?: SearchParams,
): TravelOffer[] {
  const overlaid = params
    ? applyResultsLivePriceOverlays(ranked as TravelOffer[], params)
    : (ranked as TravelOffer[]);
  const presentable: TravelOffer[] = [];
  const candidates: TravelOffer[] = [];
  const excluded: TravelOffer[] = [];

  for (const offer of overlaid) {
    if (hasValidPresentablePrice(offer)) {
      presentable.push(offer);
      continue;
    }
    if (isResultsLivePriceCandidateOffer(offer)) {
      candidates.push(offer);
      continue;
    }
    excluded.push(offer);
  }

  return [...presentable, ...candidates, ...excluded];
}

/**
 * Collect live-price overlay candidates in ranked sort order.
 * Includes pending / C / B (not A) so overlays can start and Cap can backfill
 * presentable B without shrinking the filter matchset used for heading counts.
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
    if (isResultsLivePriceCandidateOffer(offer)) {
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
  const listable = filterToResultsListableOffers(
    applyResultsLivePriceOverlays(ranked as TravelOffer[], params),
  );
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
 * Presentable Results membership for pagination (B only):
 * ranked filter matchset → apply live overlays → keep proven presentable B.
 * A / C / Pending stay in the underlying matchset but never occupy a page slot.
 */
export function bookableResultsMembership(
  ranked: readonly TravelOffer[],
  params?: SearchParams,
): TravelOffer[] {
  const overlaid = params
    ? applyResultsLivePriceOverlays(ranked as TravelOffer[], params)
    : (ranked as TravelOffer[]);
  return filterToResultsListableOffers(overlaid);
}

/**
 * Page slice of the presentable (B) Results pool.
 *
 * Paginate in sort order (not live-presentable-first reorder of the matchset)
 * so price sorts keep their ordering. paginationTotal is the B pool length.
 */
export function sliceRankedCatalogResultsPage(
  ranked: readonly TravelOffer[],
  page: number,
  pageSize: number = RESULTS_PAGE_SIZE_DEFAULT,
  params?: SearchParams,
): RankedCatalogResultsPage {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  // GO11: B membership over the FULL matchset; browse/display cap = 150 cards.
  // Heading uses pool size separately (results-pool-count) — not this total.
  const bookable = bookableResultsMembership(ranked, params);
  const browsable = bookable.slice(0, RESULTS_USER_PAGINATION_CAP);
  const offers = paginateResults(browsable, safePage, pageSize);
  return {
    offers,
    page1Ids: paginateResults(browsable, 1, pageSize).map((offer) => offer.id),
    paginationTotal: browsable.length,
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

/**
 * Bounded offer IDs to L2→L1 hydrate before catalog page slice (GO2 defect 1).
 * Covers early live-price candidates that can enter the B pool up to this page,
 * plus reserve — not a full-matchset hydrate.
 */
export function selectCatalogPageHydrationIds(
  ranked: readonly TravelOffer[],
  page: number,
  pageSize: number,
  reserve: number = PAGE1_OVERLAY_RESERVE,
  params?: SearchParams,
): string[] {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const need = safePage * Math.max(0, pageSize) + Math.max(0, reserve);
  if (need <= 0) {
    return [];
  }
  return collectListablePaintWindow(ranked, 0, need, params).map((offer) => offer.id);
}

/**
 * GO2 Page 2+: overlay candidates aligned to the painted B-only page.
 *
 * PRIMARY = exact offers on `paintedPage` (B IDs that Results paints).
 * RESERVE = further live-price candidates (Pending/C/B, not A) from the matchset
 * AFTER the last painted offer — preserves Cap/reserve without making the window
 * B-only, and without the absolute `(page-1)*pageSize` matchset offset that
 * pulled earlier Page-1 B offers into the leading reserve.
 *
 * Page 1 continues to use {@link selectPage1OverlayCandidates}.
 * {@link selectPageOverlayCandidates} remains the legacy absolute-offset helper.
 */
export function selectPaintAlignedPageOverlayCandidates(
  ranked: readonly TravelOffer[],
  paintedPage: readonly TravelOffer[],
  pageSize: number,
  reserve: number = PAGE1_OVERLAY_RESERVE,
  params?: SearchParams,
): TravelOffer[] {
  const need = Math.max(0, pageSize) + Math.max(0, reserve);
  if (need <= 0) {
    return [];
  }

  const overlaidRanked = params
    ? applyResultsLivePriceOverlays(ranked as TravelOffer[], params)
    : (ranked as TravelOffer[]);
  const overlaidPainted = params
    ? applyResultsLivePriceOverlays(paintedPage as TravelOffer[], params)
    : (paintedPage as TravelOffer[]);

  const primaryOffers = overlaidPainted.filter(isResultsLivePriceCandidateOffer);
  const primaryIds = new Set(primaryOffers.map((offer) => offer.id));

  let startScan = 0;
  if (overlaidPainted.length > 0) {
    const lastId = overlaidPainted[overlaidPainted.length - 1]!.id;
    const lastIdx = overlaidRanked.findIndex((offer) => offer.id === lastId);
    startScan = lastIdx >= 0 ? lastIdx + 1 : overlaidRanked.length;
  } else {
    // Empty B page: scan after the last presentable B so Cap can still discover
    // Pending/C beyond the current B pool (not matchset page-offset).
    let lastBIdx = -1;
    for (let index = 0; index < overlaidRanked.length; index += 1) {
      if (hasValidPresentablePrice(overlaidRanked[index]!)) {
        lastBIdx = index;
      }
    }
    startScan = lastBIdx >= 0 ? lastBIdx + 1 : 0;
  }

  const reserveNeed = Math.max(0, need - primaryOffers.length);
  const reserveOffers = collectListablePaintWindow(
    overlaidRanked,
    startScan,
    reserveNeed,
    undefined,
  ).filter((offer) => !primaryIds.has(offer.id));

  return [...primaryOffers, ...reserveOffers].slice(0, need);
}
