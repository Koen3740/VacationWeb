import { PoolProgressStream } from '@/components/results/pool-progress-steps';
import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';
import { createPoolProgressTracker } from '@/lib/search/results-pool-progress';
import { getSharedResultsPoolReader } from '@/lib/search/results-pool-reading';
import {
  countCatalogMatchset,
  countResultsPool,
  selectDisplayedResultsCount,
  usesCatalogResultsDisplayCount,
} from '@/lib/search/results-pool-count';
import { startResultsPoolL2Hydrate } from '@/lib/search/results-pool-hydrate';
import { ROADTRIP_VACATION_TYPE } from '@/lib/search/vacation-type';
import type { SearchParams } from '@/types/travel';

export type PresentableFacetCountProps = {
  filteringParams: SearchParams;
  /** Same Results search params used for live overlays / heading (occupancy, dates, …). */
  params: SearchParams;
  page: number;
  pageSize: number;
  isPage1: boolean;
};

function withCarRentalFacet(params: SearchParams): SearchParams {
  return { ...params, hasCarRental: true };
}

function withRoadtripFacet(params: SearchParams): SearchParams {
  const active = params.vacationTypes ?? [];
  if (active.includes(ROADTRIP_VACATION_TYPE)) {
    return { ...params, vacationTypes: active };
  }
  return { ...params, vacationTypes: [...active, ROADTRIP_VACATION_TYPE] };
}

/**
 * Same display rule as the heading: facet catalog > 150 → catalog length;
 * else Proven-B via countResultsPool. Catalog path does not await exactOffers.
 * L2 hydrate stays background-only on the Proven-B path.
 *
 * The badge used to render one snapshot taken before page-1 live prices landed,
 * so Roadtrip could stay on (0) while those offers were already listed as cards.
 * The stream follows the same L1 reader as the heading.
 */
async function FacetBookableCount({ facetFiltering }: { facetFiltering: SearchParams }) {
  const prepared = await loadPreparedResultsOffers(facetFiltering);
  const catalogCount = countCatalogMatchset(prepared.offers);
  if (usesCatalogResultsDisplayCount(catalogCount)) {
    return <>{selectDisplayedResultsCount(catalogCount, 0)}</>;
  }
  const ranked = await prepared.exactOffers;
  startResultsPoolL2Hydrate(ranked, facetFiltering);
  if (ranked.length === 0) {
    return <>{countResultsPool(ranked, facetFiltering)}</>;
  }
  const tracker = createPoolProgressTracker({
    read: getSharedResultsPoolReader(ranked, facetFiltering),
  });
  return (
    <PoolProgressStream
      tracker={tracker}
      render={(step) => <>{selectDisplayedResultsCount(catalogCount, step.count)}</>}
    />
  );
}

/**
 * Sidebar facet badges: catalog > 150 → catalog; else Proven-B (t63u membership).
 */
export async function CarRentalFacetCount({
  filteringParams,
}: PresentableFacetCountProps) {
  return <FacetBookableCount facetFiltering={withCarRentalFacet(filteringParams)} />;
}

export async function RoadtripFacetCount({
  filteringParams,
}: PresentableFacetCountProps) {
  return <FacetBookableCount facetFiltering={withRoadtripFacet(filteringParams)} />;
}
