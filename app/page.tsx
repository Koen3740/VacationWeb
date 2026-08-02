import { HomeFeatures } from '@/components/home/home-features';
import { HomeHero } from '@/components/home/home-hero';
import { HomePopularDestinations } from '@/components/home/home-popular-destinations';
import { deriveDestinationCountryCounts } from '@/lib/offers/derive-destination-countries';
import { loadOffers } from '@/lib/offers/load-offers';
import { loadTotalOffersLabel } from '@/lib/offers/load-total-offers-label';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const offers = await loadOffers();
  const countryCounts = Object.fromEntries(
    deriveDestinationCountryCounts(offers).map(({ name, count }) => [name, count]),
  );
  const totalOffersLabel = await loadTotalOffersLabel();

  return (
    <main className="min-h-screen bg-[#F5F7FA]">
      <HomeHero countryCounts={countryCounts} totalOffersLabel={totalOffersLabel} />
      <section className="bg-[#0A2D62] py-6">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-5 lg:px-6">
          <HomeFeatures />
        </div>
      </section>
      <HomePopularDestinations />
    </main>
  );
}
