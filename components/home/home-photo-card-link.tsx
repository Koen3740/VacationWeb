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

export function HomePhotoCardLink({ href, imageSrc, title }: HomePhotoCardLinkProps) {
  return (
    <Link
      href={href}
      className="group relative aspect-[4/5] overflow-hidden rounded-[16px] border transition duration-300 hover:shadow-md"
      style={{
        backgroundColor: RESULTS_CARD_BG,
        borderColor: RESULTS_BORDER,
        boxShadow: RESULTS_CARD_SHADOW,
      }}
    >
      <Image
        src={imageSrc}
        alt={title}
        fill
        sizes="20vw"
        className="object-cover saturate-[0.85] contrast-[0.96] brightness-[0.99] transition duration-500 group-hover:scale-[1.02]"
        unoptimized={imageSrc.startsWith('https://')}
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/48 via-black/8 to-transparent"
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-10 sm:px-5 sm:pb-5">
        <h3 className="text-[16px] font-bold tracking-tight text-white drop-shadow-sm sm:text-[17px]">
          {title}
        </h3>
      </div>
    </Link>
  );
}
