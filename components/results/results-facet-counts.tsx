import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';
import { countResultsPool } from '@/lib/search/results-pool-count';
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
 * t63u OPTIE B: proven-B count for the facet-filtered, market-scoped pool (same
 * membership as the heading: countResultsPool applies the live overlays for these
 * params). L2 hydrate runs in the background (single-flight, never awaited), like
 * the heading, so facet badges never block on a full-pool L2 read.
 */
async function facetBookableCount(facetFiltering: SearchParams): Promise<number> {
  const prepared = await loadPreparedResultsOffers(facetFiltering);
  const ranked = await prepared.exactOffers;
  startResultsPoolL2Hydrate(ranked, facetFiltering);
  return countResultsPool(ranked, facetFiltering);
}

/**
 * Sidebar facet badges = proven B counts after applying the facet filter —
 * same source family as heading (never catalog matchset). Supersedes GO11 matchset counts.
 */
export async function CarRentalFacetCount({
  filteringParams,
}: PresentableFacetCountProps) {
  const count = await facetBookableCount(withCarRentalFacet(filteringParams));
  return <>{count}</>;
}

export async function RoadtripFacetCount({
  filteringParams,
}: PresentableFacetCountProps) {
  const count = await facetBookableCount(withRoadtripFacet(filteringParams));
  return <>{count}</>;
}
