'use client';

import { RESULTS_LAST_MINUTE } from '@/components/results-v2/results-design-tokens';
import {
  isValidOfferImageUrl,
  OFFER_IMAGE_PLACEHOLDER,
} from '@/lib/offers/is-valid-offer-image-url';
import { dedupeOfferGalleryUrls } from '@/lib/offers/offer-images';
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
      className={`absolute top-1/2 z-[2] flex h-[30px] w-[30px] -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-vw-navy opacity-0 shadow-sm backdrop-blur-sm transition hover:bg-white group-hover:opacity-100 max-[900px]:hidden ${
        direction === 'left' ? 'left-2.5' : 'right-2.5'
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
  // Collapse CDN size-variants of the same shot (A1@1600 vs A1@1024) so one click
  // always lands on a visually different photo — including old catalog payloads.
  const urls = dedupeOfferGalleryUrls(images.filter(isValidOfferImageUrl));
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
      data-gallery-src={src}
    >
      <Image
        key={`${safeIndex}:${src}`}
        src={src}
        alt={alt}
        fill
        className="object-cover object-center"
        sizes={fillCardHeight ? '(max-width: 900px) 42vw, 520px' : '(max-width: 768px) 100vw, 340px'}
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
      {fillCardHeight && count > 0 ? (
        <span
          className="absolute bottom-2 right-2 z-[2] rounded-full bg-[rgba(10,20,40,0.55)] px-2 py-0.5 text-[11px] text-white min-[901px]:bottom-3 min-[901px]:right-3"
          data-testid="travel-card-photo-count"
        >
          {safeIndex + 1} / {count}
        </span>
      ) : null}
    </div>
  );
}
