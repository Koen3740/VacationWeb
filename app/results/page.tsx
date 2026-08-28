import { FilterSidebar } from '@/components/results/filter-sidebar';
import { NoResults } from '@/components/results/no-results';
import { ResultsRefinementRequired } from '@/components/results/results-refinement-required';
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
  orderCatalogPageCandidates,
  selectPage1OverlayCandidates,
  sliceRankedCatalogResultsPage,
} from '@/lib/search/results-catalog-page';
import '@/lib/http/prefer-ipv4';
import { countCarRentalFacet } from '@/lib/search/filtering';
import {
  ACCOMMODATION_TYPE_FILTER_VALUES,
  effectiveAccommodationTypesForFilter,
  parseAccommodationTypesParam,
} from '@/lib/search/accommodation-type-filter';
import { excludeParkedResultsProviders } from '@/lib/search/presentable-price';
import { isPriceDependentSort, prepareResultsOffers } from '@/lib/search/prepare-results-offers';
import { PriceSortResultsStream } from '@/components/results/price-sort-live-stream';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import { evaluateResultsResultsetLimit } from '@/lib/search/results-resultset-limit';
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
  const resultsetLimit = evaluateResultsResultsetLimit(offers, filteringParams);
  const pageSize = RESULTS_PRODUCT_PAGE_SIZE;
  const page = params.page ?? 1;
  const isPage1 = !Number.isFinite(page) || Math.floor(page) <= 1;
  const carRentalCount = countCarRentalFacet(resultsetLimit.ranked, filteringParams);

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
      />
    ),
  };

  if (resultsetLimit.overLimit) {
    return (
      <ResultsPageClient
        {...pageShell}
        resultCount={0}
        refinementRequired
        results={<ResultsRefinementRequired />}
        pagination={null}
      />
    );
  }

  const prepared = await prepareResultsOffers(offers, filteringParams);
  // Full filtered+ranked matchset is the user result set — never slice(0, 150) for browse/count.
  const filtered = prepared.offers;
  // Count matches listable user set: presentable first, pending listable, excludes settled A/C.
  const orderedPool = orderCatalogPageCandidates(filtered, filteringParams);
  const matchCount = orderedPool.length;

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

  const catalogPage = sliceRankedCatalogResultsPage(
    filtered,
    isPage1 ? 1 : page,
    pageSize,
    filteringParams,
  );
  const overlayCandidates = isPage1
    ? selectPage1OverlayCandidates(orderedPool, pageSize)
    : catalogPage.offers;
  const overlays = startCatalogPageLiveOverlays(overlayCandidates, params);

  return (
    <ResultsPageClient
      {...pageShell}
      resultCount={matchCount}
      results={
        catalogPage.offers.length > 0 ? (
          <Page1ResultsStream
            catalogOffers={catalogPage.offers}
            candidateOffers={isPage1 ? overlayCandidates : undefined}
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
