import { Playfair_Display, DM_Sans } from 'next/font/google';
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
import { loadHostFilterOptions } from '@/lib/offers/present-active-filter-options';
import { requestSiteMarket } from '@/lib/search/request-site-market';
import { chromeCopy } from '@/lib/i18n/chrome-copy';
import { requestUiLanguage } from '@/lib/i18n/request-ui-language';
import { isHomeLivePricePrefetchEnabled } from '@/lib/search/home-live-price-prefetch-context';

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
  // SUB 33D: counts, popup countries, airports and popular destinations follow the host market.
  const filterOptions = await loadHostFilterOptions(requestSiteMarket());
  const countryCounts = filterOptions.countryCounts ?? {};
  const popularDestinations = filterOptions.popularDestinations ?? [];
  const totalOffersLabel = formatTotalOffersLabel(filterOptions.totalOffers ?? 0);
  const discoverDestinations = getHomepageDiscoverDestinations({ limit: 5 });
  const livePricePrefetchEnabled = isHomeLivePricePrefetchEnabled();
  // t66u: UI language (presentation only; .be NL/FR, .nl NL). Never filters inventory.
  const copy = chromeCopy(requestUiLanguage().language);

  return (
    <main
      className={`${playfair.variable} ${dmSans.variable} min-h-screen overflow-x-hidden bg-[#FBF6F0] text-[#0A2D62] antialiased`}
      style={{ fontFamily: 'var(--font-vw-sans), system-ui, sans-serif' }}
    >
      <HomeHero
        countryCounts={countryCounts}
        departureAirports={filterOptions.departureAirports}
        totalOffersLabel={totalOffersLabel}
        livePricePrefetchEnabled={livePricePrefetchEnabled}
        copy={copy.hero}
      />
      <HomeTrustStrip copy={copy.trust} />
      <HomeDiscoverTeaser destinations={discoverDestinations} copy={copy.discover} />
      <HomeInspirationBand copy={copy.inspiration} />
      <HomePopularDestinations destinations={popularDestinations} copy={copy.popular} />
      <HomeValueSection copy={copy.value} />
      <HomeNewsletter />
      <HomeFooter />
    </main>
  );
}
