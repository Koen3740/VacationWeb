import { Playfair_Display, DM_Sans } from 'next/font/google';
import { HomeCookieBanner } from '@/components/home/home-cookie-banner';
import { HomeDiscoverTeaser } from '@/components/home/home-discover-teaser';
import { getHomepageDiscoverDestinations } from '@/lib/discover/get-homepage-discover-destinations';
import { HomeFooter } from '@/components/home/home-footer';
import { HomeHero } from '@/components/home/home-hero';
import { HomeInspirationBand } from '@/components/home/home-inspiration-band';
import { HomeNewsletter } from '@/components/home/home-newsletter';
import { HomePopularDestinations } from '@/components/home/home-popular-destinations';
import { HomeTrustStrip } from '@/components/home/home-trust-strip';
import { HomeValueSection } from '@/components/home/home-value-section';
import { formatTotalOffersLabel } from '@/lib/offers/load-total-offers-label';
import { loadFilterOptions } from '@/lib/offers/load-filter-options';

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-vw-serif',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-vw-sans',
  display: 'swap',
});

export const dynamic = 'force-dynamic';

/**
 * WOW homepage — real DOM sections matching wow-ssot-homepage.png.
 * Replaces HomeExactTop / HomeExactBody slabs. No Concept C sections.
 */
export default async function HomePage() {
  const filterOptions = loadFilterOptions();
  const countryCounts = filterOptions.countryCounts ?? {};
  const popularDestinations = filterOptions.popularDestinations ?? [];
  const totalOffersLabel = formatTotalOffersLabel(filterOptions.totalOffers ?? 0);
  const discoverDestinations = getHomepageDiscoverDestinations({ limit: 5 });

  return (
    <main
      className={`${playfair.variable} ${dmSans.variable} min-h-screen overflow-x-hidden bg-[#FBF6F0] text-[#0A2D62] antialiased`}
      style={{ fontFamily: 'var(--font-vw-sans), system-ui, sans-serif' }}
    >
      <HomeHero
        countryCounts={countryCounts}
        departureAirports={filterOptions.departureAirports}
        totalOffersLabel={totalOffersLabel}
      />
      <HomeTrustStrip />
      <HomeDiscoverTeaser destinations={discoverDestinations} />
      <HomeInspirationBand />
      <HomePopularDestinations destinations={popularDestinations} />
      <HomeValueSection />
      <HomeNewsletter />
      <HomeFooter />
      <HomeCookieBanner />
    </main>
  );
}
