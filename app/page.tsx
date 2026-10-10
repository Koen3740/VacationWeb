import { HomeDiscoverTeaser } from '@/components/home/home-discover-teaser';
import { HomeFooter } from '@/components/home/home-footer';
import { HomeHero } from '@/components/home/home-hero';
import { HomeHeroBackdrop } from '@/components/home/home-hero-backdrop';
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

export const dynamic = 'force-dynamic';

/**
 * Homepage variant 1: one fixed photo, content scrolls over it in glass.
 * The photo is `HOMEPAGE_HERO_PHOTO` (see HomeHeroBackdrop).
 */
export default async function HomePage() {
  // SUB 33D: counts, popup countries, airports and popular destinations follow the host market.
  const filterOptions = await loadHostFilterOptions(requestSiteMarket());
  const countryCounts = filterOptions.countryCounts ?? {};
  const popularDestinations = filterOptions.popularDestinations ?? [];
  const totalOffersLabel = formatTotalOffersLabel(filterOptions.totalOffers ?? 0);
  const livePricePrefetchEnabled = isHomeLivePricePrefetchEnabled();
  // t66u: UI language (presentation only; .be NL/FR, .nl NL). Never filters inventory.
  const copy = chromeCopy(requestUiLanguage().language);

  return (
    <>
      <HomeHeroBackdrop />
      <main className="relative z-[1] min-h-screen font-vw-sans text-white antialiased">
        <HomeHero
          countryCounts={countryCounts}
          departureAirports={filterOptions.departureAirports}
          totalOffersLabel={totalOffersLabel}
          livePricePrefetchEnabled={livePricePrefetchEnabled}
          copy={copy.hero}
        />
        <HomeTrustStrip copy={copy.trust} />
        <HomeDiscoverTeaser copy={copy.discover} />
        <HomeValueSection copy={copy.value} />
        <HomePopularDestinations destinations={popularDestinations} copy={copy.popular} />
        <HomeInspirationBand copy={copy.inspiration} />
        <HomeNewsletter />
        <HomeFooter />
      </main>
    </>
  );
}
