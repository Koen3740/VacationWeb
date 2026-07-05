import Image from 'next/image';
import { HomeHeader } from '@/components/home/home-header';
import { HomeSearch } from '@/components/home/home-search';
import { StarBadgeIcon } from '@/components/home/home-search-icons';

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
        className="absolute inset-0 bg-gradient-to-r from-[#0A2D62]/82 via-[#0A2D62]/48 to-transparent"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-[#0A2D62]/25 via-transparent to-[#0A2D62]/10"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-[680px] max-w-[1200px] flex-col px-4 pb-10 pt-5 sm:px-5 lg:min-h-[720px] lg:px-6 lg:pb-12">
        <HomeHeader />

        <div className="flex flex-1 flex-col justify-center pt-8 lg:pt-10">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-black/35 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-[2px]">
              <StarBadgeIcon />
              Jouw vakantie, jouw keuze
            </p>

            <h1 className="mt-6 max-w-2xl text-[32px] font-bold leading-[1.08] tracking-[-0.5px] text-white sm:text-[44px] lg:text-[56px]">
              Vind jouw perfecte vakantie
            </h1>

            <p className="mt-4 max-w-2xl text-base font-normal leading-[1.6] text-white sm:text-lg">
              Vergelijk aanbiedingen en boek met vertrouwen.
            </p>
          </div>

          <div className="mt-8">
            <HomeSearch />
          </div>
        </div>
      </div>
    </section>
  );
}
