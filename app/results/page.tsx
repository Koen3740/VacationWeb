import { FilterSidebar } from '@/components/results/filter-sidebar';
import { NoResults } from '@/components/results/no-results';
import { ResultsPagination } from '@/components/results/results-pagination';
import { SortSelector } from '@/components/results/sort-selector';
import { ResultsPageClient } from '@/components/results-v2/results-page-client';
import { getDepartureDisplay } from '@/components/search/departure-display';
import {
  expandDurationRange,
  formatSelectedDurationsLabel,
} from '@/components/search/duration-popup/duration-popup-utils';
import { loadPresentedFilterOptions } from '@/lib/offers/present-active-filter-options';
import { loadOffers } from '@/lib/offers/load-offers';
import { formatTotalOffersLabel } from '@/lib/offers/load-total-offers-label';
import {
  Page1PaginationStream,
  Page1ResultsStream,
} from '@/components/results/page1-receipt-stream';
import {
  RESULTS_PRODUCT_PAGE_SIZE,
  startCatalogPageLiveOverlays,
} from '@/lib/providers/prijsvrij';
import {
  selectCatalogPageHydrationIds,
  selectPage1OverlayCandidates,
  selectPaintAlignedPageOverlayCandidates,
  sliceRankedCatalogResultsPage,
} from '@/lib/search/results-catalog-page';
import { hydrateResultsLivePriceOverlaysFromL2 } from '@/lib/search/results-live-price-cache';
import '@/lib/http/prefer-ipv4';
import { countCarRentalFacet, countRoadtripFacet } from '@/lib/search/filtering';
import {
  ACCOMMODATION_TYPE_FILTER_VALUES,
  effectiveAccommodationTypesForFilter,
  parseAccommodationTypesParam,
} from '@/lib/search/accommodation-type-filter';
import { excludeParkedResultsProviders } from '@/lib/search/presentable-price';
import { isPriceDependentSort, prepareResultsOffers } from '@/lib/search/prepare-results-offers';
import { PriceSortResultsStream } from '@/components/results/price-sort-live-stream';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import { formatOccupancySummaryParts } from '@/lib/search/occupancy-category';
import { attachSiteMarket } from '@/lib/search/site-market';
import { SearchParams } from '@/types/travel';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

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

  parts.push(
    ...formatOccupancySummaryParts(params, {
      includeRooms: Boolean(params.rooms && params.rooms > 0),
    }),
  );

  return parts.join(' • ');
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
  const offers = excludeParkedResultsProviders(await loadOffers());

  const filterOptions = await loadPresentedFilterOptions();
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
  const totalOffersLabel = formatTotalOffersLabel(filterOptions.totalOffers ?? offers.length);
  const pageSize = RESULTS_PRODUCT_PAGE_SIZE;
  const page = params.page ?? 1;
  const isPage1 = !Number.isFinite(page) || Math.floor(page) <= 1;

  const prepared = await prepareResultsOffers(offers, filteringParams);
  // Catalog filter matchset (sort-invariant) drives the heading / facets.
  // Presentable card pool is B-only inside page slicing; A/C/Pending stay in
  // the matchset for later pricing retries.
  const filtered = prepared.offers;
  const matchCount = filtered.length;
  const carRentalCount = countCarRentalFacet(filtered, filteringParams);
  const roadtripCount = countRoadtripFacet(filtered, filteringParams);

  const pageShell = {
    departureAirports: filterOptions.departureAirports,
    summaryLine: buildSummaryLine(params),
    sortControl: <SortSelector currentSort={params.sort && params.sort !== 'value' ? params.sort : ''} />,
    filters: (
      <FilterSidebar
        {...filterOptions}
        citiesByCountry={citiesByCountry}
        accommodationTypes={accommodationTypes}
        countryCounts={countryCounts}
        totalOffersLabel={totalOffersLabel}
        carRentalCount={carRentalCount}
        roadtripCount={roadtripCount}
      />
    ),
  };

  if (isPriceDependentSort(params.sort)) {
    if (filtered.length === 0) {
      return (
        <ResultsPageClient
          {...pageShell}
          resultCount={matchCount}
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

    return (
      <ResultsPageClient
        {...pageShell}
        resultCount={matchCount}
        results={
          <PriceSortResultsStream
            provisionalOffers={prepared.offers}
            exactOffers={prepared.exactOffers}
            priceSortPending={prepared.priceSortPending}
            params={{ ...params, pageSize }}
            page={page}
            pageSize={pageSize}
          />
        }
        pagination={null}
      />
    );
  }

  // Catalog first-paint. Full-matchset live pricing was scheduled in
  // prepareResultsOffers (not awaited). Page overlays join cache / in-flight.
  if (filtered.length === 0) {
    return (
      <ResultsPageClient
        {...pageShell}
        resultCount={matchCount}
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

  // GO2 defect 1: L2→L1 hydrate bounded candidate IDs before B-pool page slice.
  // Page 1 FREEZE / page1Ids / selectPage1OverlayCandidates stay on their existing path.
  const hydrationIds = selectCatalogPageHydrationIds(
    filtered,
    isPage1 ? 1 : page,
    pageSize,
    undefined,
    filteringParams,
  );
  await hydrateResultsLivePriceOverlaysFromL2(hydrationIds, filteringParams);

  const catalogPage = sliceRankedCatalogResultsPage(
    filtered,
    isPage1 ? 1 : page,
    pageSize,
    filteringParams,
  );
  const overlayCandidates = isPage1
    ? selectPage1OverlayCandidates(filtered, pageSize, undefined, filteringParams)
    : selectPaintAlignedPageOverlayCandidates(
        filtered,
        catalogPage.offers,
        pageSize,
        undefined,
        filteringParams,
      );
  // Drive overlays from the live-price candidate window (pending/C/B, not A).
  // Presentable paint stays B-only via TravelCard; Cap backfills as B settles.
  const streamOffers =
    catalogPage.offers.length > 0
      ? catalogPage.offers
      : overlayCandidates.slice(0, pageSize);
  const overlays = startCatalogPageLiveOverlays(
    overlayCandidates.length > 0 ? overlayCandidates : streamOffers,
    params,
  );

  return (
    <ResultsPageClient
      {...pageShell}
      resultCount={matchCount}
      results={
        streamOffers.length > 0 || overlayCandidates.length > 0 ? (
          <Page1ResultsStream
            catalogOffers={streamOffers.length > 0 ? streamOffers : overlayCandidates}
            candidateOffers={overlayCandidates}
            displayLimit={pageSize}
            overlays={overlays}
            searchParams={{ ...params, pageSize }}
          />
        ) : (
          <NoResults />
        )
      }
      pagination={
        <Page1PaginationStream
          params={{ ...params, pageSize }}
          page1Ids={catalogPage.page1Ids}
          paginationTotal={catalogPage.paginationTotal}
        />
      }
    />
  );
}
