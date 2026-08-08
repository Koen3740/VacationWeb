import Image from 'next/image';
import type { ResultsIntroContent } from '@/components/results-v2/results-intro-copy';
import type { ReactNode } from 'react';

type ResultsHeroProps = {
  intro: ResultsIntroContent;
  searchBar: ReactNode;
};

export function ResultsHero({ intro, searchBar }: ResultsHeroProps) {
  return (
    <section className="relative">
      <div className="relative h-[300px] w-full overflow-hidden sm:h-[340px] lg:h-[380px]">
        <Image
          src="/images/hero-results-mediterranean-v1.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[48%_42%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-black/28 to-black/12" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-transparent to-black/18" />

        <div className="relative z-10 mx-auto flex h-full max-w-[1280px] flex-col justify-center px-6 pb-16 pt-8 lg:px-8">
          <h1 className="max-w-2xl text-[2rem] font-bold leading-[1.15] tracking-tight text-white drop-shadow-sm sm:text-[2.5rem] lg:text-[2.75rem]">
            {intro.heroTitle}
          </h1>
          <p className="mt-3 max-w-xl text-[16px] leading-relaxed text-white/95 sm:text-[18px]">
            {intro.heroSubtitle}
          </p>
        </div>
      </div>

      <div className="relative z-20 mx-auto -mt-[34px] max-w-[1280px] px-6 lg:-mt-[38px] lg:px-8">
        {searchBar}
      </div>
    </section>
  );
}
