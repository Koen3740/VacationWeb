import Image from 'next/image';
import Link from 'next/link';
import {
  RESULTS_BORDER,
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
      className="group relative aspect-[4/5] overflow-hidden rounded-[16px] border bg-white transition duration-300 hover:shadow-md"
      style={{
        borderColor: RESULTS_BORDER,
        boxShadow: RESULTS_CARD_SHADOW,
      }}
    >
      <Image
        src={imageSrc}
        alt={title}
        fill
        sizes="20vw"
        className="object-cover saturate-[0.9] contrast-[0.97] transition duration-500 group-hover:scale-[1.03]"
        unoptimized={imageSrc.startsWith('https://')}
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent"
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-10 sm:px-5 sm:pb-5">
        <h3 className="text-[17px] font-bold tracking-tight text-white drop-shadow-sm sm:text-[18px]">
          {title}
        </h3>
      </div>
    </Link>
  );
}
