import { ResultsPagination } from '@/components/results/results-pagination';
import { SyncPage1IdsToUrl } from '@/components/results/sync-page1-ids-to-url';
import { TravelCard } from '@/components/results/travel-card';
import { TravelCardReceiptFallback } from '@/components/results/travel-card-receipt-fallback';
import type { Page1PresentedSlice, Page1ReceiptStream } from '@/lib/providers/prijsvrij';
import { RESULTS_PRODUCT_PAGE_SIZE } from '@/lib/providers/prijsvrij';
import { isResultsVisibleOffer } from '@/lib/search/presentable-price';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { Suspense } from 'react';

async function StreamedTravelCard({
  offerPromise,
  searchParams,
}: {
  offerPromise: Promise<TravelOffer | null>;
  searchParams?: SearchParams;
}) {
  const offer = await offerPromise;
  if (!offer) {
    return null;
  }
  return <TravelCard offer={offer} searchParams={searchParams} />;
}

async function Page1TrailingCards({
  presented,
  searchParams,
}: {
  presented: Promise<Page1PresentedSlice>;
  searchParams?: SearchParams;
}) {
  const { trailingOffers } = await presented;
  if (trailingOffers.length === 0) {
    return null;
  }
  return (
    <>
      {trailingOffers.map((offer) => (
        <TravelCard key={offer.id} offer={offer} searchParams={searchParams} />
      ))}
    </>
  );
}

async function Page1PaginationFromPresented({
  presented,
  params,
  replaceExistingPage1Ids = false,
}: {
  presented: Promise<Page1PresentedSlice>;
  params: SearchParams;
  replaceExistingPage1Ids?: boolean;
}) {
  const { page1Ids, paginationTotal } = await presented;
  return (
    <>
      <SyncPage1IdsToUrl page1Ids={page1Ids} replaceExisting={replaceExistingPage1Ids} />
      <ResultsPagination
        params={{ ...params, pageSize: RESULTS_PRODUCT_PAGE_SIZE, page1Ids }}
        totalResults={paginationTotal}
      />
    </>
  );
}

export function Page1ResultsStream({
  stream,
  searchParams,
}: {
  stream: Page1ReceiptStream;
  searchParams?: SearchParams;
}) {
  return (
    <div className="space-y-3.5">
      {stream.slots.map((slot) =>
        slot.kind === 'immediate' && isResultsVisibleOffer(slot.offer) ? (
          <TravelCard key={slot.offer.id} offer={slot.offer} searchParams={searchParams} />
        ) : slot.kind === 'immediate' ? null : (
          <Suspense
            key={`pv-slot-${slot.selectedIndex}`}
            fallback={<TravelCardReceiptFallback />}
          >
            <StreamedTravelCard offerPromise={slot.offer} searchParams={searchParams} />
          </Suspense>
        ),
      )}
      <Suspense fallback={null}>
        <Page1TrailingCards presented={stream.presented} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

export function Page1PaginationStream({
  stream,
  params,
  replaceExistingPage1Ids = false,
}: {
  stream: Page1ReceiptStream;
  params: SearchParams;
  replaceExistingPage1Ids?: boolean;
}) {
  return (
    <Suspense fallback={null}>
      <Page1PaginationFromPresented
        presented={stream.presented}
        params={params}
        replaceExistingPage1Ids={replaceExistingPage1Ids}
      />
    </Suspense>
  );
}
