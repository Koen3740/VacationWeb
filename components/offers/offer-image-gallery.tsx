'use client';

import Image from 'next/image';
import { useState } from 'react';

type OfferImageGalleryProps = {
  images: string[];
  alt: string;
};

export function OfferImageGallery({ images, alt }: OfferImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? images[0];
  const showThumbnails = images.length > 1;

  return (
    <div className="mt-8 min-w-0 max-w-full">
      <section className="relative h-[320px] w-full overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-200 shadow-sm sm:h-[420px]">
        {activeImage ? (
          <Image
            src={activeImage}
            alt={alt}
            fill
            priority
            className="object-cover"
          />
        ) : null}
      </section>

      {showThumbnails ? (
        <div className="mt-3 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1">
          {images.map((imageUrl, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                key={`${imageUrl}-${index}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Toon afbeelding ${index + 1}`}
                aria-pressed={isActive}
                className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border ${
                  isActive ? 'border-brand-600' : 'border-slate-200'
                }`}
              >
                <Image
                  src={imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
