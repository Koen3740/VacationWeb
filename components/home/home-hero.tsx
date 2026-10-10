import { HomeHeader } from '@/components/home/home-header';
import { HomeSearch } from '@/components/home/home-search';
import { HOMEPAGE_HERO_PHOTO } from '@/lib/home/homepage-hero-photo';
import { CHROME_COPY, type ChromeCopy } from '@/lib/i18n/chrome-copy';

type HomeHeroProps = {
  countryCounts: Record<string, number>;
  departureAirports: string[];
  totalOffersLabel: string;
  livePricePrefetchEnabled?: boolean;
  /** t66u: translated hero copy (default Dutch). */
  copy?: ChromeCopy['hero'];
};

/**
 * Homepage hero over the fixed photo: text on the left, glass search below.
 * The photo itself lives in HomeHeroBackdrop (one config entry).
 */
export function HomeHero({
  countryCounts,
  departureAirports,
  totalOffersLabel,
  livePricePrefetchEnabled = false,
  copy = CHROME_COPY.nl.hero,
}: HomeHeroProps) {
  const credit = HOMEPAGE_HERO_PHOTO.credit;
  return (
    <>
      <HomeHeader />
      <section
        id="hero"
        className="relative flex min-h-[auto] flex-col justify-start px-[18px] pb-10 pt-[92px] sm:min-h-[100svh] sm:justify-center sm:px-[clamp(20px,4vw,56px)] sm:pb-[110px] sm:pt-[120px]"
      >
        <div className="mx-auto w-full max-w-[1180px]">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.3)] sm:mb-[18px] sm:text-[12.5px]">
            {copy.eyebrow}
          </p>
          <h1 className="vw-home-h1">{copy.title}</h1>
          <p className="mt-3 max-w-[46ch] text-[15.5px] leading-relaxed text-white/95 [text-shadow:0_1px_12px_rgba(0,0,0,0.35)] sm:mt-5 sm:text-[clamp(16px,1.35vw,19px)]">
            {copy.subtitle}
          </p>
          <div className="mt-6 sm:mt-10">
            <HomeSearch
              countryCounts={countryCounts}
              departureAirports={departureAirports}
              totalOffersLabel={totalOffersLabel}
              livePricePrefetchEnabled={livePricePrefetchEnabled}
            />
          </div>
        </div>
        <a
          href={credit.photoPage}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto mt-6 max-w-[1180px] text-[11px] text-white/70 underline decoration-white/30 underline-offset-2 hover:text-white sm:absolute sm:bottom-8 sm:left-[clamp(20px,4vw,56px)] sm:mx-0 sm:mt-0"
        >
          {credit.place} · {credit.source}
        </a>
        <div className="mt-5 flex flex-row items-center justify-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/80 sm:absolute sm:bottom-[34px] sm:left-1/2 sm:mt-0 sm:-translate-x-1/2 sm:flex-col sm:gap-2.5">
          <i className="vw-scrollhint-line sm:hidden" aria-hidden />
          <span>{copy.scrollHint}</span>
          <i className="vw-scrollhint-line" aria-hidden />
        </div>
      </section>
    </>
  );
}
