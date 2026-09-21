import Image from 'next/image';

type DestinationHeroProps = {
  name: string;
  teaser: string;
  imageSrc: string;
};

/** Full-width Destination Page hero — reusable template section. */
export function DestinationHero({ name, teaser, imageSrc }: DestinationHeroProps) {
  return (
    <section className="relative h-[280px] w-full overflow-hidden sm:h-[360px] lg:h-[420px]">
      <Image
        src={imageSrc}
        alt=""
        fill
        priority
        className="object-cover object-center"
        sizes="(max-width: 1920px) 100vw, 1920px"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent"
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex h-full w-[86.8vw] flex-col justify-end px-4 pb-8 sm:px-6 lg:px-0 lg:pb-10">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/80">
          Vandaag ontdekt
        </p>
        <h1
          className="mt-1 text-[2rem] font-semibold leading-tight text-white drop-shadow sm:text-[2.4rem]"
          style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
        >
          {name}
        </h1>
        <p className="mt-2 max-w-xl text-[15px] text-white/92 sm:text-[16px]">{teaser}</p>
      </div>
    </section>
  );
}
