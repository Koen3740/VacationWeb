import type { MediaAsset } from '@/content/destinations/types';
import Image from 'next/image';

export function DiscoveryPhoto({
  image,
  priority = false,
  sizes,
  className = '',
}: {
  image: MediaAsset;
  priority?: boolean;
  sizes: string;
  className?: string;
}) {
  const mobile = image.objectPositionMobile ?? image.objectPosition;
  return (
    <Image
      src={image.src}
      alt={image.alt}
      fill
      priority={priority}
      sizes={sizes}
      className={`object-cover max-[900px]:[object-position:var(--vw-obj-m)] min-[901px]:[object-position:var(--vw-obj)] ${className}`}
      style={{
        ['--vw-obj' as string]: image.objectPosition,
        ['--vw-obj-m' as string]: mobile,
      }}
    />
  );
}

export function PhotoCredit({ credit, className = '' }: { credit: string; className?: string }) {
  return (
    <span
      className={`pointer-events-none absolute z-[3] max-w-[70%] text-right text-[10px] leading-snug text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,.55)] ${className}`}
    >
      {credit}
    </span>
  );
}

export function ArrowIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function PlayGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden>
      <path d="M7 5v14l12-7z" fill="currentColor" />
    </svg>
  );
}
