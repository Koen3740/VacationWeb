import Image from 'next/image';
import Link from 'next/link';
import { HomeSearch } from '@/components/home/home-search';
import { loadFilterOptions } from '@/lib/offers/load-filter-options';

export function HomeHero() {
  const { countries } = loadFilterOptions();

  return (
    <section className="relative min-h-[75vh] w-full overflow-hidden">
      <Image
        src="/images/hero.jpg"
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="100vw"
      />

      <div
        className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-[75vh] max-w-7xl flex-col justify-between px-6 pb-10 pt-16 sm:px-8 sm:pb-12 sm:pt-20 lg:px-12">
        <div className="max-w-2xl pt-6 lg:pt-12">
          <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-medium tracking-wide text-white/90 backdrop-blur-sm">
            VacationWeb
          </p>

          <h1 className="mt-8 max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Jouw volgende reis begint hier.
          </h1>

          <p className="mt-6 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
            Rustig vergelijken. Eén overzicht. Geen ruis.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="#home-search"
              className="inline-flex rounded-full bg-white px-7 py-3.5 text-sm font-medium text-stone-900 transition hover:bg-white/90"
            >
              Start met zoeken
            </a>
            <Link
              href="/search"
              className="inline-flex rounded-full border border-white/30 px-7 py-3.5 text-sm font-medium text-white transition hover:border-white/50 hover:bg-white/10"
            >
              Uitgebreid zoeken
            </Link>
          </div>
        </div>

        <div id="home-search" className="mt-16 lg:mt-0">
          <HomeSearch countries={countries} />
        </div>
      </div>
    </section>
  );
}
