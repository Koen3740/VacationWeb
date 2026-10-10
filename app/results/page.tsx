import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { FilterSidebar } from '@/components/results/filter-sidebar';
import { SortSelector } from '@/components/results/sort-selector';
import { ResultsPageClient } from '@/components/results-v2/results-page-client';
import { getDepartureDisplay } from '@/components/search/departure-display';
import {
  expandDurationRange,
  formatSelectedDurationsLabel,
} from '@/components/search/duration-popup/duration-popup-utils';
import { loadPresentedFilterOptions } from '@/lib/offers/present-active-filter-options';
import { formatTotalOffersLabel } from '@/lib/offers/load-total-offers-label';
import { RESULTS_PRODUCT_PAGE_SIZE } from '@/lib/providers/prijsvrij';
import '@/lib/http/prefer-ipv4';
import {
  ACCOMMODATION_TYPE_FILTER_VALUES,
  effectiveAccommodationTypesForFilter,
  parseAccommodationTypesParam,
} from '@/lib/search/accommodation-type-filter';
import { isPriceDependentSort } from '@/lib/search/prepare-results-offers';
import { PriceSortPreparedSection } from '@/components/results/price-sort-prepared-section';
import { CatalogLiveSection } from '@/components/results/catalog-live-section';
import {
  PresentableResultsCount,
  PriceSortPresentableCount,
} from '@/components/results/presentable-results-count';
import {
  CarRentalFacetCount,
  RoadtripFacetCount,
} from '@/components/results/results-facet-counts';
import {
  ProviderFilterFromPool,
  ProviderFilterSelectFallback,
} from '@/components/results/provider-filter-from-pool';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import {
  shouldInvalidateResultsFreeze,
  stripResultsFreezePaging,
} from '@/lib/search/catalog-generation-freeze';
import { buildResultsPageHref } from '@/lib/search/pagination';
import { loadRuntimeDataset } from '@/lib/offers/load-runtime-dataset';
import { formatOccupancySummaryParts } from '@/lib/search/occupancy-category';
import { buildResultsTripSummary } from '@/lib/search/results-trip-summary';
import { stateFromUrl } from '@/components/results-v2/results-search-bar-utils';
import { decodeDestinationLabel, destinationDisplayLabel } from '@/components/search/destination-popup/destination-search';
import { attachSiteMarket } from '@/lib/search/site-market';
import { SearchParams } from '@/types/travel';
import { headers } from 'next/headers';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

// Privacy (t361u): result URLs carry the search party (adults/childAges). Never index or follow them.
// Paired with the noindex/no-store response headers in next.config.js. Do NOT also Disallow in
// robots.txt: a crawler that cannot fetch the page would never see the noindex.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function buildSummaryLine(params: SearchParams): string {
  const parts: string[] = [];

  if (params.countries?.length) {
    parts.push(params.countries.join(', '));
  } else if (params.country) {
    parts.push(params.country);
  }

  // Display labels follow the destination label rule (name first, context last); a raw provider
  // composite such as "Chania - Kalamaki" never shows. URL values are untouched.
  const summaryCountry = params.countries?.length === 1 ? params.countries[0] : params.country;
  if (params.region) {
    parts.push(
      (params.city ? undefined : destinationDisplayLabel(summaryCountry, { region: params.region })) ??
        params.region,
    );
  }

  if (params.city) {
    parts.push(
      destinationDisplayLabel(summaryCountry, { city: params.city }) ??
        decodeDestinationLabel(params.city),
    );
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

  parts.push(
    ...formatOccupancySummaryParts(params, {
      includeRooms: Boolean(params.rooms && params.rooms > 0),
    }),
  );

  return parts.join(' • ');
}

/** Dates the search bar shows. Search itself still uses the sanitized window. */
function tripSummaryForRequest(
  searchParams: Record<string, string | string[] | undefined>,
  params: SearchParams,
): string {
  const raw = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === 'string') {
      raw.set(key, value);
    } else if (Array.isArray(value) && value[0]) {
      raw.set(key, value[0]);
    }
  }
  const bar = stateFromUrl(raw);
  return buildResultsTripSummary({
    ...params,
    departureStart: bar.departureStart ?? undefined,
    departureEnd: bar.departureEnd ?? undefined,
    flexibilityDays: bar.flexibilityDays,
  });
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = attachSiteMarket(
    parseSearchParams(searchParams),
    headers().get('x-forwarded-host') ?? headers().get('host'),
  );
  // Page 15 Gold: invalidate stale/legacy page1Ids BEFORE CatalogLive hydrate
  // (avoids discover-prefix ~190-ID work on a freeze that will be discarded).
  const runtimeDataset = await loadRuntimeDataset();
  if (
    shouldInvalidateResultsFreeze({
      page1Ids: params.page1Ids,
      catalogGen: params.catalogGen,
      currentGenerationId: runtimeDataset.generationId,
    })
  ) {
    redirect(buildResultsPageHref(stripResultsFreezePaging(params), 1));
  }
  // GO9: shell skips the catalog offer load on the critical path (O(catalog)).
  // Filter options come from the cached runtime dataset; prepare loads offers inside Suspense.
  const filterOptions = await loadPresentedFilterOptions(params.siteMarket);
  const citiesByCountry = filterOptions.citiesByCountry ?? {};
  const accommodationTypes = filterOptions.accommodationTypes ?? [];
  const visibleAccommodationTypes = ACCOMMODATION_TYPE_FILTER_VALUES.filter((type) =>
    accommodationTypes.some((item) => item.toLowerCase() === type.toLowerCase()),
  );
  const filteringParams: SearchParams = {
    ...params,
    accommodationTypes: (() => {
      if (!params.accommodationTypes?.length) {
        return undefined;
      }
      const effective = effectiveAccommodationTypesForFilter(
        parseAccommodationTypesParam(params.accommodationTypes.join(',')),
        visibleAccommodationTypes.length > 0
          ? visibleAccommodationTypes
          : ACCOMMODATION_TYPE_FILTER_VALUES,
      );
      return effective.length > 0 ? effective : undefined;
    })(),
  };
  const countryCounts = filterOptions.countryCounts ?? {};
  const totalOffersLabel = formatTotalOffersLabel(filterOptions.totalOffers ?? 0);
  const pageSize = RESULTS_PRODUCT_PAGE_SIZE;
  const page = params.page ?? 1;
  const isPage1 = !Number.isFinite(page) || Math.floor(page) <= 1;

  // GO6: shell must not await prepare/filter/rank — that made TTFB scale with pool.
  // prepareResultsOffers runs inside Suspense via loadPreparedResultsOffers (React cache).
  if (process.env.VACATIONWEB_RESULTS_TIMING === '1') {
    console.info(
      '[results-timing]',
      JSON.stringify({
        phase: 'results-shell',
        catalogOffers: filterOptions.totalOffers ?? 0,
        note: 'prepare deferred into Suspense; shell skips catalog offer load',
      }),
    );
  }

  const pageShell = {
    departureAirports: filterOptions.departureAirports,
    summaryLine: buildSummaryLine(params),
    tripSummary: tripSummaryForRequest(searchParams, params),
    sortControl: <SortSelector currentSort={params.sort && params.sort !== 'value' ? params.sort : ''} />,
    filters: (
      <FilterSidebar
        {...filterOptions}
        citiesByCountry={citiesByCountry}
        accommodationTypes={accommodationTypes}
        countryCounts={countryCounts} /* GO8 audit: destination popup metadata only; not numeric sidebar badges */
        totalOffersLabel={totalOffersLabel}
        /* GO8: B-only presentable facet counts (same source as heading/cards). */
        carRentalCount={
          <Suspense fallback="…">
            <CarRentalFacetCount
              filteringParams={filteringParams}
              params={params}
              page={page}
              pageSize={pageSize}
              isPage1={isPage1}
            />
          </Suspense>
        }
        roadtripCount={
          <Suspense fallback="…">
            <RoadtripFacetCount
              filteringParams={filteringParams}
              params={params}
              page={page}
              pageSize={pageSize}
              isPage1={isPage1}
            />
          </Suspense>
        }
        providerFilter={
          <Suspense
            fallback={
              <ProviderFilterSelectFallback selectedProvider={params.provider} />
            }
          >
            <ProviderFilterFromPool
              filteringParams={filteringParams}
              selectedProvider={params.provider}
            />
          </Suspense>
        }
      />
    ),
  };

  // GO7: price-sort prepare also deferred into Suspense (shared cache).
  if (isPriceDependentSort(params.sort)) {
    return (
      <ResultsPageClient
        {...pageShell}
        resultCount={0}
        sectionHeading={
          <Suspense fallback="…">
            <PriceSortPresentableCount
              filteringParams={filteringParams}
              params={params}
              page={page}
              pageSize={pageSize}
              summaryLine={pageShell.summaryLine}
              variant="section"
            />
          </Suspense>
        }
        results={
          <Suspense fallback="Vakanties laden…">
            <PriceSortPreparedSection
              filteringParams={filteringParams}
              params={params}
              page={page}
              pageSize={pageSize}
            />
          </Suspense>
        }
        pagination={null}
      />
    );
  }

  // GO6: shell flushes without matchset; prepare+hydrate+B-slice inside Suspense.
  return (
    <ResultsPageClient
      {...pageShell}
      resultCount={0}
      sectionHeading={
        <Suspense fallback="…">
          <PresentableResultsCount
            filteringParams={filteringParams}
            params={params}
            page={page}
            pageSize={pageSize}
            isPage1={isPage1}
            summaryLine={pageShell.summaryLine}
            refinementRequired={false}
            variant="section"
          />
        </Suspense>
      }
      results={
        <CatalogLiveSection
          filteringParams={filteringParams}
          params={params}
          page={page}
          pageSize={pageSize}
          isPage1={isPage1}
        />
      }
      pagination={null}
    />
  );
}
