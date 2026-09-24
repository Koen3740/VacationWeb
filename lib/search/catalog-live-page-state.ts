/**
 * GO5: shared Results catalog page state (hydrate + B-slice + overlay candidates).
 * React cache() so heading + CatalogLiveBody share one hydrate per request.
 */
import { cache } from 'react';
import {
  RESULTS_PRODUCT_PAGE_SIZE,
  startCatalogPageLiveOverlays,
  type CatalogPageLiveOverlay,
} from '@/lib/providers/prijsvrij';
import {
  bookableResultsMembership,
  selectCatalogPageHydrationIds,
  selectPage1OverlayCandidates,
  selectPaintAlignedPageOverlayCandidates,
  sliceRankedCatalogResultsPage,
  type RankedCatalogResultsPage,
} from '@/lib/search/results-catalog-page';
import { hydrateResultsLivePriceOverlaysFromL2 } from '@/lib/search/results-live-price-cache';
import { repairPage1FreezeOrder } from '@/lib/search/page1-freeze-repair';
import {
  paginateResults,
  RESULTS_BROWSE_PRESENTABLE_CAP,
  RESULTS_USER_PAGINATION_CAP,
} from '@/lib/search/pagination';
import type { SearchParams, TravelOffer } from '@/types/travel';

export type CatalogLivePageState = {
  hydrationIds: string[];
  catalogPage: RankedCatalogResultsPage;
  overlayCandidates: TravelOffer[];
  streamOffers: TravelOffer[];
  overlays: CatalogPageLiveOverlay[];
};

function resultsTimingEnabled(): boolean {
  return process.env.VACATIONWEB_RESULTS_TIMING === '1';
}

function logTiming(payload: Record<string, unknown>): void {
  if (!resultsTimingEnabled()) return;
  console.info('[results-timing]', JSON.stringify(payload));
}

/**
 * Per-request memoized page-window hydrate + slice.
 * GO10: page-1 applies `page1Ids` freeze repair against the current B pool so a
 * stale freeze never yields an empty card list while heading/paginationTotal > 0.
 */
export const loadCatalogLivePageState = cache(
  async (
    filtered: TravelOffer[],
    filteringParams: SearchParams,
    params: SearchParams,
    page: number,
    pageSize: number,
    isPage1: boolean,
  ): Promise<CatalogLivePageState> => {
    const t0 = Date.now();
    const safePageSize = pageSize || RESULTS_PRODUCT_PAGE_SIZE;
    const hydrationIds = selectCatalogPageHydrationIds(
      filtered,
      isPage1 ? 1 : page,
      safePageSize,
      undefined,
      filteringParams,
    );
    const tHydrate0 = Date.now();
    const hydrateStats = await hydrateResultsLivePriceOverlaysFromL2(
      hydrationIds,
      filteringParams,
      { offers: filtered },
    );
    const hydrateMs = Date.now() - tHydrate0;

    // GO11: B membership over the FULL matchset (pool). Browse/display cap = 150
    // presentable cards (not a pool/heading cap). Page hydrate stays page-scoped above.
    const bookable = bookableResultsMembership(filtered, filteringParams);
    const browseCap =
      typeof RESULTS_BROWSE_PRESENTABLE_CAP === 'number'
        ? RESULTS_BROWSE_PRESENTABLE_CAP
        : RESULTS_USER_PAGINATION_CAP;
    const browsable = bookable.slice(0, browseCap);

    let catalogPage: RankedCatalogResultsPage;
    if (isPage1) {
      const repaired = repairPage1FreezeOrder({
        presentableOrdered: browsable,
        frozenIds: params.page1Ids,
        pageSize: safePageSize,
      });
      catalogPage = {
        offers: repaired.offers,
        page1Ids: repaired.page1Ids,
        paginationTotal: browsable.length,
      };
    } else {
      const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
      catalogPage = {
        offers: paginateResults(browsable, safePage, safePageSize),
        page1Ids: paginateResults(browsable, 1, safePageSize).map((offer) => offer.id),
        paginationTotal: browsable.length,
      };
    }

    const overlayCandidates = isPage1
      ? selectPage1OverlayCandidates(filtered, safePageSize, undefined, filteringParams)
      : selectPaintAlignedPageOverlayCandidates(
          filtered,
          catalogPage.offers,
          safePageSize,
          undefined,
          filteringParams,
        );

    // Prefer repaired/frozen page offers; fall back to overlay candidates only when
    // the B pool is still empty (cold L2) so Cap can still settle cards.
    const streamOffers =
      catalogPage.offers.length > 0
        ? catalogPage.offers
        : overlayCandidates.slice(0, safePageSize);

    const tOverlay0 = Date.now();
    const overlays = startCatalogPageLiveOverlays(
      overlayCandidates.length > 0 ? overlayCandidates : streamOffers,
      params,
    );
    const overlayStartMs = Date.now() - tOverlay0;

    logTiming({
      phase: 'catalog-live-page-state',
      matchset: filtered.length,
      hydrationIds: hydrationIds.length,
      pageOffers: catalogPage.offers.length,
      paginationTotal: catalogPage.paginationTotal,
      overlayCandidates: overlayCandidates.length,
      hydrateMs,
      hydrateChecked: hydrateStats.checked,
      hydrateHydrated: hydrateStats.hydrated,
      overlayStartMs,
      totalMs: Date.now() - t0,
      page,
      pageSize: safePageSize,
      frozenIds: params.page1Ids?.length ?? 0,
    });

    return {
      hydrationIds,
      catalogPage,
      overlayCandidates,
      streamOffers,
      overlays,
    };
  },
);

/**
 * Presentable (B) browse count — same source as paginationTotal / cards (≤150).
 * GO11: heading no longer uses this (heading = pool/matchset size). Kept for
 * pagination/card alignment + GO9 cold settle (await overlays before claiming 0 B).
 * GO10: freeze repair remains in loadCatalogLivePageState.
 */
export async function loadPresentableResultsCount(
  filtered: TravelOffer[],
  filteringParams: SearchParams,
  params: SearchParams,
  page: number,
  pageSize: number,
  isPage1: boolean,
): Promise<number> {
  const state = await loadCatalogLivePageState(
    filtered,
    filteringParams,
    params,
    page,
    pageSize,
    isPage1,
  );
  let total = state.catalogPage.paginationTotal;
  if (total === 0 && state.overlayCandidates.length > 0 && state.overlays.length > 0) {
    await Promise.all(state.overlays.map((overlay) => overlay.live));
    const settledPage = sliceRankedCatalogResultsPage(
      filtered,
      isPage1 ? 1 : page,
      pageSize || RESULTS_PRODUCT_PAGE_SIZE,
      filteringParams,
    );
    total = settledPage.paginationTotal;
  }
  return total;
}
