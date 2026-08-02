import Image from 'next/image';
import { HomeHeader } from '@/components/home/home-header';
import { HomeSearch } from '@/components/home/home-search';
import { StarBadgeIcon } from '@/components/home/home-search-icons';

type HomeHeroProps = {
  countryCounts: Record<string, number>;
  totalOffersLabel: string;
};

export function HomeHero({ countryCounts, totalOffersLabel }: HomeHeroProps) {
  return (
    <section className="relative min-h-[680px] w-full overflow-hidden lg:min-h-[720px]">
      <Image
        src="/images/homepage-hero-background.png"
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />

      <div
        className="absolute inset-0 bg-gradient-to-r from-[#0A2D62]/70 from-0% via-[#0A2D62]/28 via-32% to-transparent to-52%"
        aria-hidden="true"
      />

      <div className="relative flex min-h-[680px] flex-col pb-10 pt-5 lg:min-h-[720px] lg:pb-14">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-5 lg:px-6">
          <HomeHeader />
        </div>

        <div className="flex flex-1 flex-col justify-center pt-6 lg:pt-8">
          <div className="px-4 sm:px-5 lg:px-8">
            <div className="max-w-xl lg:max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[13px] font-medium tracking-wide text-white/95 backdrop-blur-sm">
                <StarBadgeIcon />
                Eén zoekopdracht
              </p>

              <h1 className="mt-7 max-w-xl text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-[46px] lg:mt-8 lg:text-[52px]">
                Meer vakantie
                <br />
                voor jouw budget
              </h1>

              <p className="mt-6 max-w-lg text-[17px] font-normal leading-[1.65] text-white/90 sm:text-lg">
                Vergelijk vakanties van meerdere reispartners in één zoekopdracht. Ontdek waar jouw
                budget het meeste oplevert.
              </p>
            </div>
          </div>

          <div className="mx-auto mt-11 w-full max-w-[1200px] px-4 sm:px-5 lg:mt-14 lg:px-6">
            <HomeSearch countryCounts={countryCounts} totalOffersLabel={totalOffersLabel} />
          </div>
        </div>
      </div>
    </section>
  );
}
