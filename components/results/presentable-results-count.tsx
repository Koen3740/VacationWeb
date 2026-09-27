import {
  formatHeroCountLabel,
  formatSectionCountLabel,
} from '@/lib/search/results-count-labels';
import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';
import { omitProviderFilter } from '@/lib/search/provider-filter';
import { countResultsPool } from '@/lib/search/results-pool-count';
import { hydrateResultsLivePriceOverlaysFromL2 } from '@/lib/search/results-live-price-cache';
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

async function countPresentableForParams(filteringParams: SearchParams): Promise<{
  count: number;
  rankedLength: number;
}> {
  const prepared = await loadPreparedResultsOffers(filteringParams);
  const ranked = await prepared.exactOffers;
  await hydrateResultsLivePriceOverlaysFromL2(
    ranked.map((offer) => offer.id),
    filteringParams,
    { offers: ranked },
  );
  return {
    count: countResultsPool(ranked, filteringParams),
    rankedLength: ranked.length,
  };
}

/**
 * Heading counts proven listable B (uncapped), never catalog matchset size.
 * - hero: original search (provider omitted)
 * - section: effective pool including active provider filter + optional "bij …"
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
  const { count, rankedLength } = await countPresentableForParams(countParams);

  // Matchset still warming with zero proven B yet — do not claim catalog size or "Geen".
  if (count === 0 && rankedLength > 0) {
    return <>…</>;
  }

  if (variant === 'hero') {
    return <>{formatHeroCountLabel(count, summaryLine)}</>;
  }

  return <>{formatSectionCountLabel(count, filteringParams.provider)}</>;
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
  const { count, rankedLength } = await countPresentableForParams(countParams);

  if (count === 0 && rankedLength > 0) {
    return <>…</>;
  }

  if (variant === 'hero') {
    return <>{formatHeroCountLabel(count, summaryLine)}</>;
  }

  return <>{formatSectionCountLabel(count, filteringParams.provider)}</>;
}
