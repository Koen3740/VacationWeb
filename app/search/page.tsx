import { SearchForm } from '@/components/search/search-form';
import { deriveDestinationCountryCounts } from '@/lib/offers/derive-destination-countries';
import { loadFilterOptions } from '@/lib/offers/load-filter-options';
import { loadOffers } from '@/lib/offers/load-offers';
import { formatTotalOffersLabel } from '@/lib/offers/load-total-offers-label';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const filterOptions = loadFilterOptions();
  const offers = await loadOffers();
  const countryCounts = Object.fromEntries(
    deriveDestinationCountryCounts(offers).map(({ name, count }) => [name, count]),
  );
  const totalOffersLabel = formatTotalOffersLabel(offers.length);

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-slate-200/80">
          <div className="bg-[linear-gradient(135deg,_rgba(29,78,216,0.95),_rgba(14,116,144,0.95))] px-8 py-16 text-white lg:px-12">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.3em] text-blue-100">VacationWeb search</p>
              <h1 className="mt-4 text-4xl font-semibold sm:text-5xl">Vergelijk vakanties op budget, reisduur en prijs per dag.</h1>
              <p className="mt-6 text-lg text-blue-50">
                Kies jouw bestemming, vertrekperiode, budget en verzorging om beschikbare opties te vergelijken.
              </p>
            </div>
          </div>
          <div className="p-8 lg:p-10">
            <SearchForm
              {...filterOptions}
              searchParams={searchParams}
              countryCounts={countryCounts}
              totalOffersLabel={totalOffersLabel}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
