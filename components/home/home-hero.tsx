import Image from 'next/image';
import { HomeHeader } from '@/components/home/home-header';
import { HomeSearch } from '@/components/home/home-search';

const SCRIPT_STACK =
  "Segoe Script, 'Apple Chancery', 'Snell Roundhand', cursive";

type HomeHeroProps = {
  countryCounts: Record<string, number>;
  departureAirports: string[];
  totalOffersLabel: string;
};

/**
 * Homepage hero — Mode A (DEC-007 / Actieplan v1.2):
 * mood image + commercial belofte + floating search.
 * No Wait—where? badge, no misdirect/reveal copy, no Discover CTAs in hero.
 */
export function HomeHero({ countryCounts, departureAirports, totalOffersLabel }: HomeHeroProps) {
  return (
    <>
      <HomeHeader />
      <section id="hero" className="relative bg-[#FBF6F0]">
        <div className="relative h-[320px] w-full overflow-hidden sm:h-[380px] lg:h-[440px]">
          <Image
            src="/images/verified/mood/homepage-hero.jpg"
            alt=""
            fill
            priority
            className="object-cover object-center"
            sizes="100vw"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-black/35 via-black/15 to-transparent"
            aria-hidden
          />

          <div className="relative z-10 mx-auto flex h-full w-[86.8vw] flex-col justify-start px-4 pb-12 pt-8 sm:px-6 sm:pb-14 lg:justify-center lg:px-0 lg:pb-32 lg:pt-8">
            <div className="max-w-[34rem]">
              <h1
                className="text-[1.7rem] font-semibold leading-[1.15] tracking-[-0.015em] text-white drop-shadow-sm sm:text-[2.05rem] lg:text-[2.35rem]"
                style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
              >
                Meer vakantie voor jouw budget.
              </h1>
              <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/95 sm:text-[16px] lg:text-[17px]">
                Vergelijk vakanties van meerdere reisaanbieders in een zoekopdracht.
              </p>
            </div>
            <p
              className="pointer-events-none absolute bottom-16 right-6 hidden max-w-[16rem] rotate-[-6deg] text-right text-[22px] leading-snug text-white/90 drop-shadow lg:bottom-20 lg:right-10 lg:block"
              style={{ fontFamily: SCRIPT_STACK }}
            >
              Real places.{' '}
              <span className="relative inline-block">
                Real possibilities.
                <span
                  className="absolute -bottom-1 left-0 right-0 mx-auto h-[3px] w-[92%] rounded-full bg-[#E8C547]"
                  aria-hidden
                />
              </span>
            </p>
          </div>
        </div>

        {/* Search is the primary functional CTA — Mode A */}
        <div className="relative z-20 flex w-full justify-center px-0 pb-5 sm:-mt-4 lg:-mt-[18px] lg:pb-7">
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
