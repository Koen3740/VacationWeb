import Image from 'next/image';
import Link from 'next/link';

type HomePhotoCardLinkProps = {
  href: string;
  imageSrc: string;
  title: string;
};

export function HomePhotoCardLink({ href, imageSrc, title }: HomePhotoCardLinkProps) {
  return (
    <Link
      href={href}
      className="group relative aspect-[4/5] overflow-hidden rounded-2xl shadow-sm ring-1 ring-slate-200/80 transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-brand-200"
    >
      <Image
        src={imageSrc}
        alt={title}
        fill
        sizes="20vw"
        className="object-cover transition duration-500 group-hover:scale-[1.04]"
        unoptimized={imageSrc.startsWith('https://')}
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent transition duration-300 group-hover:from-black/55"
        aria-hidden="true"
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-4 pb-4 pt-10 sm:px-5 sm:pb-5 sm:pt-12">
        <h3
          className="text-lg font-bold tracking-[-0.01em] text-white sm:text-xl"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.65)' }}
        >
          {title}
        </h3>
      </div>
    </Link>
  );
}
