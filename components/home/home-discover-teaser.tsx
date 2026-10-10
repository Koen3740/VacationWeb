import Image from 'next/image';
import Link from 'next/link';
import { CHROME_COPY, type ChromeCopy } from '@/lib/i18n/chrome-copy';
import {
  HOMEPAGE_DISCOVERY_HREF,
  HOMEPAGE_OFFERS_HREF,
  homepageDestinationTiles,
} from '@/lib/home/homepage-sections';

type HomeDiscoverTeaserProps = {
  /** t66u: section chrome (default Dutch). Tile names come from Discovery data. */
  copy?: ChromeCopy['discover'];
};

/** Portrait tiles over the hero photo. Albanië opens the longread; the rest open results. */
export function HomeDiscoverTeaser({ copy = CHROME_COPY.nl.discover }: HomeDiscoverTeaserProps) {
  const tiles = homepageDestinationTiles();

  return (
    <section id="ontdekt" className="px-[18px] py-[clamp(56px,8vw,110px)] sm:px-[clamp(20px,4vw,56px)]">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-7 flex flex-col items-start gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="vw-home-kicker">{copy.kicker}</p>
            <h2 className="vw-home-h2">{copy.title}</h2>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14.5px] font-medium">
            <Link href={HOMEPAGE_DISCOVERY_HREF} className="border-b border-current pb-0.5 text-white">
              {copy.viewAll}
            </Link>
            <Link href={HOMEPAGE_OFFERS_HREF} className="border-b border-current pb-0.5 text-white">
              {copy.offers}
            </Link>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-2.5 sm:gap-[18px] lg:grid-cols-3">
          {tiles.map((tile) => (
            <li key={tile.id}>
              <Link
                href={tile.href}
                className="vw-home-tile group relative block aspect-[3/4] overflow-hidden rounded-[16px] shadow-[0_24px_50px_-28px_rgba(0,0,0,0.6)] sm:aspect-[4/5] sm:rounded-[22px]"
              >
                <Image
                  src={tile.imageSrc}
                  alt={tile.imageAlt}
                  fill
                  sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 360px"
                  className="vw-home-tile-img object-cover group-hover:scale-105 motion-reduce:transform-none"
                  style={{ objectPosition: tile.objectPosition }}
                />
                <span className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-[12px] border border-white/35 bg-white/15 px-3 py-2 backdrop-blur-[14px] sm:inset-x-3.5 sm:bottom-3.5 sm:rounded-[16px] sm:px-[18px] sm:py-3.5">
                  <span className="min-w-0">
                    <span className="block truncate font-vw-serif text-[17px] font-medium leading-tight sm:text-[22px]">
                      {tile.title}
                    </span>
                    <span className="mt-0.5 hidden truncate text-[12.5px] text-white/80 sm:block">{tile.place}</span>
                    <span className="sr-only">{tile.credit}</span>
                  </span>
                  <span
                    className="hidden h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-white/20 text-[18px] sm:grid"
                    aria-hidden
                  >
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
