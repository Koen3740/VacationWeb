'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

type OfferImageGalleryProps = {
  images: string[];
  alt: string;
};

const DESKTOP_PLACEMENTS = [
  'min-[901px]:col-start-1 min-[901px]:row-start-1 min-[901px]:row-span-2',
  'min-[901px]:col-start-2 min-[901px]:row-start-1',
  'min-[901px]:col-start-3 min-[901px]:row-start-1',
  'min-[901px]:col-start-2 min-[901px]:row-start-2',
  'min-[901px]:col-start-3 min-[901px]:row-start-2',
];

function GalleryPhoto({
  src,
  alt,
  priority,
}: {
  src: string;
  alt: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes="(min-width: 901px) 50vw, 100vw"
      className="object-cover"
    />
  );
}

/**
 * Desktop: mosaic (large photo plus up to four tiles).
 * Mobile: one full-width 4:3 photo, swipeable with scroll-snap, counter and dots.
 * Photos use object-fit cover and are never stretched.
 */
export function OfferImageGallery({ images, alt }: OfferImageGalleryProps) {
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    if (!showAll) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAll(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAll]);
  if (images.length === 0) {
    return null;
  }

  const mosaic = images.length >= 3;
  const desktopGrid = images.length === 1
    ? 'min-[901px]:grid-cols-1 min-[901px]:grid-rows-[460px]'
    : images.length === 2
      ? 'min-[901px]:grid-cols-2 min-[901px]:grid-rows-[420px]'
      : 'min-[901px]:grid-cols-[2fr_1fr_1fr] min-[901px]:grid-rows-[230px_230px]';

  return (
    <div className="mt-6 min-w-0 max-w-full" data-testid="offer-gallery">
      <div
        className={`vw-detail-snap -mx-4 flex w-auto min-w-0 max-w-none gap-0 overflow-x-auto min-[901px]:mx-0 min-[901px]:grid min-[901px]:max-w-full min-[901px]:gap-2 min-[901px]:overflow-hidden min-[901px]:rounded-[22px] ${desktopGrid}`}
        aria-label="Foto's"
        data-testid="offer-gallery-track"
      >
        {images.map((src, index) => {
          const countLabel = `${index + 1} / ${images.length}`;
          return (
            <figure
              key={`${src}-${index}`}
              className={`relative aspect-[4/3] w-full min-w-full shrink-0 basis-full snap-start snap-always overflow-hidden bg-[#ddd] min-[901px]:aspect-auto min-[901px]:h-full min-[901px]:w-auto min-[901px]:min-w-0 min-[901px]:basis-auto ${
                mosaic ? DESKTOP_PLACEMENTS[index] ?? '' : ''
              } ${index >= 5 ? 'min-[901px]:hidden' : ''}`}
              aria-label={`Foto ${index + 1} van ${images.length}`}
            >
              <GalleryPhoto src={src} alt={index === 0 ? alt : ''} priority={index === 0} />
              {images.length > 1 ? (
                <span
                  className={`absolute right-3 top-3 rounded-full bg-[rgba(10,20,40,0.55)] px-2.5 py-1 text-[12.5px] font-semibold text-white min-[901px]:top-auto min-[901px]:bottom-3 ${
                    index === 0 ? '' : 'min-[901px]:hidden'
                  }`}
                  data-testid="offer-gallery-counter"
                >
                  {countLabel}
                </span>
              ) : null}
              {images.length > 1 ? (
                <span
                  className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5 min-[901px]:hidden"
                  aria-hidden
                  data-testid="offer-gallery-dots"
                >
                  {images.map((_, dotIndex) => (
                    <i
                      key={dotIndex}
                      className={`h-[7px] rounded-full bg-white/55 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] ${
                        dotIndex === index ? 'w-[18px] bg-white' : 'w-[7px]'
                      }`}
                    />
                  ))}
                </span>
              ) : null}
              {index === 4 && images.length > 5 ? (
                <button
                  type="button"
                  className="absolute inset-0 hidden items-center justify-center bg-[rgba(10,30,60,0.42)] text-[15px] font-semibold text-white min-[901px]:flex"
                  aria-expanded={showAll}
                  onClick={() => setShowAll(true)}
                >
                  Alle {images.length} foto&apos;s
                </button>
              ) : null}
            </figure>
          );
        })}
      </div>

      {showAll ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(10,20,40,0.72)] p-4 min-[901px]:p-10"
          role="dialog"
          aria-modal="true"
          aria-label={`Alle ${images.length} foto's`}
        >
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-vw-navy"
                onClick={() => setShowAll(false)}
              >
                Sluiten
              </button>
            </div>
            <div className="grid gap-2">
              {images.map((src, index) => (
                <div key={`all-${src}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-vw-card bg-[#ddd]">
                  <GalleryPhoto src={src} alt={index === 0 ? alt : `Foto ${index + 1}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
