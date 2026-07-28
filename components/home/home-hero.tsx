import Image from 'next/image';
import { HomeHeader } from '@/components/home/home-header';
import { HomeSearch } from '@/components/home/home-search';

export function HomeHero() {
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
        className="absolute inset-0 bg-gradient-to-r from-[#0A2D62]/78 via-[#0A2D62]/38 to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#0A2D62]/20 via-transparent to-[#0A2D62]/8"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-[680px] max-w-[1200px] flex-col px-4 pb-10 pt-5 sm:px-5 lg:min-h-[720px] lg:px-6 lg:pb-14">
        <HomeHeader />

        <div className="flex flex-1 flex-col justify-center pt-6 lg:pt-8">
          <div className="max-w-xl lg:max-w-2xl">
            <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[13px] font-medium tracking-wide text-white/95 backdrop-blur-sm">
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
            </p>          </div>

          <div className="mt-11 lg:mt-14">
            <HomeSearch />
          </div>
        </div>
      </div>
    </section>
  );
}
