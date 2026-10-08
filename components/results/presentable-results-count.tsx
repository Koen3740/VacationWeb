import { PoolProgressStream } from '@/components/results/pool-progress-steps';
import {
  formatHeroCountLabel,
  formatPoolCountStep,
  formatSectionCountLabel,
} from '@/lib/search/results-count-labels';
import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';
import { scopeOffersToProviderFilter } from '@/lib/search/provider-filter';
import { startResultsPoolL2Hydrate } from '@/lib/search/results-pool-hydrate';
import {
  countCatalogMatchsetForSearch,
  usesCatalogResultsDisplayCount,
} from '@/lib/search/results-pool-count';
import { createPoolProgressTracker } from '@/lib/search/results-pool-progress';
import { getSharedResultsPoolReader } from '@/lib/search/results-pool-reading';
import type { SearchParams } from '@/types/travel';

export { formatHeroCountLabel, formatSectionCountLabel };

const REFINEMENT_HEADING = 'Maak je zoekopdracht iets specifieker';

export type PresentableResultsCountProps = {
  filteringParams: SearchParams;
  params: SearchParams;
  page: number;
  pageSize: number;
  isPage1: boolean;
  summaryLine: string;
  refinementRequired?: boolean;
  variant: 'hero' | 'section';
};

/**
 * Results heading display (Main Chat 5): catalog matchset when > 150, else
 * progressive Proven-B (t334u). Catalog path does not await exactOffers / live
 * pricing. L2 hydrate stays fire-and-forget on the Proven-B path only.
 */
async function ProgressivePresentableCount({
  countParams,
  provider,
  summaryLine,
  variant,
}: {
  countParams: SearchParams;
  provider?: string;
  summaryLine: string;
  variant: 'hero' | 'section';
}) {
  const prepared = await loadPreparedResultsOffers(countParams);
  const catalogCount = countCatalogMatchsetForSearch(prepared.offers, countParams);
  if (usesCatalogResultsDisplayCount(catalogCount)) {
    return (
      <>
        {formatPoolCountStep(
          { count: catalogCount, checking: false },
          {
            variant,
            summaryLine,
            provider,
            matchsetEmpty: false,
          },
        )}
      </>
    );
  }
  const ranked = scopeOffersToProviderFilter(await prepared.exactOffers, countParams);
  startResultsPoolL2Hydrate(ranked, countParams);
  const tracker = createPoolProgressTracker({
    read: getSharedResultsPoolReader(ranked, countParams),
  });
  return (
    <PoolProgressStream
      tracker={tracker}
      render={(step) =>
        formatPoolCountStep(step, {
          variant,
          summaryLine,
          provider,
          matchsetEmpty: ranked.length === 0,
        })
      }
    />
  );
}

/**
 * Heading display: catalog > 150 → catalog count; else Proven-B stream.
 * catalogCount is the CURRENT search matchset, including `?provider=`.
 */
export async function PresentableResultsCount({
  filteringParams,
  summaryLine,
  refinementRequired = false,
  variant,
}: PresentableResultsCountProps) {
  if (refinementRequired) {
    return <>{REFINEMENT_HEADING}</>;
  }

  return (
    <ProgressivePresentableCount
      countParams={filteringParams}
      provider={filteringParams.provider}
      summaryLine={summaryLine}
      variant={variant}
    />
  );
}

export type PriceSortPresentableCountProps = {
  filteringParams: SearchParams;
  params: SearchParams;
  page: number;
  pageSize: number;
  summaryLine: string;
  variant: 'hero' | 'section';
};

/**
 * Price-sort heading: same display rule as default (current search, including provider).
 */
export async function PriceSortPresentableCount({
  filteringParams,
  summaryLine,
  variant,
}: PriceSortPresentableCountProps) {
  return (
    <ProgressivePresentableCount
      countParams={filteringParams}
      provider={filteringParams.provider}
      summaryLine={summaryLine}
      variant={variant}
    />
  );
}
