'use client';

import Image from 'next/image';
import { useState } from 'react';
import { DISCOVER_IMAGE_FALLBACK_SRC } from '@/lib/discover/types';

type DiscoverCardImageProps = {
  src: string;
  alt?: string;
  sizes?: string;
  className?: string;
};

/**
 * Client Image wrapper: on load failure, swap to a known local mood asset.
 * Fallback is mood-only — never claims place-truth for the destination.
 */
export function DiscoverCardImage({
  src,
  alt = '',
  sizes = '(max-width: 640px) 80vw, 25vw',
  className = 'object-cover transition duration-700 group-hover:scale-[1.03]',
}: DiscoverCardImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      onError={() => {
        if (currentSrc !== DISCOVER_IMAGE_FALLBACK_SRC) {
          setCurrentSrc(DISCOVER_IMAGE_FALLBACK_SRC);
        }
      }}
    />
  );
}
