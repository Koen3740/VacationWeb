import { HomeCookieBanner } from '@/components/home/home-cookie-banner';
import { HomeFeatures } from '@/components/home/home-features';
import { HomeFooter } from '@/components/home/home-footer';
import { HomeHero } from '@/components/home/home-hero';
import { HomePopularDestinations } from '@/components/home/home-popular-destinations';
import { HomeThemes } from '@/components/home/home-themes';
import { HomeWhyVacationWeb } from '@/components/home/home-why-vacationweb';
import {
  deriveDestinationCountryCounts,
  derivePopularDestinations,
} from '@/lib/offers/derive-destination-countries';
import { deriveHomeThemes } from '@/lib/offers/derive-home-themes';
import { formatTotalOffersLabel } from '@/lib/offers/load-total-offers-label';
import { loadOffers } from '@/lib/offers/load-offers';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const offers = await loadOffers();
  const countryCounts = Object.fromEntries(
    deriveDestinationCountryCounts(offers).map(({ name, count }) => [name, count]),
  );
  const popularDestinations = derivePopularDestinations(offers);
  const homeThemes = deriveHomeThemes(offers);
  const totalOffersLabel = formatTotalOffersLabel(offers.length);

  return (
    <main className="min-h-screen bg-[#F5F7FA]">
      <HomeHero countryCounts={countryCounts} totalOffersLabel={totalOffersLabel} />
      <section className="bg-[#0A2D62] py-6">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-5 lg:px-6">
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
