/**
 * GO6: per-request memoized prepareResultsOffers so heading + CatalogLive
 * share one filter/rank without awaiting it on the Results shell path.
 */
import { cache } from 'react';
import { loadOffers } from '@/lib/offers/load-offers';
import { withCatalogFilterIndexAsync } from '@/lib/offers/catalog-filter-index';
import { excludeParkedResultsProviders } from '@/lib/search/presentable-price';
import {
  prepareResultsOffers,
  type PreparedResultsOffers,
} from '@/lib/search/prepare-results-offers';
import type { SearchParams } from '@/types/travel';

function resultsTimingEnabled(): boolean {
  return process.env.VACATIONWEB_RESULTS_TIMING === '1';
}

/** Cache key is JSON of stable filter fields (SearchParams object identity is unstable). */
function stableFilterKey(params: SearchParams): string {
  return JSON.stringify({
    country: params.country ?? null,
    countries: params.countries ?? null,
    region: params.region ?? null,
    city: params.city ?? null,
    nights: params.nights ?? null,
    nightsMin: params.nightsMin ?? null,
    nightsMax: params.nightsMax ?? null,
    adults: params.adults ?? null,
    children: params.children ?? null,
    babies: params.babies ?? null,
    departureStart: params.departureStart ?? null,
    departureEnd: params.departureEnd ?? null,
    flexibilityDays: params.flexibilityDays ?? null,
    departureAirport: params.departureAirport ?? null,
    boardTypes: params.boardTypes ?? null,
    accommodationTypes: params.accommodationTypes ?? null,
    stars: params.stars ?? null,
    vacationTypes: params.vacationTypes ?? null,
    beachLocation: params.beachLocation ?? null,
    centerLocation: params.centerLocation ?? null,
    amenities: params.amenities ?? null,
    hasCarRental: params.hasCarRental ?? null,
    budgetMin: params.budgetMin ?? null,
    budgetMax: params.budgetMax ?? null,
    sort: params.sort ?? null,
    party: params.party ?? null,
    rooms: params.rooms ?? null,
    siteMarket: (params as { siteMarket?: string }).siteMarket ?? null,
  });
}

const prepareCached = cache(
  async (filterKey: string, params: SearchParams): Promise<PreparedResultsOffers> => {
    const t0 = Date.now();
    const offers = excludeParkedResultsProviders(await loadOffers());
    const loadMs = Date.now() - t0;
    const t1 = Date.now();
    const prepared = await withCatalogFilterIndexAsync(offers, () =>
      prepareResultsOffers(offers, params),
    );
    const prepareMs = Date.now() - t1;
    if (resultsTimingEnabled()) {
      console.info(
        '[results-timing]',
        JSON.stringify({
          phase: 'prepare-in-suspense',
          filterKeyLength: filterKey.length,
          catalogOffers: offers.length,
          matchset: prepared.offers.length,
          loadMs,
          prepareMs,
          totalMs: Date.now() - t0,
        }),
      );
    }
    return prepared;
  },
);

export function loadPreparedResultsOffers(
  filteringParams: SearchParams,
): Promise<PreparedResultsOffers> {
  return prepareCached(stableFilterKey(filteringParams), filteringParams);
}
