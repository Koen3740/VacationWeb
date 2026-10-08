import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { NoResults } from '@/components/results/no-results';
import {
  Page1PaginationStream,
  Page1ResultsStream,
} from '@/components/results/page1-receipt-stream';
import { RESULTS_PRODUCT_PAGE_SIZE } from '@/lib/providers/prijsvrij';
import { loadCatalogLivePageState } from '@/lib/search/catalog-live-page-state';
import { loadRuntimeDataset } from '@/lib/offers/load-runtime-dataset';
import {
  coldPage2FallbackPage1Ids,
  coldPage2RedirectPage1Ids,
  PAGE1_DEADLINE_EMPTY_STATUS_TEXT,
  page1UrlIdsForSettle,
} from '@/lib/search/page-settle';
import { buildResultsPageHref, getResultsTotalPages, clampResultsPage } from '@/lib/search/pagination';
import { isSharedLivePricingPoolSort } from '@/lib/search/results-catalog-page';
import { getSharedResultsPoolReader } from '@/lib/search/results-pool-reading';
import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';
import { scopeOffersToProviderFilter } from '@/lib/search/provider-filter';
import { scheduleCappedMatchsetLiveAfterPage } from '@/lib/search/schedule-capped-matchset-live-after-page';
import { scheduleResultsMatchsetLivePricing } from '@/lib/search/schedule-results-matchset-live-pricing';
import {
  beginOrContinuePricingRun,
  buildPricingRunKey,
  markPricingRunPage1Settled,
} from '@/lib/search/live-pricing-admission';
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
 * GO11: background live covers full pool; browse cards capped at 150; heading = proven B.
 */
export async function CatalogLiveBody({
  filteringParams,
  params,
  page,
  pageSize,
  isPage1,
}: CatalogLiveBodyProps) {
  const prepared = await loadPreparedResultsOffers(filteringParams);
  const filtered = scopeOffersToProviderFilter(prepared.offers, filteringParams);

  if (filtered.length === 0) {
    return <NoResults />;
  }

  const catalogGenerationId = (await loadRuntimeDataset()).generationId;

  // Pricing lifecycle (not catalogGen): same key on page-only nav continues the run;
  // filter/search change supersedes and starts a new run.
  const pricingRun = beginOrContinuePricingRun(buildPricingRunKey(filteringParams));

  const state = await loadCatalogLivePageState(
    filtered,
    filteringParams,
    params,
    page,
    pageSize,
    isPage1,
  );

  const { catalogPage, overlayCandidates, streamOffers, overlays, page1Settle } = state;
  // SF-026: same pool reader as the heading (shared when the array is the same).
  const poolReader = getSharedResultsPoolReader(filtered, filteringParams);

  // Effective browse pool may be smaller than ?page= (e.g. provider=Corendon → 1 page).
  // Correct invalid pages before painting an empty Results section.
  if (catalogPage.paginationTotal > 0) {
    const totalPages = getResultsTotalPages(catalogPage.paginationTotal, pageSize);
    const clampedPage = clampResultsPage(page, totalPages);
    if (clampedPage !== page) {
      redirect(buildResultsPageHref(params, clampedPage));
    }
  }

  if (page1Settle) {
    void page1Settle.selection.then(() => {
      markPricingRunPage1Settled(pricingRun.runId);
    });
  }

  // Single orchestrator: P1 (150 B milestone) then P2 demand-driven warm.
  scheduleCappedMatchsetLiveAfterPage(filtered, filteringParams, {
    afterPageOverlays: Promise.all(overlays.map((overlay) => overlay.live)),
    cheapestFirst: isSharedLivePricingPoolSort(filteringParams.sort),
    pricingRun,
  });
  // D-v2 S7 (B4 30-08: waitUntil = cache-warming only): keep the page overlays' live
  // pricing alive after the response (Vercel waitUntil; locally the pending set holds
  // the reference). Their late results only fill L1/L2; the sent response/selection is
  // never changed (CUT slots stay null, no new UI output).
  scheduleResultsMatchsetLivePricing(Promise.allSettled(overlays.map((overlay) => overlay.live)));

  // D-v2 S5 (Master Plan v1.10 r.706/707): cold page 2+ (no page1Ids) runs the page-1
  // pipeline once, then redirects to the same page with the resulting page1Ids (HTTP 200
  // + client redirect after streaming has started is accepted, r.707).
  if (state.coldPage2Page1Settle) {
    const coldSelection = await state.coldPage2Page1Settle.selection;
    const redirectIds = coldPage2RedirectPage1Ids(
      coldSelection,
      state.coldPage2Page1Settle.pageSize,
    );
    if (redirectIds.length > 0) {
      // Page 15 Gold: only DEFINITIVE freezes carry catalogGen; ANCHOR ids alone
      // would be treated as legacy (no stamp) and reset on the follow-up request.
      const settleFreeze = page1UrlIdsForSettle(
        coldSelection,
        state.coldPage2Page1Settle.pageSize,
      );
      if (settleFreeze.freeze === 'DEFINITIVE' && catalogGenerationId) {
        redirect(
          buildResultsPageHref(
            { ...params, page1Ids: redirectIds, catalogGen: catalogGenerationId },
            page,
          ),
        );
      }
      // ANCHOR / unstamped definitive: no redirect (legacy no-stamp would reset).
    }
    // Option d / DEADLINE_EMPTY: nothing may be written -> no redirect, no page1Ids
    // write; B-only cards from the B pool recomputed now, minus the page-1 selection
    // this pipeline just recomputed (A-38 fix: never a page-1 card on page 2+).
    const fallback = state.recomputeBrowsePage
      ? state.recomputeBrowsePage(
          coldPage2FallbackPage1Ids(coldSelection, state.coldPage2Page1Settle.slotOffers),
        )
      : { offers: catalogPage.offers, paginationTotal: catalogPage.paginationTotal };
    if (fallback.offers.length === 0) {
      return (
        <p role="status" className="py-6 text-center text-sm text-[#334155]">
          {PAGE1_DEADLINE_EMPTY_STATUS_TEXT}
        </p>
      );
    }
    return (
      <>
        <Page1ResultsStream
          catalogOffers={fallback.offers}
          displayLimit={pageSize}
          overlays={[]}
          searchParams={{ ...params, pageSize }}
        />
        <Suspense fallback={null}>
          <Page1PaginationStream
            params={{ ...params, pageSize }}
            page1Ids={[]}
            paginationTotal={fallback.paginationTotal}
            hasMore={'hasMore' in fallback ? fallback.hasMore : undefined}
          />
        </Suspense>
      </>
    );
  }

  // GO10: never show NoResults while presentable total > 0 (heading/pagination).
  // Prefer streamOffers (freeze-repaired B); else overlay candidates; else empty only
  // when the presentable pool itself is empty.
  const paintOffers =
    streamOffers.length > 0
      ? streamOffers
      : overlayCandidates.length > 0
        ? overlayCandidates
        : catalogPage.offers;
  // GO11: heading = proven B; Geen only when matchset empty (handled above).
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
          page1Settle={page1Settle}
        />
      )}
      {/* D-v2 S4: page 1 awaits the settle selection (page1Ids + paginationTotal at
          settle). D-v2 S5: page 2+ uses the page-1-excluded remaining slice/total. */}
      <Suspense fallback={null}>
        <Page1PaginationStream
          params={{ ...params, pageSize }}
          page1Ids={catalogPage.page1Ids}
          paginationTotal={catalogPage.paginationTotal}
          page1Settle={page1Settle}
          computeBrowseTotal={state.computeBrowseTotal}
          readPoolPending={() => poolReader().pending}
          hasMore={state.hasMore}
          catalogGenerationId={catalogGenerationId}
        />
      </Suspense>
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
