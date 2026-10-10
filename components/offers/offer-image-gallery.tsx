'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

type OfferImageGalleryProps = {
  images: string[];
  alt: string;
};

/** Wraps around the ends so the last photo moves to the first and back. */
export function stepGalleryIndex(current: number, delta: number, count: number): number {
  if (count <= 1) {
    return 0;
  }
  return (current + delta + count * 4) % count;
}

export function galleryKeyDelta(key: string): -1 | 1 | null {
  if (key === 'ArrowLeft') {
    return -1;
  }
  if (key === 'ArrowRight') {
    return 1;
  }
  return null;
}

function GalleryPhoto({
  src,
  alt,
  priority,
  sizes,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className="object-cover"
    />
  );
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M11 4 L6 9 L11 14' : 'M7 4 L12 9 L7 14'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isTypingOrDialogTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'));
}

/**
 * Desktop: one wide cover photo, previous/next, a n / total counter, and a thumbnail strip.
 * Mobile: one full-width 4:3 photo, swipeable with scroll-snap, counter and dots.
 * Photos use object-fit cover and are never stretched.
 */
export function OfferImageGallery({ images, alt }: OfferImageGalleryProps) {
  const [active, setActive] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const allButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const count = images.length;
  const safeActive = count === 0 ? 0 : Math.min(active, count - 1);

  useEffect(() => {
    if (!showAll) {
      return undefined;
    }
    closeButtonRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowAll(false);
        allButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showAll]);

  useEffect(() => {
    if (count < 2) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      const delta = galleryKeyDelta(event.key);
      if (delta == null || showAll || isTypingOrDialogTarget(event.target)) {
        return;
      }
      const desktop = desktopRef.current;
      if (!desktop || window.getComputedStyle(desktop).display === 'none') {
        return;
      }
      event.preventDefault();
      setActive((current) => stepGalleryIndex(current, delta, count));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, showAll]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) {
      return;
    }
    const thumb = strip.querySelector<HTMLElement>(`[data-gallery-thumb="${safeActive}"]`);
    if (!thumb) {
      return;
    }
    const stripRect = strip.getBoundingClientRect();
    const thumbRect = thumb.getBoundingClientRect();
    const left = thumbRect.left - stripRect.left + strip.scrollLeft;
    const target = left - (strip.clientWidth - thumbRect.width) / 2;
    strip.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [safeActive]);

  if (count === 0) {
    return null;
  }

  const activeSrc = images[safeActive] ?? images[0];
  const counterLabel = `${safeActive + 1} / ${count}`;
  const closeAll = () => {
    setShowAll(false);
    allButtonRef.current?.focus();
  };

  return (
    <div className="mt-6 min-w-0 max-w-full" data-testid="offer-gallery">
      <div
        className="vw-detail-snap -mx-4 flex w-auto min-w-0 max-w-none gap-0 overflow-x-auto min-[901px]:hidden"
        aria-label="Foto's"
        data-testid="offer-gallery-track"
      >
        {images.map((src, index) => (
          <figure
            key={`${src}-${index}`}
            className="relative aspect-[4/3] w-full min-w-full shrink-0 basis-full snap-start snap-always overflow-hidden bg-[#ddd]"
            aria-label={`Foto ${index + 1} van ${count}`}
          >
            <GalleryPhoto
              src={src}
              alt={index === 0 ? alt : ''}
              priority={index === 0}
              sizes="100vw"
            />
            {count > 1 ? (
              <span
                className="absolute right-3 top-3 rounded-full bg-[rgba(10,20,40,0.55)] px-2.5 py-1 text-[12.5px] font-semibold text-white"
                data-testid="offer-gallery-counter"
              >
                {index + 1} / {count}
              </span>
            ) : null}
            {count > 1 ? (
              <span
                className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5"
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
          </figure>
        ))}
      </div>

      <div
        ref={desktopRef}
        className="hidden min-w-0 min-[901px]:block"
        data-testid="offer-gallery-desktop"
        role="region"
        aria-label="Fotogalerij"
      >
        <div className="relative aspect-[16/9] max-h-[520px] w-full overflow-hidden rounded-[22px] bg-[#ddd]">
          <GalleryPhoto
            src={activeSrc}
            alt={`${alt}, foto ${safeActive + 1} van ${count}`}
            priority
            sizes="(min-width: 901px) 840px, 100vw"
          />
          {count > 1 ? (
            <>
              <button
                type="button"
                className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-vw-navy shadow-vw-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label="Vorige foto"
                data-testid="offer-gallery-prev"
                onClick={() => setActive((current) => stepGalleryIndex(current, -1, count))}
              >
                <Chevron direction="left" />
              </button>
              <button
                type="button"
                className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 text-vw-navy shadow-vw-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                aria-label="Volgende foto"
                data-testid="offer-gallery-next"
                onClick={() => setActive((current) => stepGalleryIndex(current, 1, count))}
              >
                <Chevron direction="right" />
              </button>
              <span
                className="absolute bottom-3 right-3 z-10 rounded-full bg-[rgba(10,20,40,0.55)] px-2.5 py-1 text-[12.5px] font-semibold text-white"
                data-testid="offer-gallery-desktop-counter"
                aria-live="polite"
              >
                {counterLabel}
              </span>
              <button
                ref={allButtonRef}
                type="button"
                className="absolute bottom-3 left-3 z-10 rounded-full bg-white/95 px-3.5 py-1.5 text-[13px] font-semibold text-vw-navy shadow-vw-panel focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vw-navy"
                aria-expanded={showAll}
                aria-haspopup="dialog"
                onClick={() => setShowAll(true)}
              >
                Alle {count} foto&apos;s
              </button>
            </>
          ) : null}
        </div>

        {count > 1 ? (
          <div
            ref={stripRef}
            className="mt-2.5 flex gap-2 overflow-x-auto py-1"
            aria-label="Miniaturen"
            data-testid="offer-gallery-thumbs"
          >
            {images.map((src, index) => {
              const selected = index === safeActive;
              return (
                <button
                  key={`thumb-${src}-${index}`}
                  type="button"
                  data-gallery-thumb={index}
                  aria-label={`Foto ${index + 1} van ${count}`}
                  aria-current={selected ? 'true' : undefined}
                  className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 bg-[#ddd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vw-navy ${
                    selected ? 'border-vw-navy' : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                  onClick={() => setActive(index)}
                >
                  <GalleryPhoto src={src} alt="" sizes="96px" />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {showAll ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(10,20,40,0.72)] p-4 min-[901px]:p-10"
          role="dialog"
          aria-modal="true"
          aria-label={`Alle ${count} foto's`}
        >
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 flex justify-end">
              <button
                ref={closeButtonRef}
                type="button"
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-vw-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vw-navy"
                onClick={closeAll}
              >
                Sluiten
              </button>
            </div>
            <div className="grid gap-2">
              {images.map((src, index) => (
                <div key={`all-${src}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded-vw-card bg-[#ddd]">
                  <GalleryPhoto
                    src={src}
                    alt={index === 0 ? alt : `Foto ${index + 1}`}
                    sizes="(min-width: 901px) 768px, 100vw"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
