import { ResultsPagination } from '@/components/results/results-pagination';
import { SyncPage1IdsToUrl } from '@/components/results/sync-page1-ids-to-url';
import { TravelCard } from '@/components/results/travel-card';
import { TravelCardReceiptFallback } from '@/components/results/travel-card-receipt-fallback';
import type { Page1PresentedSlice, Page1ReceiptStream } from '@/lib/providers/prijsvrij';
import { RESULTS_PRODUCT_PAGE_SIZE } from '@/lib/providers/prijsvrij';
import { hasValidPresentablePrice } from '@/lib/search/presentable-price';
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
}: {
  presented: Promise<Page1PresentedSlice>;
  params: SearchParams;
}) {
  const { page1Ids, paginationTotal } = await presented;
  return (
    <>
      <SyncPage1IdsToUrl page1Ids={page1Ids} />
      <ResultsPagination
        params={{ ...params, pageSize: RESULTS_PRODUCT_PAGE_SIZE, page1Ids }}
        totalResults={paginationTotal}
      />
    </>
  );
}

export function Page1ResultsStream({ stream }: { stream: Page1ReceiptStream }) {
  return (
    <div className="space-y-3.5">
      {stream.slots.map((slot) =>
        slot.kind === 'immediate' && hasValidPresentablePrice(slot.offer) ? (
          <TravelCard key={slot.offer.id} offer={slot.offer} />
        ) : slot.kind === 'immediate' ? null : (
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
}: {
  stream: Page1ReceiptStream;
  params: SearchParams;
}) {
  return (
    <Suspense fallback={null}>
      <Page1PaginationFromPresented
        presented={stream.presented}
        params={params}
      />
    </Suspense>
  );
}
