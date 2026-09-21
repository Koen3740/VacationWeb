import Link from 'next/link';
import { DiscoverCardImage } from '@/components/home/discover-card-image';
import { getHomepageDiscoverDestinations } from '@/lib/discover/get-homepage-discover-destinations';
import type { DiscoverDestination } from '@/lib/discover/types';

type HomeDiscoverTeaserProps = {
  /** Prefer page.tsx loading via getter and passing in (testability). */
  destinations?: DiscoverDestination[];
};

/** WOW discovery — landscape cards with play + place labels (SSOT crops). Data-driven. */
export function HomeDiscoverTeaser({ destinations }: HomeDiscoverTeaserProps) {
  const cards =
    destinations ?? getHomepageDiscoverDestinations({ limit: 5 });
  const gridColsClass =
    cards.length === 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4';

  return (
    <section id="ontdekt" className="bg-[#FBF6F0]">
      <div className="mx-auto w-[86.8vw] px-4 py-4 sm:px-6 lg:px-0 lg:py-6 lg:pb-14">
        <div className="flex items-end justify-between gap-4">
          <div className="max-w-xl">
            <h2
              className="text-[1.65rem] font-semibold tracking-tight text-[#0A2D62] sm:text-[1.95rem]"
              style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
            >
              Vandaag ontdekt
            </h2>
            <p className="mt-1.5 text-[13.5px] text-[#64748B]">
              Nieuwe plekken. Echte verhalen. Laat je inspireren.
            </p>
          </div>
          <Link
            href="/bestemmingen"
            className="hidden shrink-0 text-[13px] font-semibold text-[#0A2D62] sm:inline-flex"
          >
            Bekijk alle ontdekkingen →
          </Link>
        </div>

        <div className="relative mt-3">
          <ul
            className={`flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:overflow-visible ${gridColsClass} [&::-webkit-scrollbar]:hidden`}
          >
            {cards.map((card) => (
              <li key={card.destinationId} className="w-[78%] shrink-0 sm:w-auto">
                <Link
                  href={card.href ?? ("/ontdekt/" + card.destinationId)}
                  className="group relative block overflow-hidden rounded-[12px] shadow-[0_8px_24px_rgba(10,45,98,0.07)] ring-1 ring-[#E8E4DC]/80"
                >
                  <div className="relative h-[220px] overflow-hidden sm:h-[240px] lg:h-[266px]">
                    <DiscoverCardImage src={card.imageSrc} alt="" />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent"
                      aria-hidden
                    />
                    <span
                      className="absolute left-1/2 top-[38%] flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[12px] text-[#0A2D62] shadow-sm"
                      aria-hidden
                    >
                      ▶
                    </span>
                    <div className="absolute inset-x-0 bottom-0 p-3 sm:p-3.5">
                      <p
                        className="text-[15px] font-semibold leading-tight text-white drop-shadow sm:text-[16px]"
                        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
                      >
                        {card.name}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-snug text-white/90 sm:text-[12.5px]">
                        {card.teaser}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
