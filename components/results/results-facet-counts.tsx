import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';
import { countResultsPool } from '@/lib/search/results-pool-count';
import { hydrateResultsLivePriceOverlaysFromL2 } from '@/lib/search/results-live-price-cache';
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

async function facetBookableCount(facetFiltering: SearchParams): Promise<number> {
  const prepared = await loadPreparedResultsOffers(facetFiltering);
  const ranked = await prepared.exactOffers;
  await hydrateResultsLivePriceOverlaysFromL2(
    ranked.map((offer) => offer.id),
    facetFiltering,
    { offers: ranked },
  );
  return countResultsPool(ranked, facetFiltering);
}

/**
 * Sidebar facet badges = proven B counts after applying the facet filter —
 * same source family as heading (never catalog matchset).
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
