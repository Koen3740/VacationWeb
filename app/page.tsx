import { RESULTS_PAGE_BG } from '@/components/results-v2/results-design-tokens';
import { HomeCookieBanner } from '@/components/home/home-cookie-banner';
import { HomeFeatures } from '@/components/home/home-features';
import { HomeFooter } from '@/components/home/home-footer';
import { HomeHero } from '@/components/home/home-hero';
import { HomePopularDestinations } from '@/components/home/home-popular-destinations';
import { HomeThemes } from '@/components/home/home-themes';
import { HomeWhyVacationWeb } from '@/components/home/home-why-vacationweb';
import { formatTotalOffersLabel } from '@/lib/offers/load-total-offers-label';
import { loadFilterOptions } from '@/lib/offers/load-filter-options';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const filterOptions = loadFilterOptions();
  const countryCounts = filterOptions.countryCounts ?? {};
  const popularDestinations = filterOptions.popularDestinations ?? [];
  const homeThemes = filterOptions.homeThemes ?? [];
  const totalOffersLabel = formatTotalOffersLabel(filterOptions.totalOffers ?? 0);

  return (
    <main className="min-h-screen text-slate-900" style={{ backgroundColor: RESULTS_PAGE_BG }}>
      <HomeHero
        countryCounts={countryCounts}
        departureAirports={filterOptions.departureAirports}
        totalOffersLabel={totalOffersLabel}
      />
      <section className="border-t border-[#DCE4EE] bg-[#EAF1F7]">
        <div className="mx-auto max-w-[1200px] px-6 py-5 lg:px-8">
          <HomeFeatures />
        </div>
      </section>
      <HomePopularDestinations destinations={popularDestinations} />
      <HomeThemes themes={homeThemes} />
      <HomeWhyVacationWeb />
      <HomeFooter />
      <HomeCookieBanner />
    </main>
  );
}
