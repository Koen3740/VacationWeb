import { FilterSidebar } from '@/components/results/filter-sidebar';
import { SortSelector } from '@/components/results/sort-selector';
import { TravelCard } from '@/components/results/travel-card';
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { loadFilterOptions } from '@/lib/offers/load-filter-options';
import { loadOffers } from '@/lib/offers/load-offers';
import { filterOffers, sortOffers } from '@/lib/search/filtering';
import { parseResultsPageParam, parseResultsPageSizeParam } from '@/lib/search/pagination';
import { SearchParams } from '@/types/travel';

export const dynamic = 'force-dynamic';

function parseSearchParams(searchParams: Record<string, string | string[] | undefined>): SearchParams {
  const boardTypes = typeof searchParams.boardTypes === 'string' ? searchParams.boardTypes.split(',') : undefined;

  return {
    country: typeof searchParams.country === 'string'
      ? canonicalizeCountryName(searchParams.country)
      : undefined,
    region: typeof searchParams.region === 'string' ? searchParams.region : undefined,
    budgetMin: typeof searchParams.budgetMin === 'string' ? Number(searchParams.budgetMin) : undefined,
    budgetMax: typeof searchParams.budgetMax === 'string' ? Number(searchParams.budgetMax) : undefined,
    nightsMin: typeof searchParams.nightsMin === 'string' ? Number(searchParams.nightsMin) : undefined,
    nightsMax: typeof searchParams.nightsMax === 'string' ? Number(searchParams.nightsMax) : undefined,
    boardTypes,
    adults: typeof searchParams.adults === 'string' ? Number(searchParams.adults) : undefined,
    children: typeof searchParams.children === 'string' ? Number(searchParams.children) : undefined,
    rooms: typeof searchParams.rooms === 'string' ? Number(searchParams.rooms) : undefined,
    departureStart: typeof searchParams.departureStart === 'string' ? searchParams.departureStart : undefined,
    departureEnd: typeof searchParams.departureEnd === 'string' ? searchParams.departureEnd : undefined,
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
  const filtered = sortOffers(filterOffers(offers, params), params.sort);
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[320px_1fr] lg:px-8">
        <FilterSidebar {...filterOptions} />

        <section>
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-brand-700">{filtered.length} resultaten</p>
                <h1 className="mt-1 text-3xl font-semibold text-slate-950">Beste vakanties voor jouw profiel</h1>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="/search" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-700">
                  Pas zoekopdracht aan
                </a>
                <SortSelector currentSort={params.sort || 'value'} />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            {filtered.map((offer) => (
              <TravelCard key={offer.id} offer={offer} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
