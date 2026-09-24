import { Suspense } from 'react';
import { NoResults } from '@/components/results/no-results';
import {
  Page1PaginationStream,
  Page1ResultsStream,
} from '@/components/results/page1-receipt-stream';
import { RESULTS_PRODUCT_PAGE_SIZE } from '@/lib/providers/prijsvrij';
import { loadCatalogLivePageState } from '@/lib/search/catalog-live-page-state';
import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';
import { scheduleCappedMatchsetLiveAfterPage } from '@/lib/search/schedule-capped-matchset-live-after-page';
import type { SearchParams } from '@/types/travel';

export type CatalogLiveBodyProps = {
  filteringParams: SearchParams;
  params: SearchParams;
  page: number;
  pageSize: number;
  isPage1: boolean;
};

/**
 * GO3/GO5/GO6: prepare (filter+rank) + L2->L1 hydrate + B-slice + streams.
 * Inside Suspense so the Results shell flushes before matchset work.
 * GO5: page overlays first; matchset live deferred (non-blocking).
 * GO11: background live covers full pool; browse cards capped at 150; heading = pool.
 */
export async function CatalogLiveBody({
  filteringParams,
  params,
  page,
  pageSize,
  isPage1,
}: CatalogLiveBodyProps) {
  const prepared = await loadPreparedResultsOffers(filteringParams);
  const filtered = prepared.offers;

  if (filtered.length === 0) {
    return <NoResults />;
  }

  const state = await loadCatalogLivePageState(
    filtered,
    filteringParams,
    params,
    page,
    pageSize,
    isPage1,
  );

  const { catalogPage, overlayCandidates, streamOffers, overlays } = state;

  // GO11-followup: full-pool live waits for page overlays (or 1.5s head-start); not awaited here.
  scheduleCappedMatchsetLiveAfterPage(filtered, filteringParams, {
    afterPageOverlays: Promise.all(overlays.map((overlay) => overlay.live)),
  });

  // GO10: never show NoResults while presentable total > 0 (heading/pagination).
  // Prefer streamOffers (freeze-repaired B); else overlay candidates; else empty only
  // when the presentable pool itself is empty.
  const paintOffers =
    streamOffers.length > 0
      ? streamOffers
      : overlayCandidates.length > 0
        ? overlayCandidates
        : catalogPage.offers;
  // GO11: heading = pool size; Geen only when matchset empty (handled above).
  // Do not show Geen merely because B/browse is still settling (paginationTotal 0).
  const showEmpty = false;

  return (
    <>
      {showEmpty ? (
        <NoResults />
      ) : (
        <Page1ResultsStream
          catalogOffers={paintOffers}
          candidateOffers={overlayCandidates}
          displayLimit={pageSize}
          overlays={overlays}
          searchParams={{ ...params, pageSize }}
        />
      )}
      <Page1PaginationStream
        params={{ ...params, pageSize }}
        page1Ids={catalogPage.page1Ids}
        paginationTotal={catalogPage.paginationTotal}
      />
    </>
  );
}

export function CatalogLiveSection(props: CatalogLiveBodyProps) {
  return (
    <Suspense
      fallback={
        <div
          className="space-y-3.5"
          aria-busy="true"
          aria-label="Live prijzen laden"
        >
          {Array.from({ length: RESULTS_PRODUCT_PAGE_SIZE }, (_, index) => (
            <div
              key={index}
              className="h-36 animate-pulse rounded-[16px] border border-[#E8E4DC] bg-white/70"
            />
          ))}
        </div>
      }
    >
      <CatalogLiveBody {...props} />
    </Suspense>
  );
}
