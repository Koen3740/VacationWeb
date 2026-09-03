import { ResultsPagination } from '@/components/results/results-pagination';
import { SyncPage1IdsToUrl } from '@/components/results/sync-page1-ids-to-url';
import { TravelCard } from '@/components/results/travel-card';
import { Page1ResultsCap } from '@/components/results/page1-results-cap';
import { RESULTS_PRODUCT_PAGE_SIZE } from '@/lib/providers/prijsvrij';
import { slicePriceSortPoolPage } from '@/lib/search/prepare-results-offers';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { Suspense } from 'react';

export const PRICE_SORT_PENDING_MESSAGE =
  'Een momentje — we controleren de actuele prijzen.';
export const PRICE_SORT_PENDING_DETAIL = 'De volgorde kan nog wijzigen.';

function PriceSortPendingNotice() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mb-4 flex items-center gap-3 rounded-[12px] border border-[#D9E0EA] bg-white px-4 py-3"
    >
      <span
        className="h-6 w-6 shrink-0 animate-spin rounded-full border-2 border-[#89ACD3] border-t-[#0A2D62]"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-[14px] font-medium leading-snug text-[#0A2D62]">
          {PRICE_SORT_PENDING_MESSAGE}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-[#64748B]">
          {PRICE_SORT_PENDING_DETAIL}
        </p>
      </div>
    </div>
  );
}

function PriceSortPageBody({
  ranked,
  params,
  page,
  pageSize,
  pending,
}: {
  ranked: TravelOffer[];
  params: SearchParams;
  page: number;
  pageSize: number;
  pending: boolean;
}) {
  const slice = slicePriceSortPoolPage(ranked, page, pageSize, {
    provisional: pending,
    params,
  });
  const useCap = slice.visibleOffers.length > pageSize;
  const slots = slice.visibleOffers.map((offer) => (
    <div key={offer.id} data-page1-slot>
      <TravelCard offer={offer} provisional={pending} searchParams={params} />
    </div>
  ));

  return (
    <>
      {pending ? <PriceSortPendingNotice /> : null}
      {pending ? null : <SyncPage1IdsToUrl page1Ids={slice.page1Ids} replaceExisting />}
      {useCap ? <Page1ResultsCap limit={pageSize}>{slots}</Page1ResultsCap> : <div className="space-y-3.5">{slots}</div>}
      <ResultsPagination
        params={{ ...params, pageSize, page1Ids: slice.page1Ids }}
        totalResults={slice.paginationTotal}
      />
    </>
  );
}

async function PriceSortExactPage({
  exactOffers,
  params,
  page,
  pageSize,
}: {
  exactOffers: Promise<TravelOffer[]>;
  params: SearchParams;
  page: number;
  pageSize: number;
}) {
  const ranked = await exactOffers;
  return (
    <PriceSortPageBody
      ranked={ranked}
      params={params}
      page={page}
      pageSize={pageSize}
      pending={false}
    />
  );
}

export function PriceSortResultsStream({
  provisionalOffers,
  exactOffers,
  priceSortPending,
  params,
  page,
  pageSize = RESULTS_PRODUCT_PAGE_SIZE,
}: {
  provisionalOffers: TravelOffer[];
  exactOffers: Promise<TravelOffer[]>;
  priceSortPending: boolean;
  params: SearchParams;
  page: number;
  pageSize?: number;
}) {
  if (!priceSortPending) {
    return (
      <PriceSortPageBody
        ranked={provisionalOffers}
        params={params}
        page={page}
        pageSize={pageSize}
        pending={false}
      />
    );
  }

  return (
    <Suspense
      fallback={
        <PriceSortPageBody
          ranked={provisionalOffers}
          params={params}
          page={page}
          pageSize={pageSize}
          pending
        />
      }
    >
      <PriceSortExactPage
        exactOffers={exactOffers}
        params={params}
        page={page}
        pageSize={pageSize}
      />
    </Suspense>
  );
}
