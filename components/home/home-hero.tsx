import Image from 'next/image';
import { HomeFeatures } from '@/components/home/home-features';
import { HomeHeader } from '@/components/home/home-header';
import { HomeSearch } from '@/components/home/home-search';

export function HomeHero() {
  return (
    <section className="relative h-[500px] w-full overflow-hidden">
      <Image
        src="/images/hero.jpg"
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />

      <div
        className="absolute inset-0 bg-gradient-to-r from-[#0A2D62]/75 via-[#0A2D62]/45 to-[#0A2D62]/15"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex h-full max-w-[1200px] flex-col px-4 pb-8 pt-4 sm:px-5 lg:px-6">
        <HomeHeader />

        <div className="flex flex-1 flex-col justify-center">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
              <span aria-hidden="true">✦</span>
              Jouw vakantie, jouw keuze
            </p>

            <h1 className="mt-5 max-w-2xl text-[32px] font-bold leading-tight tracking-[-0.5px] text-white sm:text-[40px] lg:text-[56px]">
              Vind jouw perfecte vakantie
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-[1.6] text-white sm:text-lg">
              Vergelijk aanbiedingen van meer dan 300 reispartners en boek met vertrouwen.
            </p>
          </div>

          <div className="mt-8">
            <HomeSearch />
          </div>

          <HomeFeatures />
        </div>
      </div>
    </section>
  );
}
