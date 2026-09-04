import Image from 'next/image';
import Link from 'next/link';
import {
  RESULTS_BORDER,
  RESULTS_CARD_BG,
  RESULTS_CARD_SHADOW,
} from '@/components/results-v2/results-design-tokens';

type HomePhotoCardLinkProps = {
  href: string;
  imageSrc: string;
  title: string;
};

/**
 * Destination/theme tile in the Results travel-card family:
 * same radius/border/shadow/surface; image = object-cover only (no invented filters);
 * title on card surface in navy (not marketing overlay text on photo).
 */
export function HomePhotoCardLink({ href, imageSrc, title }: HomePhotoCardLinkProps) {
  return (
    <Link
      href={href}
      className="group overflow-hidden rounded-[16px] border transition hover:opacity-[0.98]"
      style={{
        backgroundColor: RESULTS_CARD_BG,
        borderColor: RESULTS_BORDER,
        boxShadow: RESULTS_CARD_SHADOW,
      }}
    >
      <div className="relative aspect-[16/11] w-full overflow-hidden">
        <Image
          src={imageSrc}
          alt={title}
          fill
          sizes="(max-width: 768px) 50vw, 20vw"
          className="object-cover object-center transition duration-500 group-hover:scale-[1.02]"
          unoptimized={
            imageSrc.startsWith('https://') || imageSrc.toLowerCase().endsWith('.jfif')
          }
        />
      </div>
      <div className="px-3.5 py-3 sm:px-4 sm:py-3.5">
        <h3 className="text-[15px] font-bold leading-snug tracking-tight text-[#0A2D62] sm:text-[16px]">
          {title}
        </h3>
      </div>
    </Link>
  );
}
