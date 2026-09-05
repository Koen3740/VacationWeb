import { Page1ResultsCap } from '@/components/results/page1-results-cap';
import { ResultsPagination } from '@/components/results/results-pagination';
import { SyncPage1IdsToUrl } from '@/components/results/sync-page1-ids-to-url';
import { TravelCard } from '@/components/results/travel-card';
import type { CatalogPageLiveOverlay } from '@/lib/providers/prijsvrij';
import { RESULTS_PRODUCT_PAGE_SIZE } from '@/lib/providers/prijsvrij';
import { offerMatchesBudget } from '@/lib/search/filtering';
import {
  hasValidPresentablePrice,
  isResultsListableOffer,
} from '@/lib/search/presentable-price';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { Suspense } from 'react';

async function OverlayTravelCard({
  live,
  searchParams,
}: {
  catalog: TravelOffer;
  live: Promise<TravelOffer>;
  searchParams?: SearchParams;
}) {
  const priced = await live;
  // Only A (provider-confirmed) / parked → not a bookable card.
  // C / pending / unpriced stay listable without inventing a live €.
  if (!isResultsListableOffer(priced)) {
    return null;
  }
  if (
    hasValidPresentablePrice(priced) &&
    searchParams &&
    !offerMatchesBudget(priced, searchParams)
  ) {
    return null;
  }
  // Settled overlay: provisional only while in-flight (Suspense fallback).
  // Settled C / unpriced / B must not be painted as PENDING.
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
) {
  if (!overlay || !overlay.pending) {
    const settled = overlay?.catalog ?? offer;
    if (!isResultsListableOffer(settled)) {
      return null;
    }
    if (
      hasValidPresentablePrice(settled) &&
      searchParams &&
      !offerMatchesBudget(settled, searchParams)
    ) {
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

  return (
    <Suspense
      fallback={
        <TravelCard
          offer={overlay.catalog}
          provisional
          searchParams={searchParams}
        />
      }
    >
      <OverlayTravelCard
        catalog={overlay.catalog}
        live={overlay.live}
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
}: {
  catalogOffers: TravelOffer[];
  /** When set, reserve candidates backfill when a primary slot settles as A. */
  candidateOffers?: TravelOffer[];
  displayLimit?: number;
  overlays: CatalogPageLiveOverlay[];
  searchParams?: SearchParams;
}) {
  const overlayById = new Map(overlays.map((overlay) => [overlay.catalog.id, overlay]));
  // Paint primary page members first, then reserve for A-settlement backfill.
  const primaryIds = new Set(catalogOffers.map((offer) => offer.id));
  const reserve = (candidateOffers ?? []).filter((offer) => !primaryIds.has(offer.id));
  const renderOffers =
    reserve.length > 0 ? [...catalogOffers, ...reserve] : catalogOffers;
  const useCap = reserve.length > 0;

  const slots = renderOffers.map((offer) => {
    const overlay = overlayById.get(offer.id);
    const card = renderCatalogOfferSlot(offer, overlay, searchParams);
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

export function Page1PaginationStream({
  params,
  page1Ids,
  paginationTotal,
}: {
  params: SearchParams;
  page1Ids: string[];
  paginationTotal: number;
}) {
  return (
    <>
      <SyncPage1IdsToUrl page1Ids={page1Ids} replaceExisting={Boolean(params.page1Ids?.length)} />
      <ResultsPagination
        params={{ ...params, pageSize: RESULTS_PRODUCT_PAGE_SIZE, page1Ids }}
        totalResults={paginationTotal}
      />
    </>
  );
}
