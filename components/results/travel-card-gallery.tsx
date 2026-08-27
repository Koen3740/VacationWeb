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
  /** Stretch to parent height on desktop (card row stretch). */
  fillCardHeight?: boolean;
};

/** Pure index step — one click must advance exactly one photo. */
export function nextGalleryIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, index) + 1);
}

export function previousGalleryIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, index) - 1);
}

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
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          onClick();
        }
      }}
      className={`absolute top-1/2 z-[2] flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-[#0A2D62] shadow-sm backdrop-blur-sm transition hover:bg-white ${
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
  fillCardHeight = false,
}: TravelCardGalleryProps) {
  const urls = images.filter(isValidOfferImageUrl);
  const displayCount = previewPhotoCount && previewPhotoCount > 1 ? previewPhotoCount : urls.length;
  const showControls = displayCount > 1;
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const usable = urls.filter((url) => !failed.has(url));
  const count = usable.length;
  const safeIndex = count > 0 ? Math.min(Math.max(index, 0), count - 1) : 0;
  const src = usable[safeIndex] || OFFER_IMAGE_PLACEHOLDER;
  const showPrev = showControls && count > 1 && safeIndex > 0;
  const showNext = showControls && count > 1 && safeIndex < count - 1;

  return (
    <div
      className={
        fillCardHeight
          ? 'relative h-full min-h-[220px] w-full md:absolute md:inset-0 md:min-h-0'
          : 'relative aspect-[16/11] w-full md:aspect-[3/2]'
      }
      data-testid="travel-card-gallery"
      data-gallery-count={count}
      data-gallery-index={safeIndex}
    >
      <Image
        key={src}
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
        <ArrowButton
          direction="left"
          onClick={() => setIndex((prev) => previousGalleryIndex(prev, count))}
        />
      ) : null}
      {showNext ? (
        <ArrowButton
          direction="right"
          onClick={() => setIndex((prev) => nextGalleryIndex(prev, count))}
        />
      ) : null}
    </div>
  );
}
