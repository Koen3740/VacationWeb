import { FilterSidebar } from '@/components/results/filter-sidebar';
import { NoResults } from '@/components/results/no-results';
import { ResultsPagination } from '@/components/results/results-pagination';
import { SortSelector } from '@/components/results/sort-selector';
import { TravelCard } from '@/components/results/travel-card';
import { ResultsPageClient } from '@/components/results-v2/results-page-client';
import { SearchProgressFeedback } from '@/components/search/search-progress-feedback';
import { getDepartureDisplay } from '@/components/search/departure-display';
import {
  expandDurationRange,
  formatSelectedDurationsLabel,
} from '@/components/search/duration-popup/duration-popup-utils';
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { deriveDestinationCountryCounts } from '@/lib/offers/derive-destination-countries';
import { loadFilterOptions } from '@/lib/offers/load-filter-options';
import { loadOffers } from '@/lib/offers/load-offers';
import { formatTotalOffersLabel } from '@/lib/offers/load-total-offers-label';
import {
  Page1PaginationStream,
  Page1ResultsStream,
} from '@/components/results/page1-receipt-stream';
import {
  resolveResultsPageSlice,
  RESULTS_PRODUCT_PAGE_SIZE,
  startPage1ReceiptStream,
} from '@/lib/providers/prijsvrij';
import { filterOffers, sortOffers } from '@/lib/search/filtering';
import {
  buildResultsPageHref,
  parsePage1IdsParam,
  parseResultsPageParam,
} from '@/lib/search/pagination';
import { parseAccommodationTypesParam } from '@/lib/search/accommodation-type-filter';
import { parseAmenitiesParam } from '@/lib/search/amenity-filters';
import {
  parseBeachLocationsParam,
  parseCenterLocationsParam,
} from '@/lib/search/location-filters';
import { parseStarsParam } from '@/lib/search/stars-param';
import { parseVacationTypesParam } from '@/lib/search/vacation-type';
import { SearchParams, type TravelOffer } from '@/types/travel';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

function deriveCitiesByCountry(offers: TravelOffer[]): Record<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const offer of offers) {
    const country = canonicalizeCountryName(offer.destinationCountry);
    const city = offer.destinationCity?.trim();
    if (!country || !city) continue;
    const set = map.get(country) ?? new Set<string>();
    set.add(city);
    map.set(country, set);
  }
  const result: Record<string, string[]> = {};
  for (const [country, cities] of map) {
    result[country] = [...cities].sort((a, b) => a.localeCompare(b, 'nl'));
  }
  return result;
}

function deriveAccommodationTypes(offers: TravelOffer[]): string[] {
  const counts = new Map<string, number>();
  for (const offer of offers) {
    const type = offer.accommodationType?.trim();
    if (!type) continue;
    counts.set(type, (counts.get(type) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nl'))
    .map(([type]) => type);
}

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
    city: typeof searchParams.city === 'string' ? searchParams.city : undefined,
    budgetMin: typeof searchParams.budgetMin === 'string' ? Number(searchParams.budgetMin) : undefined,
    budgetMax: typeof searchParams.budgetMax === 'string' ? Number(searchParams.budgetMax) : undefined,
    nightsMin: typeof searchParams.nightsMin === 'string' ? Number(searchParams.nightsMin) : undefined,
    nightsMax: typeof searchParams.nightsMax === 'string' ? Number(searchParams.nightsMax) : undefined,
    nights: nights?.length ? nights : undefined,
    boardTypes,
    accommodationTypes: (() => {
      if (typeof searchParams.accommodationTypes !== 'string') {
        return undefined;
      }
      const parsed = parseAccommodationTypesParam(searchParams.accommodationTypes);
      return parsed.length > 0 ? parsed : undefined;
    })(),
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
    stars: (() => {
      if (typeof searchParams.stars !== 'string') {
        return undefined;
      }
      const parsed = parseStarsParam(searchParams.stars);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    vacationTypes: (() => {
      if (typeof searchParams.vacationTypes !== 'string') {
        return undefined;
      }
      const parsed = parseVacationTypesParam(searchParams.vacationTypes);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    beachLocation: (() => {
      if (typeof searchParams.beachLocation !== 'string') {
        return undefined;
      }
      const parsed = parseBeachLocationsParam(searchParams.beachLocation);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    centerLocation: (() => {
      if (typeof searchParams.centerLocation !== 'string') {
        return undefined;
      }
      const parsed = parseCenterLocationsParam(searchParams.centerLocation);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    amenities: (() => {
      if (typeof searchParams.amenities !== 'string') {
        return undefined;
      }
      const parsed = parseAmenitiesParam(searchParams.amenities);
      return parsed.length > 0 ? parsed : undefined;
    })(),
    sort: typeof searchParams.sort === 'string' ? searchParams.sort : 'value',
    page: parseResultsPageParam(
      typeof searchParams.page === 'string' ? searchParams.page : undefined,
    ),
    pageSize: RESULTS_PRODUCT_PAGE_SIZE,
    page1Ids: parsePage1IdsParam(
      typeof searchParams.page1Ids === 'string' ? searchParams.page1Ids : undefined,
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

  const activeDurations = params.nights?.length
    ? params.nights
    : params.nightsMin != null && params.nightsMax != null
      ? expandDurationRange(params.nightsMin, params.nightsMax)
      : [];
  if (activeDurations.length > 0) {
    parts.push(formatSelectedDurationsLabel(activeDurations));
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
  const citiesByCountry = deriveCitiesByCountry(offers);
  const accommodationTypes = deriveAccommodationTypes(offers);
  const countryCounts = Object.fromEntries(
    deriveDestinationCountryCounts(offers).map(({ name, count }) => [name, count]),
  );
  const totalOffersLabel = formatTotalOffersLabel(offers.length);
  const filtered = sortOffers(filterOffers(offers, params), params.sort);
  const pageSize = RESULTS_PRODUCT_PAGE_SIZE;
  const page = params.page ?? 1;
  const isPage1 = !Number.isFinite(page) || Math.floor(page) <= 1;

  const pageShell = {
    departureAirports: filterOptions.departureAirports,
    resultCount: filtered.length,
    summaryLine: buildSummaryLine(params),
    sortControl: <SortSelector currentSort={params.sort || 'value'} />,
    filters: (
      <FilterSidebar
        {...filterOptions}
        citiesByCountry={citiesByCountry}
        accommodationTypes={accommodationTypes}
        countryCounts={countryCounts}
        totalOffersLabel={totalOffersLabel}
      />
    ),
  };

  // Page 1: stream non-Receipt cards immediately; PV slots resolve independently.
  // page1Ids / remaining still wait for the full existing Receipt pipeline.
  if (isPage1) {
    if (filtered.length === 0) {
      return (
        <ResultsPageClient
          {...pageShell}
          results={<NoResults />}
          pagination={
            <ResultsPagination
              params={{ ...params, pageSize }}
              totalResults={0}
            />
          }
        />
      );
    }

    const stream = startPage1ReceiptStream(filtered, params, { pageSize });
    return (
      <ResultsPageClient
        {...pageShell}
        results={<Page1ResultsStream stream={stream} />}
        pagination={
          <Page1PaginationStream
            stream={stream}
            params={{ ...params, pageSize }}
            totalResults={filtered.length}
          />
        }
      />
    );
  }

  // Page 2+: remaining from page1Ids; cold page 2 runs page-1 pipeline once.
  const { visibleOffers, page1Ids, needsPage1IdsRedirect } = await resolveResultsPageSlice(
    filtered,
    params,
    { pageSize },
  );

  if (needsPage1IdsRedirect && page1Ids?.length) {
    redirect(
      buildResultsPageHref(
        { ...params, pageSize, page1Ids },
        params.page ?? 2,
      ),
    );
  }
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F3F5F8]">
          <SearchProgressFeedback />
        </main>
      }
    >
      <ResultsPageClient
        {...pageShell}
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
        pagination={
          <ResultsPagination
            params={{ ...params, pageSize, page1Ids }}
            totalResults={filtered.length}
          />
        }
      />
    </Suspense>
  );
}
