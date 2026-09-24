import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';

import { countResultsPool } from '@/lib/search/results-pool-count';

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

 * GO11: sidebar facet badges = whole-pool (matchset) counts after applying the

 * facet filter — same source family as heading, independent of sort.

 * Reverts GO8 B-only ≤150 facet source. Placeholder "…" stays in Suspense fallback.

 */

export async function CarRentalFacetCount({

  filteringParams,

}: PresentableFacetCountProps) {

  const facetFiltering = withCarRentalFacet(filteringParams);

  const prepared = await loadPreparedResultsOffers(facetFiltering);

  return <>{countResultsPool(prepared.offers)}</>;

}



export async function RoadtripFacetCount({

  filteringParams,

}: PresentableFacetCountProps) {

  const facetFiltering = withRoadtripFacet(filteringParams);

  const prepared = await loadPreparedResultsOffers(facetFiltering);

  return <>{countResultsPool(prepared.offers)}</>;

}

