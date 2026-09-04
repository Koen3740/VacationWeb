import Image from 'next/image';
import { HomeHeader } from '@/components/home/home-header';
import { HomeSearch } from '@/components/home/home-search';
import { StarBadgeIcon } from '@/components/home/home-search-icons';

type HomeHeroProps = {
  countryCounts: Record<string, number>;
  departureAirports: string[];
  totalOffersLabel: string;
};

export function HomeHero({ countryCounts, departureAirports, totalOffersLabel }: HomeHeroProps) {
  return (
    <>
      <div className="border-b border-[#E8ECF2] bg-white">
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8">
          <HomeHeader />
        </div>
      </div>

      <section className="relative min-h-[560px] w-full overflow-hidden lg:min-h-[600px]">
        <Image
          src="/images/homepage-hero-background.png"
          alt=""
          fill
          priority
          className="object-cover object-[48%_42%] saturate-[0.92] contrast-[0.98]"
          sizes="100vw"
        />
        {/* Same overlay language as Results hero: soft black veil, not a heavy navy wash */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/28 to-black/12" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-transparent to-black/18" aria-hidden="true" />

        <div className="relative flex min-h-[560px] flex-col pb-10 pt-8 lg:min-h-[600px] lg:pb-12 lg:pt-10">
          <div className="flex flex-1 flex-col justify-center">
            <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8">
              <div className="max-w-xl lg:max-w-2xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[13px] font-medium tracking-wide text-white/95 backdrop-blur-sm">
                  <StarBadgeIcon />
                  Eén zoekopdracht
                </p>

                <h1 className="mt-6 max-w-xl text-[2rem] font-bold leading-[1.12] tracking-tight text-white drop-shadow-sm sm:text-[2.5rem] lg:mt-7 lg:text-[2.75rem]">
                  Meer vakantie
                  <br />
                  voor jouw budget
                </h1>

                <p className="mt-4 max-w-xl text-[16px] font-normal leading-relaxed text-white/95 sm:text-[18px]">
                  Vergelijk vakanties van meerdere reispartners in één zoekopdracht. Ontdek waar jouw
                  budget het meeste oplevert.
                </p>
              </div>
            </div>

            <div className="mx-auto mt-10 w-full max-w-[1200px] px-6 lg:mt-12 lg:px-8">
              <HomeSearch
                countryCounts={countryCounts}
                departureAirports={departureAirports}
                totalOffersLabel={totalOffersLabel}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
