import Link from 'next/link';
import {
  RESULTS_BORDER,
  RESULTS_CARD_SHADOW,
} from '@/components/results-v2/results-design-tokens';
import { HomeDiscoverCardImage } from '@/components/home/home-discover-card-image';
import type { DiscoverDestination } from '@/lib/discover/types';

type HomeDiscoverCardProps = {
  destination: DiscoverDestination;
  imageSrc: string;
  fallbackSrc: string;
};

function PlayOverlay() {
  return (
    <span
      className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center"
      aria-hidden
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/92 shadow-lg ring-1 ring-black/10 transition duration-300 group-hover:scale-105 sm:h-14 sm:w-14">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="ml-0.5">
          <path d="M8 6.5v11l10-5.5-10-5.5z" fill="#0A2D62" />
        </svg>
      </span>
    </span>
  );
}

export function HomeDiscoverCard({ destination, imageSrc, fallbackSrc }: HomeDiscoverCardProps) {
  const className =
    'group relative block overflow-hidden rounded-[16px] border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#89ACD3] focus-visible:ring-offset-2';

  const content = (
    <div className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-[16/9]">
      <HomeDiscoverCardImage src={imageSrc} fallbackSrc={fallbackSrc} alt={destination.name} />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/5"
        aria-hidden
      />
      <PlayOverlay />
      <div className="absolute inset-x-0 bottom-0 z-[3] px-4 py-3 sm:px-5 sm:py-4">
        <h3 className="text-[16px] font-bold leading-snug tracking-tight text-white drop-shadow-sm sm:text-[18px]">
          {destination.name}
        </h3>
        <p className="mt-0.5 text-[13px] leading-snug text-white/90 sm:text-[14px]">
          {destination.teaser}
        </p>
      </div>
    </div>
  );

  if (destination.href) {
    return (
      <Link
        href={destination.href}
        className={className}
        style={{ borderColor: RESULTS_BORDER, boxShadow: RESULTS_CARD_SHADOW }}
      >
        {content}
      </Link>
    );
  }

  return (
    <article
      className={className}
      style={{ borderColor: RESULTS_BORDER, boxShadow: RESULTS_CARD_SHADOW }}
    >
      {content}
    </article>
  );
}
