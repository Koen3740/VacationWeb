'use client';

import { RESULTS_LAST_MINUTE } from '@/components/results-v2/results-design-tokens';
import {
  isValidOfferImageUrl,
  OFFER_IMAGE_PLACEHOLDER,
} from '@/lib/offers/is-valid-offer-image-url';
import Image from 'next/image';
import { useState } from 'react';

type TravelCardGalleryProps = {
  images: string[];
  alt: string;
  isLastMinute?: boolean;
  /** Preview-only: force multi-photo UI even with one real src */
  previewPhotoCount?: number;
};

function ArrowButton({
  direction,
  onClick,
}: {
  direction: 'left' | 'right';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={`absolute top-1/2 z-[2] flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#0A2D62] shadow-md backdrop-blur-sm transition hover:bg-white ${
        direction === 'left' ? 'left-2.5' : 'right-2.5'
      }`}
      aria-label={direction === 'left' ? 'Vorige foto' : 'Volgende foto'}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d={direction === 'left' ? 'M10 3.5 5.5 8 10 12.5' : 'M6 3.5 10.5 8 6 12.5'}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

export function TravelCardGallery({
  images,
  alt,
  isLastMinute,
  previewPhotoCount,
}: TravelCardGalleryProps) {
  const urls = images.filter(isValidOfferImageUrl);
  const displayCount = previewPhotoCount && previewPhotoCount > 1 ? previewPhotoCount : urls.length;
  const showControls = displayCount > 1;
  const [index, setIndex] = useState(0);
  const safeIndex = urls.length > 0 ? index % urls.length : 0;
  const src = urls[safeIndex] || OFFER_IMAGE_PLACEHOLDER;

  return (
    <div className="relative aspect-[16/11] h-full min-h-[170px] w-full md:aspect-auto md:min-h-[190px]">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover object-center"
        sizes="(max-width: 768px) 100vw, 340px"
      />

      {isLastMinute ? (
        <span
          className="absolute left-3 top-3 z-[2] rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: RESULTS_LAST_MINUTE }}
        >
          LAST MINUTE
        </span>
      ) : null}

      {showControls ? (
        <>
          <ArrowButton
            direction="left"
            onClick={() => setIndex((prev) => (prev - 1 + displayCount) % displayCount)}
          />
          <ArrowButton
            direction="right"
            onClick={() => setIndex((prev) => (prev + 1) % displayCount)}
          />
          <span className="absolute bottom-2.5 right-2.5 z-[2] rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {(index % displayCount) + 1} / {displayCount}
          </span>
        </>
      ) : null}
    </div>
  );
}
