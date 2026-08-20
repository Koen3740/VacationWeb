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
  tryCatalogRefinePage1,
} from '@/lib/providers/prijsvrij';
import { countCarRentalFacet } from '@/lib/search/filtering';
import { isPriceDependentSort, prepareResultsOffers } from '@/lib/search/prepare-results-offers';
import { PriceSortResultsStream } from '@/components/results/price-sort-live-stream';
import {
  buildResultsPageHref,
  limitRankedResultsForPagination,
} from '@/lib/search/pagination';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import { formatOccupancySummaryParts } from '@/lib/search/occupancy-category';
import { attachSiteMarket } from '@/lib/search/site-market';
import { SearchParams } from '@/types/travel';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { Suspense } from 'react';

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
  const offers = await loadOffers();
  const filterOptions = loadFilterOptions();
  const citiesByCountry = filterOptions.citiesByCountry ?? {};
  const accommodationTypes = filterOptions.accommodationTypes ?? [];
  const countryCounts = filterOptions.countryCounts ?? {};
  const totalOffersLabel = formatTotalOffersLabel(filterOptions.totalOffers ?? offers.length);
  const prepared = await prepareResultsOffers(offers, params);
  const filtered = prepared.offers;
  const matchCount = filtered.length;
  const carRentalCount = countCarRentalFacet(offers, params);
  const userPool = limitRankedResultsForPagination(filtered);
  const pageSize = RESULTS_PRODUCT_PAGE_SIZE;
  const page = params.page ?? 1;
  const isPage1 = !Number.isFinite(page) || Math.floor(page) <= 1;

  const pageShell = {
    departureAirports: filterOptions.departureAirports,
    resultCount: matchCount,
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

  if (isPriceDependentSort(params.sort)) {
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

    return (
      <ResultsPageClient
        {...pageShell}
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

  // Page 1: stream non-Receipt cards immediately; PV slots resolve independently.
  // Full-matchset live pricing is scheduled above and is not awaited here.
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

    const catalogPage1 = tryCatalogRefinePage1(filtered, params, {
      pageSize,
      paginationPool: userPool,
    });
    if (catalogPage1) {
      return (
        <ResultsPageClient
          {...pageShell}
          results={
            <div className="space-y-3.5">
              {catalogPage1.visibleOffers.map((offer) => (
                <TravelCard key={offer.id} offer={offer} searchParams={params} />
              ))}
            </div>
          }
          pagination={
            <ResultsPagination
              params={{ ...params, pageSize, page1Ids: catalogPage1.page1Ids }}
              totalResults={catalogPage1.paginationTotal}
            />
          }
        />
      );
    }

    const stream = startPage1ReceiptStream(filtered, params, {
      pageSize,
      paginationPool: userPool,
    });
    return (
      <ResultsPageClient
        {...pageShell}
        results={<Page1ResultsStream stream={stream} searchParams={{ ...params, pageSize }} />}
        pagination={
          <Page1PaginationStream
            stream={stream}
            params={{ ...params, pageSize }}
            replaceExistingPage1Ids={Boolean(params.page1Ids?.length)}
          />
        }
      />
    );
  }

  // Page 2+: remaining from page1Ids; cold page 2 runs page-1 pipeline once.
  const { visibleOffers, page1Ids, needsPage1IdsRedirect, paginationTotal } = await resolveResultsPageSlice(
    filtered,
    params,
    { pageSize, paginationPool: userPool },
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
                <TravelCard key={offer.id} offer={offer} searchParams={params} />
              ))}
            </div>
          ) : (
            <NoResults />
          )
        }
        pagination={
            <ResultsPagination
              params={{ ...params, pageSize, page1Ids }}
              totalResults={paginationTotal}
            />
        }
      />
    </Suspense>
  );
}
