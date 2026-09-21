import { PopularDestination } from '@/lib/offers/derive-destination-countries';
import { buildPopularDestinationHref } from '@/components/home/home-popular-destination-href';
import Image from 'next/image';
import Link from 'next/link';

type HomePopularDestinationsProps = {
  destinations: PopularDestination[];
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

const DESTINATION_BLURBS: Record<string, string> = {
  Griekenland: 'Zon, zee en eindeloze charme',
  Spanje: 'Van eilanden tot cultuursteden',
  Turkije: 'Oosterse gastvrijheid',
  'Italië': 'Dolce vita, altijd dichtbij',
  Portugal: 'Trams, heuvels en azulejos',
};

function prepareDestinationsForDisplay(destinations: PopularDestination[]): PopularDestination[] {
  const available = new Map(destinations.map((destination) => [destination.name, destination]));
  return TOP_DESTINATIONS.map((name) => available.get(name) ?? { name, count: 0 });
}

export function HomePopularDestinations({ destinations }: HomePopularDestinationsProps) {
  const displayDestinations = prepareDestinationsForDisplay(destinations);

  return (
    <section id="popular-destinations" className="bg-[#FBF6F0]">
      <div className="mx-auto w-[86.8vw] px-4 py-2 sm:px-6 lg:px-0 lg:py-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2
              className="text-[1.4rem] font-semibold tracking-tight text-[#0A2D62] lg:text-[27px]"
              style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
            >
              Populaire bestemmingen
            </h2>
            <p className="mt-0.5 text-[12px] text-[#64748B]">Tijdloze favorieten, altijd een goed idee.</p>
          </div>
          <Link
            href="/bestemmingen"
            className="hidden text-[12.5px] font-semibold text-[#3B82C4] sm:inline-flex"
          >
            Bekijk alle bestemmingen →
          </Link>
        </div>

        <ul className="mt-4 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible lg:flex lg:flex-nowrap lg:justify-between lg:gap-3.5 lg:overflow-visible [&::-webkit-scrollbar]:hidden">
          {displayDestinations.map((destination, index) => {
            const imageSrc =
              DESTINATION_IMAGES[destination.name] ?? '/images/verified/popular/greece.jpg';
            return (
              <li key={destination.name} className="flex w-[70%] shrink-0 sm:w-auto lg:min-w-0 lg:flex-1">
                <Link
                  href={buildPopularDestinationHref(destination.name)}
                  className="group flex h-full w-full flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_6px_18px_rgba(10,45,98,0.07)] ring-1 ring-[#E8E4DC]/80"
                >
                  <div className="relative h-[150px] shrink-0 overflow-hidden sm:h-[170px] lg:h-[200px]">
                    <Image
                      src={imageSrc}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 70vw, 20vw"
                      className="object-cover object-center transition duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="flex h-[58px] shrink-0 items-center justify-between gap-2 px-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-[14px] font-semibold leading-tight text-[#0A2D62]">
                        {destination.name}
                      </h3>
                      <p className="mt-0.5 truncate text-[12px] leading-tight text-[#64748B]">
                        {DESTINATION_BLURBS[destination.name] ?? 'Ontdek & vergelijk'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] text-[#0A2D62] shadow-sm ${
                        index === 0 ? 'bg-[#E8C547]' : 'bg-[#F3F0EA]'
                      }`}
                      aria-hidden
                    >
                      →
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
