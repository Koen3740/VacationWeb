import { PopularDestination } from '@/lib/offers/derive-destination-countries';
import { buildPopularDestinationHref } from '@/components/home/home-popular-destination-href';
import Image from 'next/image';
import Link from 'next/link';
import { CHROME_COPY, type ChromeCopy } from '@/lib/i18n/chrome-copy';

type HomePopularDestinationsProps = {
  destinations: PopularDestination[];
  /** t66u: section chrome + display names/blurbs (default Dutch). Links keep catalog keys. */
  copy?: ChromeCopy['popular'];
};

/** WOW: ONE row of FIVE - Griekenland, Spanje, Turkije, Italië, Portugal. */
const TOP_DESTINATIONS = ['Griekenland', 'Spanje', 'Turkije', 'Italië', 'Portugal'] as const;

/**
 * P7: active Popular Destinations images live under /images/verified/popular/.
 * OLD blurry wow-ssot/popular-*.jpg (640x352 ~26-37KB) are only in:
 *   public/images/wow-ssot/_retired_p6_popular_20260918-1714/
 * High-res duplicates moved out of wow-ssot active namespace to:
 *   public/images/wow-ssot/_not_active_popular_dup_p7/
 * Code must NEVER fall back to /images/wow-ssot/popular-*.
 */
const DESTINATION_IMAGES: Record<string, string> = {
  Griekenland: '/images/verified/popular/greece.jpg',
  Spanje: '/images/verified/popular/spain.jpg',
  Turkije: '/images/verified/popular/turkey.jpg',
  'Italië': '/images/verified/popular/italy.jpg',
  Portugal: '/images/verified/popular/portugal.jpg',
};

function prepareDestinationsForDisplay(destinations: PopularDestination[]): PopularDestination[] {
  const available = new Map(destinations.map((destination) => [destination.name, destination]));
  return TOP_DESTINATIONS.map((name) => available.get(name) ?? { name, count: 0 });
}

export function HomePopularDestinations({
  destinations,
  copy = CHROME_COPY.nl.popular,
}: HomePopularDestinationsProps) {
  const displayDestinations = prepareDestinationsForDisplay(destinations);

  return (
    <section id="popular-destinations" className="px-[18px] pb-[clamp(48px,7vw,90px)] sm:px-[clamp(20px,4vw,56px)]">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-7 flex flex-col items-start gap-3 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="vw-home-h2">{copy.title}</h2>
            <p className="mt-2 text-[15px] text-white/80">{copy.subtitle}</p>
          </div>
          <Link href="/bestemmingen" className="border-b border-current pb-0.5 text-[14.5px] font-medium text-white">
            {copy.viewAll}
          </Link>
        </div>

        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {displayDestinations.map((destination) => {
            const imageSrc = DESTINATION_IMAGES[destination.name] ?? '/images/verified/popular/greece.jpg';
            const name = copy.countryNames[destination.name] ?? destination.name;
            return (
              <li key={destination.name}>
                <Link
                  href={buildPopularDestinationHref(destination.name)}
                  className="vw-home-tile group relative block aspect-[3/4] overflow-hidden rounded-[16px] shadow-[0_24px_50px_-28px_rgba(0,0,0,0.6)]"
                >
                  <Image
                    src={imageSrc}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 46vw, 18vw"
                    className="vw-home-tile-img object-cover group-hover:scale-105 motion-reduce:transform-none"
                  />
                  <span className="absolute inset-x-2 bottom-2 rounded-[12px] border border-white/35 bg-white/15 px-3 py-2 backdrop-blur-[14px]">
                    <span className="block truncate font-vw-serif text-[17px] font-medium leading-tight">{name}</span>
                    <span className="mt-0.5 hidden truncate text-[12px] text-white/80 sm:block">
                      {copy.blurbs[destination.name] ?? copy.fallbackBlurb}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
