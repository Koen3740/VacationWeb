import { FilterSidebar } from '@/components/results/filter-sidebar';
import { NoResults } from '@/components/results/no-results';
import { ResultsPagination } from '@/components/results/results-pagination';
import { SortSelector } from '@/components/results/sort-selector';
import { TravelCard } from '@/components/results/travel-card';
import { ResultsPageClient } from '@/components/results-v2/results-page-client';
import { getDepartureDisplay } from '@/components/search/departure-display';
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { deriveDestinationCountryCounts } from '@/lib/offers/derive-destination-countries';
import { loadFilterOptions } from '@/lib/offers/load-filter-options';
import { loadOffers } from '@/lib/offers/load-offers';
import { formatTotalOffersLabel } from '@/lib/offers/load-total-offers-label';
import { filterOffers, sortOffers } from '@/lib/search/filtering';
import { paginateResults, parseResultsPageParam, parseResultsPageSizeParam } from '@/lib/search/pagination';
import { SearchParams } from '@/types/travel';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic';

function parseSearchParams(searchParams: Record<string, string | string[] | undefined>): SearchParams {
  const boardTypes = typeof searchParams.boardTypes === 'string' ? searchParams.boardTypes.split(',') : undefined;
  const countryRaw = typeof searchParams.country === 'string' ? searchParams.country : undefined;
  const countries = countryRaw
    ? countryRaw.split(',').map((country) => canonicalizeCountryName(country.trim())).filter(Boolean)
    : undefined;
  const nightsRaw = typeof searchParams.nights === 'string' ? searchParams.nights : undefined;
  const nights = nightsRaw
    ? nightsRaw
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value))
    : undefined;

  return {
    country: countries?.length === 1 ? countries[0] : undefined,
    countries: countries?.length ? countries : undefined,
    region: typeof searchParams.region === 'string' ? searchParams.region : undefined,
    budgetMin: typeof searchParams.budgetMin === 'string' ? Number(searchParams.budgetMin) : undefined,
    budgetMax: typeof searchParams.budgetMax === 'string' ? Number(searchParams.budgetMax) : undefined,
    nightsMin: typeof searchParams.nightsMin === 'string' ? Number(searchParams.nightsMin) : undefined,
    nightsMax: typeof searchParams.nightsMax === 'string' ? Number(searchParams.nightsMax) : undefined,
    nights: nights?.length ? nights : undefined,
    boardTypes,
    adults: typeof searchParams.adults === 'string' ? Number(searchParams.adults) : undefined,
    children: typeof searchParams.children === 'string' ? Number(searchParams.children) : undefined,
    babies: typeof searchParams.babies === 'string' ? Number(searchParams.babies) : undefined,
    rooms: typeof searchParams.rooms === 'string' ? Number(searchParams.rooms) : undefined,
    departureStart: typeof searchParams.departureStart === 'string' ? searchParams.departureStart : undefined,
    departureEnd: typeof searchParams.departureEnd === 'string' ? searchParams.departureEnd : undefined,
    flexibilityDays: (() => {
      if (typeof searchParams.flexibilityDays !== 'string') {
        return undefined;
      }

      const parsed = Number(searchParams.flexibilityDays);

      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) {
        return undefined;
      }

      return parsed;
    })(),
    departureAirport: typeof searchParams.departureAirport === 'string' ? searchParams.departureAirport : undefined,
    stars: typeof searchParams.stars === 'string' ? Number(searchParams.stars) : undefined,
    sort: typeof searchParams.sort === 'string' ? searchParams.sort : 'value',
    page: parseResultsPageParam(
      typeof searchParams.page === 'string' ? searchParams.page : undefined,
    ),
    pageSize: parseResultsPageSizeParam(
      typeof searchParams.pageSize === 'string' ? searchParams.pageSize : undefined,
    ),
  };
}

function buildSummaryLine(params: SearchParams): string {
  const parts: string[] = [];

  if (params.countries?.length) {
    parts.push(params.countries.join(', '));
  } else if (params.country) {
    parts.push(params.country);
  }

  if (params.region) {
    parts.push(params.region);
  }

  const departureSegment = getDepartureDisplay({
    departureStart: params.departureStart,
    departureEnd: params.departureEnd,
    flexibilityDays: params.flexibilityDays,
  }).summarySegment;
  if (departureSegment) {
    parts.push(departureSegment);
  }

  if (params.nights?.length) {
    const min = Math.min(...params.nights);
    const max = Math.max(...params.nights);
    parts.push(min === max ? `${min} dagen` : `${min} - ${max} dagen`);
  } else if (params.nightsMin != null && params.nightsMax != null) {
    parts.push(
      params.nightsMin === params.nightsMax
        ? `${params.nightsMin} dagen`
        : `${params.nightsMin} - ${params.nightsMax} dagen`,
    );
  }

  const adults = params.adults ?? 2;
  parts.push(`${adults} volwassene${adults === 1 ? '' : 'n'}`);

  if (params.rooms && params.rooms > 0) {
    parts.push(`${params.rooms} kamer${params.rooms === 1 ? '' : 's'}`);
  }

  return parts.join(' • ');
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = parseSearchParams(searchParams);
  const offers = await loadOffers();
  const filterOptions = loadFilterOptions();
  const countryCounts = Object.fromEntries(
    deriveDestinationCountryCounts(offers).map(({ name, count }) => [name, count]),
  );
  const totalOffersLabel = formatTotalOffersLabel(offers.length);
  const filtered = sortOffers(filterOffers(offers, params), params.sort);
  const visibleOffers = paginateResults(
    filtered,
    params.page ?? 1,
    params.pageSize ?? 24,
  );

  return (
    <Suspense fallback={<main className="min-h-screen bg-[#F3F5F8]" />}>
      <ResultsPageClient
        departureAirports={filterOptions.departureAirports}
        resultCount={filtered.length}
        summaryLine={buildSummaryLine(params)}
        sortControl={<SortSelector currentSort={params.sort || 'value'} />}
        filters={
          <FilterSidebar
            {...filterOptions}
            countryCounts={countryCounts}
            totalOffersLabel={totalOffersLabel}
          />
        }
        results={
          visibleOffers.length > 0 ? (
            <div className="space-y-3.5">
              {visibleOffers.map((offer) => (
                <TravelCard key={offer.id} offer={offer} />
              ))}
            </div>
          ) : (
            <NoResults />
          )
        }
        pagination={<ResultsPagination params={params} totalResults={filtered.length} />}
      />
    </Suspense>
  );
}
