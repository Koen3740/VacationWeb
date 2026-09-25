import { Page1ResultsCap } from '@/components/results/page1-results-cap';
import { ResultsPagination } from '@/components/results/results-pagination';
import { SyncPage1IdsToUrl } from '@/components/results/sync-page1-ids-to-url';
import { TravelCard } from '@/components/results/travel-card';
import type { CatalogPageLiveOverlay } from '@/lib/providers/prijsvrij';
import { RESULTS_PRODUCT_PAGE_SIZE } from '@/lib/providers/prijsvrij';
import {
  isPage1VisibleOffer,
  PAGE1_DEADLINE_EMPTY_STATUS_TEXT,
  page1HasMore,
  pendingSlotIdsForSettle,
  resolvePage1SettleOutput,
  type Page1SettleController,
} from '@/lib/search/page-settle';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { Suspense } from 'react';

async function OverlayTravelCard({
  live,
  searchParams,
}: {
  catalog: TravelOffer;
  /** D-v2 S4: page-1 slots pass the settle outcome (null = CUT after final selection). */
  live: Promise<TravelOffer | null>;
  searchParams?: SearchParams;
}) {
  const priced = await live;
  // Presentable B only (+ budget) — A / C / Pending / CUT settle without a card.
  // D-v2 S4: same predicate as the page-1 selection (isPage1VisibleOffer).
  if (!priced || !isPage1VisibleOffer(priced, searchParams)) {
    return null;
  }
  // Settled B only — never paint pending / C as a provisional card.
  return (
    <TravelCard
      offer={priced}
      provisional={false}
      searchParams={searchParams}
    />
  );
}

function renderCatalogOfferSlot(
  offer: TravelOffer,
  overlay: CatalogPageLiveOverlay | undefined,
  searchParams?: SearchParams,
  page1Settle?: Page1SettleController,
) {
  if (!overlay || !overlay.pending) {
    const settled = overlay?.catalog ?? offer;
    if (!isPage1VisibleOffer(settled, searchParams)) {
      return null;
    }
    return (
      <TravelCard
        offer={settled}
        provisional={false}
        searchParams={searchParams}
      />
    );
  }

  // Pending is not presentable: no provisional card while live pricing runs.
  // Cap backfills from reserve when this slot settles as B.
  return (
    <Suspense fallback={null}>
      <OverlayTravelCard
        catalog={overlay.catalog}
        live={page1Settle ? page1Settle.slotOutcome(offer.id) : overlay.live}
        searchParams={searchParams}
      />
    </Suspense>
  );
}

export function Page1ResultsStream({
  catalogOffers,
  candidateOffers,
  displayLimit = RESULTS_PRODUCT_PAGE_SIZE,
  overlays,
  searchParams,
  page1Settle,
}: {
  catalogOffers: TravelOffer[];
  /** When set, reserve candidates backfill when a primary slot settles as A. */
  candidateOffers?: TravelOffer[];
  displayLimit?: number;
  overlays: CatalogPageLiveOverlay[];
  searchParams?: SearchParams;
  /**
   * D-v2 S4 (page 1): slots come from the settle controller in catalogue/rank order;
   * pending slots render their settle outcome and are CUT once the selection is final.
   */
  page1Settle?: Page1SettleController;
}) {
  const overlayById = new Map(overlays.map((overlay) => [overlay.catalog.id, overlay]));
  let renderOffers: TravelOffer[];
  let useCap: boolean;
  if (page1Settle) {
    renderOffers = [...page1Settle.slotOffers];
    useCap = renderOffers.length > displayLimit;
  } else {
    // Paint primary page members first, then reserve for A-settlement backfill.
    const primaryIds = new Set(catalogOffers.map((offer) => offer.id));
    const reserve = (candidateOffers ?? []).filter((offer) => !primaryIds.has(offer.id));
    renderOffers = reserve.length > 0 ? [...catalogOffers, ...reserve] : catalogOffers;
    useCap = reserve.length > 0;
  }

  const slots = renderOffers.map((offer) => {
    const overlay = overlayById.get(offer.id);
    const card = renderCatalogOfferSlot(offer, overlay, searchParams, page1Settle);
    if (card == null) {
      return null;
    }
    return (
      <div key={offer.id} data-page1-slot>
        {card}
      </div>
    );
  }).filter(Boolean);

  if (useCap) {
    return <Page1ResultsCap limit={displayLimit}>{slots}</Page1ResultsCap>;
  }

  return <div className="space-y-3.5">{slots}</div>;
}

export async function Page1PaginationStream({
  params,
  page1Ids,
  paginationTotal,
  page1Settle,
  computeBrowseTotal,
  hasMore,
}: {
  params: SearchParams;
  page1Ids: string[];
  paginationTotal: number;
  /** D-v2 hasMore (owner 25-09 18:50) for page 2+ (page 1 derives it at settle). */
  hasMore?: boolean;
  /**
   * D-v2 S4 (page 1): await the final selection; write page1Ids only per the freeze
   * policy (READY/EXHAUSTED definitive, DEADLINE 1-9 anchor, option d / DEADLINE_EMPTY
   * none) and compute paginationTotal at settle time (GO11: may grow).
   */
  page1Settle?: Page1SettleController;
  computeBrowseTotal?: () => number;
}) {
  if (page1Settle) {
    const selection = await page1Settle.selection;
    const output = resolvePage1SettleOutput({
      result: selection,
      browseTotal: computeBrowseTotal ? computeBrowseTotal() : paginationTotal,
      existingPage1Ids: params.page1Ids,
      pageSize: page1Settle.pageSize,
      // D-v2 S5: a still-pending frozen anchor never causes a shorter page1Ids rewrite.
      pendingIds: pendingSlotIdsForSettle(selection, page1Settle.slotOffers),
    });
    if (output.showStatusLine) {
      // DEADLINE_EMPTY (plan section 3): status line only; no page1Ids, no pagination,
      // not the existing NoResults empty state; no auto-refresh in S4.
      return (
        <p role="status" className="py-6 text-center text-sm text-[#334155]">
          {PAGE1_DEADLINE_EMPTY_STATUS_TEXT}
        </p>
      );
    }
    return (
      <>
        <SyncPage1IdsToUrl page1Ids={output.page1Ids} replaceExisting={true} />
        {output.showPagination ? (
          <ResultsPagination
            params={{
              ...params,
              pageSize: RESULTS_PRODUCT_PAGE_SIZE,
              page1Ids: output.paginationPage1Ids,
            }}
            totalResults={output.paginationTotal}
            hasMore={page1HasMore(output, page1Settle.pageSize)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <SyncPage1IdsToUrl page1Ids={page1Ids} replaceExisting={true} />
      <ResultsPagination
        params={{ ...params, pageSize: RESULTS_PRODUCT_PAGE_SIZE, page1Ids }}
        totalResults={paginationTotal}
        hasMore={hasMore}
      />
    </>
  );
}
