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
import {
  applyResultsLivePriceOverlay,
  hydrateResultsLivePriceOverlaysFromL2,
  resultsPageL2HydrateBudgetMs,
} from '@/lib/search/results-live-price-cache';
import {
  isFrozenPage1StatusUnknown,
  repairPage1FreezeOrder,
  repairPage2Page1Membership,
  selectBrowsePageWithPage1Freeze,
} from '@/lib/search/page1-freeze-repair';
import {
  buildPage1SlotOffers,
  createPage1SettleController,
  isPage1VisibleOffer,
  type Page1SettleController,
} from '@/lib/search/page-settle';
import {
  paginateResults,
  RESULTS_BROWSE_PRESENTABLE_CAP,
  RESULTS_USER_PAGINATION_CAP,
  resultsHasMore,
} from '@/lib/search/pagination';
import type { SearchParams, TravelOffer } from '@/types/travel';

export type CatalogLivePageState = {
  hydrationIds: string[];
  catalogPage: RankedCatalogResultsPage;
  overlayCandidates: TravelOffer[];
  streamOffers: TravelOffer[];
  overlays: CatalogPageLiveOverlay[];
  /**
   * D-v2 S4: Page-1 settle controller (page 1 only). Drives slot CUT, the final
   * selection, page1Ids write policy and pagination-at-settle. Undefined on page 2+.
   */
  page1Settle?: Page1SettleController;
  /** D-v2 S4: current browse B total (GO11 cap 150), recomputed on call (at settle). */
  computeBrowseTotal: () => number;
  /**
   * D-v2 S5: frozen page1Ids still in the matchset with unknown live status (kept as
   * pending anchors; page 1 gives them a live overlay, page 2+ excludes them).
   */
  pendingFrozenIds: string[];
  /**
   * D-v2 S5 (Master Plan r.706): cold Page 2+ (no page1Ids param). The page-1 pipeline
   * runs once (page-1 slots + overlays + settle controller); the caller redirects to the
   * same page with the resulting page1Ids. Page-2 overlays are not started.
   */
  coldPage2Page1Settle?: Page1SettleController;
  /**
   * D-v2 S5: cold Page 2+ fallback when no page1Ids may be written (recomputed on call).
   * D-v2 A-38: `excludedPage1Ids` = the recomputed page-1 selection (never on page 2+).
   */
  recomputeBrowsePage?: (excludedPage1Ids?: readonly string[]) => {
    offers: TravelOffer[];
    paginationTotal: number;
    hasMore: boolean;
  };
  /**
   * D-v2 hasMore (owner 25-09 18:50), page 2+ only: more B in the valid paginated
   * presentable pool beyond this page's window (page1Ids excluded when frozen).
   * Page 1 computes it at settle (`page1HasMore`).
   */
  hasMore?: boolean;
};

function browseCapValue(): number {
  return typeof RESULTS_BROWSE_PRESENTABLE_CAP === 'number'
    ? RESULTS_BROWSE_PRESENTABLE_CAP
    : RESULTS_USER_PAGINATION_CAP;
}

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
    const windowHydrationIds = selectCatalogPageHydrationIds(
      filtered,
      isPage1 ? 1 : page,
      safePageSize,
      undefined,
      filteringParams,
    );
    // D-v2 S6 (plan section 10): frozen page1Ids are hydrated too, so a frozen anchor
    // outside the window is known (B / A / C) instead of unknown when R2 answers.
    const hydrationIds = [...new Set([...windowHydrationIds, ...(params.page1Ids ?? [])])];
    const hydrateBudgetMs = resultsPageL2HydrateBudgetMs(isPage1, params.page1Ids);
    const tHydrate0 = Date.now();
    const hydrateStats = await hydrateResultsLivePriceOverlaysFromL2(
      hydrationIds,
      filteringParams,
      { offers: filtered, budgetMs: hydrateBudgetMs },
    );
    const hydrateMs = Date.now() - tHydrate0;

    // GO11: B membership over the FULL matchset (pool). Browse/display cap = 150
    // presentable cards (not a pool/heading cap). Page hydrate stays page-scoped above.
    const bookable = bookableResultsMembership(filtered, filteringParams);
    const browseCap = browseCapValue();
    const browsable = bookable.slice(0, browseCap);
    // D-v2 S4: same membership/cap, evaluated when called (Page-1 settle time), so a
    // temporary cold B=0 at request start never freezes paginationTotal at 0.
    const computeBrowseTotal = () =>
      bookableResultsMembership(filtered, filteringParams).slice(0, browseCap).length;

    // D-v2 S5 (GO10 amendment, review C): frozen ids that are in the matchset but not
    // (yet) in the B pool with an UNKNOWN live status stay as pending anchors; known
    // non-B (A / C / unpriced / parked) and ids outside the matchset are dropped (GO10).
    const pendingFrozen = new Map<string, TravelOffer>();
    const frozenParamIds = params.page1Ids ?? [];
    if (frozenParamIds.length > 0) {
      const browsableIds = new Set(browsable.map((offer) => offer.id));
      const matchsetById = new Map(filtered.map((offer) => [offer.id, offer]));
      for (const id of frozenParamIds) {
        if (browsableIds.has(id) || pendingFrozen.has(id)) continue;
        const offer = matchsetById.get(id);
        if (offer && isFrozenPage1StatusUnknown(applyResultsLivePriceOverlay(offer, filteringParams))) {
          pendingFrozen.set(id, offer);
        }
      }
    }

    const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
    // D-v2 S5: page 2+ without any page1Ids param = cold page 2 (Master Plan r.706).
    const isColdPage2 = !isPage1 && frozenParamIds.length === 0;
    let catalogPage: RankedCatalogResultsPage;
    let page2Page1Ids: string[] = [];
    let page2HasMore: boolean | undefined;
    if (isPage1) {
      const repaired = repairPage1FreezeOrder({
        presentableOrdered: browsable,
        frozenIds: params.page1Ids,
        pageSize: safePageSize,
        pendingFrozen,
      });
      catalogPage = {
        offers: repaired.offers,
        page1Ids: repaired.page1Ids,
        paginationTotal: browsable.length,
      };
    } else if (!isColdPage2) {
      // D-v2 S5 (Package 1, Master Plan r.696-704): page 2+ = current B pool minus the
      // (GO10-repaired) page-1 ids; page-1 offers never appear on page 2+.
      // D-v2 A-38: with pending anchors the page-1 membership also holds the extra B a
      // page-1 render shows in their place (deterministic recomputation, no URL write).
      const repaired = repairPage2Page1Membership({
        presentableOrdered: browsable,
        frozenIds: params.page1Ids,
        pageSize: safePageSize,
        pendingFrozen,
      });
      if (repaired.usedFreeze) {
        page2Page1Ids = repaired.page1Ids;
        const remainingPage = selectBrowsePageWithPage1Freeze({
          browsable,
          page1Ids: page2Page1Ids,
          page: safePage,
          pageSize: safePageSize,
          browseCap,
        });
        catalogPage = {
          offers: remainingPage.offers,
          page1Ids: page2Page1Ids,
          paginationTotal: remainingPage.paginationTotal,
        };
        // page N shows remaining[(N-2)*size, (N-1)*size)
        page2HasMore = resultsHasMore({
          presentableCount: remainingPage.remaining.length,
          windowEnd: (safePage - 1) * safePageSize,
          page: safePage,
        });
      } else {
        // page1Ids present but unusable (all stale): no redirect (loop guard) and no
        // snapshot page1Ids write; browse slice as before.
        page2Page1Ids = paginateResults(browsable, 1, safePageSize).map((offer) => offer.id);
        catalogPage = {
          offers: paginateResults(browsable, safePage, safePageSize),
          page1Ids: [],
          paginationTotal: browsable.length,
        };
        page2HasMore = resultsHasMore({
          presentableCount: browsable.length,
          windowEnd: safePage * safePageSize,
          page: safePage,
        });
      }
    } else {
      // Cold page 2: snapshot only for count consumers; the section redirects after the
      // page-1 pipeline settles (no snapshot page1Ids write).
      catalogPage = {
        offers: paginateResults(browsable, safePage, safePageSize),
        page1Ids: [],
        paginationTotal: browsable.length,
      };
    }

    const page2ExcludedIds = new Set(page2Page1Ids);
    const overlayCandidates =
      isPage1 || isColdPage2
        ? selectPage1OverlayCandidates(filtered, safePageSize, undefined, filteringParams)
        : selectPaintAlignedPageOverlayCandidates(
            filtered,
            catalogPage.offers,
            safePageSize,
            undefined,
            filteringParams,
          ).filter((offer) => !page2ExcludedIds.has(offer.id));

    // Prefer repaired/frozen page offers; fall back to overlay candidates only when
    // the B pool is still empty (cold L2) so Cap can still settle cards.
    const streamOffers =
      catalogPage.offers.length > 0
        ? catalogPage.offers
        : overlayCandidates.slice(0, safePageSize);

    // D-v2 S4: Page-1 slots in catalogue/rank order (snapshot B never first unless a
    // valid page1Ids freeze exists; GO10 repair kept inside buildPage1SlotOffers).
    // D-v2 S5: cold page 2 runs the same page-1 slot pipeline (unfrozen) once.
    const page1Slots =
      isPage1 || isColdPage2
        ? buildPage1SlotOffers({
            browsable,
            overlayCandidates,
            frozenIds: isPage1 ? params.page1Ids : undefined,
            pageSize: safePageSize,
            pendingFrozen: isPage1 ? pendingFrozen : undefined,
          })
        : undefined;

    const tOverlay0 = Date.now();
    // Overlay input unchanged (S4 does not change which offers go live); slot offers
    // without an overlay (B outside the window) render as settled/immediate.
    // D-v2 S5: pending frozen page-1 anchors outside the window also get a live overlay
    // so they settle (B -> kept in place; A/C -> dropped by the settle selection).
    const baseOverlayInput = overlayCandidates.length > 0 ? overlayCandidates : streamOffers;
    const baseOverlayIds = new Set(baseOverlayInput.map((offer) => offer.id));
    const pendingFrozenExtra =
      isPage1 && page1Slots
        ? page1Slots.pendingFrozenIds
            .filter((id) => !baseOverlayIds.has(id))
            .map((id) => pendingFrozen.get(id))
            .filter((offer): offer is TravelOffer => !!offer)
        : [];
    const overlays = startCatalogPageLiveOverlays(
      pendingFrozenExtra.length > 0 ? [...baseOverlayInput, ...pendingFrozenExtra] : baseOverlayInput,
      params,
    );
    const overlayStartMs = Date.now() - tOverlay0;

    // D-v2 S4: deadline counted from overlay start (plan: PAGE1_SETTLE_DEADLINE_MS).
    const visibleParams: SearchParams = { ...params, pageSize: safePageSize };
    const page1Settle = page1Slots
      ? createPage1SettleController({
          slotOffers: page1Slots.slotOffers,
          overlays,
          pageSize: safePageSize,
          isPresentable: (offer) => isPage1VisibleOffer(offer, visibleParams),
        })
      : undefined;

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
      hydrateBudgetMs: hydrateBudgetMs ?? null,
      hydrateAttempts: hydrateStats.attempts ?? 0,
      hydrateTimedOut: hydrateStats.timedOut ?? 0,
      hydrateGetTimeouts: hydrateStats.getTimeouts ?? 0,
      hydrateBudgetHit: hydrateStats.budgetHit ?? false,
      overlayStartMs,
      totalMs: Date.now() - t0,
      page,
      pageSize: safePageSize,
      frozenIds: params.page1Ids?.length ?? 0,
      page1Slots: page1Slots?.slotOffers.length,
      page1UsedFreeze: page1Slots?.usedFreeze,
    });
    if (page1Settle && resultsTimingEnabled()) {
      void page1Settle.selection.then((selection) =>
        logTiming({
          phase: 'page1-settle',
          status: selection.status,
          selected: selection.selectedIds.length,
          pendingRanks: selection.pendingRanks.length,
          settledB: selection.settledPresentableCount,
          settleMs: Date.now() - tOverlay0,
        }),
      );
    }

    const recomputeBrowsePage = isColdPage2
      ? (excludedPage1Ids: readonly string[] = []) => {
          const nowBrowsable = bookableResultsMembership(filtered, filteringParams).slice(
            0,
            browseCap,
          );
          if (excludedPage1Ids.length === 0) {
            return {
              offers: paginateResults(nowBrowsable, safePage, safePageSize),
              paginationTotal: nowBrowsable.length,
              hasMore: resultsHasMore({
                presentableCount: nowBrowsable.length,
                windowEnd: safePage * safePageSize,
                page: safePage,
              }),
            };
          }
          // D-v2 A-38 fix (option d, Package 1): nothing is written to the URL, but page 2+
          // = current B pool minus the page-1 selection recomputed by this same pipeline.
          const poolIds = new Set(nowBrowsable.map((offer) => offer.id));
          const remainingPage = selectBrowsePageWithPage1Freeze({
            browsable: nowBrowsable,
            page1Ids: excludedPage1Ids.filter((id) => poolIds.has(id)),
            page: safePage,
            pageSize: safePageSize,
            browseCap,
          });
          return {
            offers: remainingPage.offers,
            paginationTotal: remainingPage.paginationTotal,
            hasMore: resultsHasMore({
              presentableCount: remainingPage.remaining.length,
              windowEnd: (safePage - 1) * safePageSize,
              page: safePage,
            }),
          };
        }
      : undefined;

    return {
      hydrationIds,
      catalogPage,
      overlayCandidates,
      streamOffers,
      overlays,
      page1Settle: isPage1 ? page1Settle : undefined,
      computeBrowseTotal,
      pendingFrozenIds: page1Slots?.pendingFrozenIds ?? [...pendingFrozen.keys()].filter((id) => page2ExcludedIds.has(id)),
      coldPage2Page1Settle: isColdPage2 ? page1Settle : undefined,
      recomputeBrowsePage,
      hasMore: page2HasMore,
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
