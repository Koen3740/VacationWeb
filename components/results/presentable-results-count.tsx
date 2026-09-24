import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';

import { countResultsPool } from '@/lib/search/results-pool-count';

import type { SearchParams } from '@/types/travel';



const REFINEMENT_HEADING = 'Maak je zoekopdracht iets specifieker';



function formatHeroCountLabel(count: number, summaryLine: string): string {

  const first = summaryLine.split(' • ')[0]?.trim() ?? '';

  const looksLikeDestination =

    first.length > 0 && !/\d/.test(first) && !/volwassene/i.test(first);

  if (count > 0 && looksLikeDestination) {

    return `${count} vakanties in ${first}`;

  }

  if (count > 0) {

    return `${count} vakanties gevonden`;

  }

  return 'Geen vakanties gevonden';

}



function formatSectionCountLabel(count: number): string {

  if (count > 0) {

    return `${count} vakanties gevonden`;

  }

  return 'Geen vakanties gevonden';

}



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

 * GO11: heading = full matchset/pool size (uncapped), identical for every sort.

 * Stable as live prices arrive — does NOT count presentable B cards.

 * Shares prepare via React cache() with CatalogLiveBody (GO5/GO6 latency path).

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

  const prepared = await loadPreparedResultsOffers(filteringParams);

  const count = countResultsPool(prepared.offers);

  if (variant === 'hero') {

    return <>{formatHeroCountLabel(count, summaryLine)}</>;

  }

  return <>{formatSectionCountLabel(count)}</>;

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

 * GO11: price-sort heading uses the SAME pool count as default sort

 * (prepared.offers.length after filter). Does not await the live-ranked list / B set.

 */

export async function PriceSortPresentableCount({

  filteringParams,

  summaryLine,

  variant,

}: PriceSortPresentableCountProps) {

  const prepared = await loadPreparedResultsOffers(filteringParams);

  const count = countResultsPool(prepared.offers);

  if (variant === 'hero') {

    return <>{formatHeroCountLabel(count, summaryLine)}</>;

  }

  return <>{formatSectionCountLabel(count)}</>;

}

