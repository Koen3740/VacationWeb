'use client';

import Image from 'next/image';
import { useState } from 'react';

type HomeDiscoverCardImageProps = {
  src: string;
  fallbackSrc: string;
  alt: string;
};

export function HomeDiscoverCardImage({ src, fallbackSrc, alt }: HomeDiscoverCardImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const usingFallback = currentSrc === fallbackSrc;

  return (
    <Image
      src={currentSrc}
      alt={usingFallback ? '' : alt}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 20vw"
      className="object-cover object-center transition duration-500 group-hover:scale-[1.03]"
      onError={() => {
        if (currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}
