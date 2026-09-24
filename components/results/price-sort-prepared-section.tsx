import { NoResults } from '@/components/results/no-results';
import { PriceSortResultsStream } from '@/components/results/price-sort-live-stream';
import { ResultsPagination } from '@/components/results/results-pagination';
import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';
import type { SearchParams } from '@/types/travel';

export type PriceSortPreparedSectionProps = {
  filteringParams: SearchParams;
  params: SearchParams;
  page: number;
  pageSize: number;
};

/**
 * GO7: price-sort prepare runs inside Suspense (shared loadPreparedResultsOffers cache)
 * so the Results shell is not blocked by filter/rank/live workset await.
 * Stream still only presents B/live prices — never catalog € as live.
 */
export async function PriceSortPreparedSection({
  filteringParams,
  params,
  page,
  pageSize,
}: PriceSortPreparedSectionProps) {
  const prepared = await loadPreparedResultsOffers(filteringParams);
  const filtered = prepared.offers;

  if (filtered.length === 0) {
    return (
      <>
        <NoResults />
        <ResultsPagination params={{ ...params, pageSize }} totalResults={0} />
      </>
    );
  }

  return (
    <PriceSortResultsStream
      provisionalOffers={prepared.offers}
      exactOffers={prepared.exactOffers}
      priceSortPending={prepared.priceSortPending}
      params={{ ...params, pageSize }}
      page={page}
      pageSize={pageSize}
    />
  );
}
