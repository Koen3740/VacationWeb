import { HomeFeatures } from '@/components/home/home-features';
import { HomeHero } from '@/components/home/home-hero';
import { HomePopularCountries } from '@/components/home/home-popular-countries';
import { HomePopularDestinations } from '@/components/home/home-popular-destinations';
import {
  deriveDestinationCountryCounts,
  derivePopularCountries,
  derivePopularDestinations,
} from '@/lib/offers/derive-destination-countries';
import { formatTotalOffersLabel } from '@/lib/offers/load-total-offers-label';
import { loadOffers } from '@/lib/offers/load-offers';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const offers = await loadOffers();
  const countryCounts = Object.fromEntries(
    deriveDestinationCountryCounts(offers).map(({ name, count }) => [name, count]),
  );
  const popularDestinations = derivePopularDestinations(offers);
  const popularCountries = derivePopularCountries(offers);
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
      <HomePopularCountries countries={popularCountries} />
    </main>
  );
}
