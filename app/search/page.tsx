import { SearchForm } from '@/components/search/search-form';
import { loadHostFilterOptions } from '@/lib/offers/present-active-filter-options';
import { requestSiteMarket } from '@/lib/search/request-site-market';
import { formatTotalOffersLabel } from '@/lib/offers/load-total-offers-label';
import type { Metadata } from 'next';

/**
 * Legacy search page (old layout). t66u: no longer linked from header, Results empty state or
 * anywhere in the site; the homepage search module is the primary search entry. Kept as a
 * working direct URL (bookmarks), not indexed so it does not become a search-engine entry.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  // SUB 33D: counts and popup countries follow the host market.
  const filterOptions = await loadHostFilterOptions(requestSiteMarket());
  const countryCounts = filterOptions.countryCounts ?? {};
  const totalOffersLabel = formatTotalOffersLabel(filterOptions.totalOffers ?? 0);

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
