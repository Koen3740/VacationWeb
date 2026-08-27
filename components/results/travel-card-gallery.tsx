'use client';

import { RESULTS_LAST_MINUTE } from '@/components/results-v2/results-design-tokens';
import {
  isValidOfferImageUrl,
  OFFER_IMAGE_PLACEHOLDER,
} from '@/lib/offers/is-valid-offer-image-url';
import Image from 'next/image';
import React, { useState } from 'react';

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
      className={`absolute top-1/2 z-[2] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#0A2D62] shadow-sm backdrop-blur-sm transition hover:bg-white ${
        direction === 'left' ? 'left-2' : 'right-2'
      }`}
      aria-label={direction === 'left' ? 'Vorige foto' : 'Volgende foto'}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
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
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const usable = urls.filter((url) => !failed.has(url));
  const count = usable.length;
  const safeIndex = count > 0 ? ((index % count) + count) % count : 0;
  const src = usable[safeIndex] || OFFER_IMAGE_PLACEHOLDER;
  const showPrev = showControls && count > 1 && safeIndex > 0;
  const showNext = showControls && count > 1 && safeIndex < count - 1;

  return (
    <div className="relative aspect-[16/11] w-full md:aspect-[3/2]">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover object-center"
        sizes="(max-width: 768px) 100vw, 340px"
        onError={() => {
          if (src === OFFER_IMAGE_PLACEHOLDER) {
            return;
          }
          setFailed((prev) => {
            const next = new Set(prev);
            next.add(src);
            return next;
          });
        }}
      />

      {isLastMinute ? (
        <span
          className="absolute left-3 top-3 z-[2] rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: RESULTS_LAST_MINUTE }}
        >
          LAST MINUTE
        </span>
      ) : null}

      {showPrev ? (
        <ArrowButton direction="left" onClick={() => setIndex((prev) => Math.max(0, prev - 1))} />
      ) : null}
      {showNext ? (
        <ArrowButton
          direction="right"
          onClick={() => setIndex((prev) => Math.min(count - 1, prev + 1))}
        />
      ) : null}
    </div>
  );
}
