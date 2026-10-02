import { PoolProgressStream } from '@/components/results/pool-progress-steps';
import {
  formatHeroCountLabel,
  formatPoolCountStep,
  formatSectionCountLabel,
} from '@/lib/search/results-count-labels';
import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';
import { omitProviderFilter } from '@/lib/search/provider-filter';
import { startResultsPoolL2Hydrate } from '@/lib/search/results-pool-hydrate';
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
 * Progressive proven-B count (t334u). The prepare is shared (React cache), the full
 * matchset L2 hydrate runs in the BACKGROUND (never awaited: it used to hold the
 * heading at "." for ~12 s at 788 offers and ~98 s at 6,825), and the label follows the
 * same L1 overlay state as the cards through streamed steps.
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
  const ranked = await prepared.exactOffers;
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
 * Heading counts proven listable B (uncapped), never catalog matchset size.
 * - hero: original search (provider omitted)
 * - section: effective pool including active provider filter + optional "bij <provider>"
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

  const countParams =
    variant === 'hero' ? omitProviderFilter(filteringParams) : filteringParams;
  return (
    <ProgressivePresentableCount
      countParams={countParams}
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
 * Price-sort heading: same proven-B membership rules as default (hero vs section).
 */
export async function PriceSortPresentableCount({
  filteringParams,
  summaryLine,
  variant,
}: PriceSortPresentableCountProps) {
  const countParams =
    variant === 'hero' ? omitProviderFilter(filteringParams) : filteringParams;
  return (
    <ProgressivePresentableCount
      countParams={countParams}
      provider={filteringParams.provider}
      summaryLine={summaryLine}
      variant={variant}
    />
  );
}
