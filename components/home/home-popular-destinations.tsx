import { DestinationCountryFlagIcon } from '@/components/search/destination-popup/destination-country-flag-icon';
import { PopularDestination } from '@/lib/offers/derive-destination-countries';
import Link from 'next/link';

type HomePopularDestinationsProps = {
  destinations: PopularDestination[];
};

export function HomePopularDestinations({ destinations }: HomePopularDestinationsProps) {
  return (
    <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-5 lg:px-6">
      <div className="max-w-2xl">
        <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[#0A2D62] sm:text-[32px]">
          Populaire bestemmingen
        </h2>
        <p className="mt-3 text-[17px] leading-relaxed text-slate-600">
          Ontdek waar reizigers het meest naar zoeken en vergelijk direct beschikbare vakanties.
        </p>
      </div>

      {destinations.length > 0 ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {destinations.map((destination) => (
            <Link
              key={destination.name}
              href={`/results?country=${encodeURIComponent(destination.name)}`}
              className="group rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <DestinationCountryFlagIcon country={destination.name} />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-slate-950 group-hover:text-brand-700">
                    {destination.name}
                  </h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}
