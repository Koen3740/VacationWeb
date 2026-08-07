import { FilterSidebar } from '@/components/results/filter-sidebar';
import { NoResults } from '@/components/results/no-results';
import { ResultsPagination } from '@/components/results/results-pagination';
import { SortSelector } from '@/components/results/sort-selector';
import { TravelCard } from '@/components/results/travel-card';
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { deriveDestinationCountryCounts } from '@/lib/offers/derive-destination-countries';
import { loadFilterOptions } from '@/lib/offers/load-filter-options';
import { loadOffers } from '@/lib/offers/load-offers';
import { formatTotalOffersLabel } from '@/lib/offers/load-total-offers-label';
import { filterOffers, sortOffers } from '@/lib/search/filtering';
import { paginateResults, parseResultsPageParam, parseResultsPageSizeParam } from '@/lib/search/pagination';
import { SearchParams } from '@/types/travel';

export const dynamic = 'force-dynamic';

function buildAdjustSearchHref(searchParams: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === 'page' || key === 'pageSize' || key === 'sort') {
      continue;
    }

    if (typeof value === 'string' && value.length > 0) {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `/search?${query}` : '/search';
}

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

export default async function ResultsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
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
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[320px_1fr] lg:px-8">
        <FilterSidebar
          {...filterOptions}
          countryCounts={countryCounts}
          totalOffersLabel={totalOffersLabel}
        />

        <section>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-brand-700">{filtered.length} resultaten</p>
                <h1 className="mt-1 text-3xl font-semibold text-slate-950">Beste vakanties voor jouw profiel</h1>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href={buildAdjustSearchHref(searchParams)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-700">
                  Pas zoekopdracht aan
                </a>
                <SortSelector currentSort={params.sort || 'value'} />
              </div>
            </div>
          </div>

          {visibleOffers.length > 0 ? (
            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              {visibleOffers.map((offer) => (
                <TravelCard key={offer.id} offer={offer} />
              ))}
            </div>
          ) : (
            <NoResults />
          )}

          <ResultsPagination params={params} totalResults={filtered.length} />
        </section>
      </div>
    </main>
  );
}
