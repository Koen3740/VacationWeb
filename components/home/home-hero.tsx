import Image from 'next/image';
import { HomeHeader } from '@/components/home/home-header';
import { HomeSearch } from '@/components/home/home-search';
import { StarBadgeIcon } from '@/components/home/home-search-icons';

type HomeHeroProps = {
  countryCounts: Record<string, number>;
  departureAirports: string[];
  totalOffersLabel: string;
};

/**
 * Homepage hero: taller than Results (homepage job), but identical image treatment
 * and overlays as ResultsHero — no invented saturate/contrast filters.
 */
export function HomeHero({ countryCounts, departureAirports, totalOffersLabel }: HomeHeroProps) {
  return (
    <>
      <HomeHeader />

      <section className="relative">
        <div className="relative h-[420px] w-full overflow-hidden sm:h-[460px] lg:h-[500px]">
          <Image
            src="/images/homepage-hero-background.png"
            alt=""
            fill
            priority
            className="object-cover object-[48%_42%]"
            sizes="100vw"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/28 to-black/12"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/42 via-transparent to-black/18"
            aria-hidden="true"
          />

          <div className="relative z-10 mx-auto flex h-full max-w-[1600px] flex-col justify-center px-6 pb-16 pt-8 lg:px-8">
            <div className="max-w-xl lg:max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[13px] font-medium tracking-wide text-white/95 backdrop-blur-sm">
                <StarBadgeIcon />
                Eén zoekopdracht
              </p>

              <h1 className="mt-5 max-w-xl text-[2rem] font-bold leading-[1.15] tracking-tight text-white drop-shadow-sm sm:text-[2.5rem] lg:text-[2.75rem]">
                Meer vakantie
                <br />
                voor jouw budget
              </h1>

              <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-white/95 sm:text-[18px]">
                Vergelijk vakanties van meerdere reispartners in één zoekopdracht. Ontdek waar jouw
                budget het meeste oplevert.
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-20 mx-auto -mt-[34px] max-w-[1600px] px-6 lg:-mt-[38px] lg:px-8">
          <HomeSearch
            countryCounts={countryCounts}
            departureAirports={departureAirports}
            totalOffersLabel={totalOffersLabel}
          />
        </div>
      </section>
    </>
  );
}
