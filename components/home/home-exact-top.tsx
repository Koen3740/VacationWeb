import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

type HomeExactTopProps = {
  search: ReactNode;
};

/**
 * Mockup slab header+hero (0–620). Desktop: HomeSearch at mockup slot
 * (152, 541) size 1128×124 within 1440×620. Mobile: in-flow under hero.
 */
export function HomeExactTop({ search }: HomeExactTopProps) {
  return (
    <section className="relative w-full bg-[#F9F7F2]" aria-label="Header en hero">
      <div className="relative mx-auto w-full max-w-[1440px]">
        <div className="relative w-full lg:aspect-[1440/620]">
          <div className="relative aspect-[1440/505] w-full lg:absolute lg:inset-0 lg:aspect-auto">
            <Image
              src="/images/mockup-ssot/slab-top.jpg"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-top"
            />

            <Link href="/" className="absolute left-[3%] top-[1.2%] z-10 h-[6.5%] w-[14%]" aria-label="VacationWeb home" />
            <nav
              className="absolute left-[22%] right-[18%] top-[1.6%] z-10 hidden h-[5.5%] items-stretch justify-between md:flex"
              aria-label="Hoofdnavigatie"
            >
              <Link href="/#ontdekt" className="flex-1" aria-label="Ontdek" />
              <Link href="/#hero" className="flex-1" aria-label="Zoeken" />
              <Link href="/bestemmingen" className="flex-1" aria-label="Bestemmingen" />
              <Link href="/#inspiratie" className="flex-1" aria-label="Inspiratie" />
              <Link href="/aanbiedingen" className="flex-1" aria-label="Aanbod" />
              <Link href="/#waarom" className="flex-1" aria-label="Over ons" />
            </nav>
            <Link href="/favorieten" className="absolute right-[3%] top-[1.6%] z-10 h-[5.5%] w-[12%]" aria-label="Opgeslagen" />

            <Link href="/#inspiratie" className="absolute bottom-[22%] left-[4.5%] z-10 h-[8%] w-[8%] lg:bottom-[18%] lg:h-[7%] lg:w-[7%]" aria-label="Speel" />
            <Link href="/#ontdekt" className="absolute bottom-[22%] left-[13.5%] z-10 h-[8%] w-[12%] lg:bottom-[18%] lg:h-[7%] lg:w-[11%]" aria-label="Waar is dit?" />
          </div>

          <div
            id="hero"
            className="relative z-30 mx-auto -mt-10 w-[min(1128px,calc(100%-1.5rem))] min-h-[124px] lg:absolute lg:left-[10.555%] lg:top-[87.258%] lg:mt-0 lg:w-[78.333%]"
          >
            {search}
          </div>
        </div>
      </div>
    </section>
  );
}
