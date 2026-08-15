import { ResultsPagination } from '@/components/results/results-pagination';
import { TravelCard } from '@/components/results/travel-card';
import { TravelCardReceiptFallback } from '@/components/results/travel-card-receipt-fallback';
import type { Page1PresentedSlice, Page1ReceiptStream } from '@/lib/providers/prijsvrij';
import { RESULTS_PRODUCT_PAGE_SIZE } from '@/lib/providers/prijsvrij';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { Suspense } from 'react';

async function StreamedTravelCard({
  offerPromise,
}: {
  offerPromise: Promise<TravelOffer | null>;
}) {
  const offer = await offerPromise;
  if (!offer) {
    return null;
  }
  return <TravelCard offer={offer} />;
}

async function Page1TrailingCards({
  presented,
}: {
  presented: Promise<Page1PresentedSlice>;
}) {
  const { trailingOffers } = await presented;
  if (trailingOffers.length === 0) {
    return null;
  }
  return (
    <>
      {trailingOffers.map((offer) => (
        <TravelCard key={offer.id} offer={offer} />
      ))}
    </>
  );
}

async function Page1PaginationFromPresented({
  presented,
  params,
  totalResults,
}: {
  presented: Promise<Page1PresentedSlice>;
  params: SearchParams;
  totalResults: number;
}) {
  const { page1Ids } = await presented;
  return (
    <ResultsPagination
      params={{ ...params, pageSize: RESULTS_PRODUCT_PAGE_SIZE, page1Ids }}
      totalResults={totalResults}
    />
  );
}

export function Page1ResultsStream({ stream }: { stream: Page1ReceiptStream }) {
  return (
    <div className="space-y-3.5">
      {stream.slots.map((slot) =>
        slot.kind === 'immediate' ? (
          <TravelCard key={slot.offer.id} offer={slot.offer} />
        ) : (
          <Suspense
            key={`pv-slot-${slot.selectedIndex}`}
            fallback={<TravelCardReceiptFallback />}
          >
            <StreamedTravelCard offerPromise={slot.offer} />
          </Suspense>
        ),
      )}
      <Suspense fallback={null}>
        <Page1TrailingCards presented={stream.presented} />
      </Suspense>
    </div>
  );
}

export function Page1PaginationStream({
  stream,
  params,
  totalResults,
}: {
  stream: Page1ReceiptStream;
  params: SearchParams;
  totalResults: number;
}) {
  return (
    <Suspense fallback={null}>
      <Page1PaginationFromPresented
        presented={stream.presented}
        params={params}
        totalResults={totalResults}
      />
    </Suspense>
  );
}
