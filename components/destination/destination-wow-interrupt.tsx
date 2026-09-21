import Image from 'next/image';
import type { ExperienceMediaSlot } from '@/lib/discover/destination-experience-types';

type DestinationWowInterruptProps = {
  media: ExperienceMediaSlot;
  caption: string;
};

/** Full-bleed WOW break — viewport-centered; page root clips x-overflow. */
export function DestinationWowInterrupt({ media, caption }: DestinationWowInterruptProps) {
  return (
    <section id="wow" className="relative mt-14 scroll-mt-20">
      <div className="relative left-1/2 h-[240px] w-screen max-w-none -translate-x-1/2 overflow-hidden sm:h-[320px] lg:h-[400px]">
        <Image
          src={media.src}
          alt={media.placeLabel || 'WOW'}
          fill
          className="object-cover"
          sizes="(max-width: 1920px) 100vw, 1920px"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent"
          aria-hidden
        />
        <div className="absolute inset-x-0 bottom-0 mx-auto w-[86.8vw] px-4 pb-6 sm:px-6 lg:px-0 lg:pb-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/80">
            Kijk eens hier
          </p>
          <p className="mt-1 max-w-xl text-[16px] font-medium text-white sm:text-[18px]">
            {caption}
          </p>
          {media.placeLabel ? (
            <p className="mt-2 text-[12px] text-white/75">{media.placeLabel}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
