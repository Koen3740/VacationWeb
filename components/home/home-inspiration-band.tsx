import Image from 'next/image';
import Link from 'next/link';

const SCRIPT_STACK =
  "Segoe Script, 'Apple Chancery', 'Snell Roundhand', cursive";

/** WOW inspiration — NEVER Concept C “Europa wacht met open kusten.” */
export function HomeInspirationBand() {
  return (
    <section id="inspiratie" className="relative">
      <div className="relative mx-auto h-[220px] w-[86.8vw] overflow-hidden sm:h-[260px] lg:h-[297px]">
        <Image
          src="/images/verified/mood/homepage-inspiration.jpg"
          alt=""
          fill
          sizes="86.8vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/25 to-black/10" aria-hidden />
        <div className="relative z-10 mx-auto flex h-full w-full flex-col justify-center gap-3 px-6 py-4 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:px-16">
          <div className="max-w-md text-white">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E8C547]">
              Meer dan vakanties
            </p>
            <h2
              className="mt-1 text-[1.6rem] font-semibold leading-tight sm:text-[1.95rem] lg:text-[39px]"
              style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
            >
              Reizen verrijkt je leven
            </h2>
            <p className="mt-1.5 max-w-sm text-[12.5px] leading-snug text-white/92">
              Nieuwe plekken. Andere culturen. Bijzondere mensen. Of je nu ver weg gaat of dichter bij
              huis blijft — reizen opent je wereld.
            </p>
            <Link
              href="/ontdekt/sicily"
              className="mt-2.5 inline-flex min-h-[34px] items-center justify-center rounded-full bg-white px-4 text-[12.5px] font-semibold text-[#0A2D62] transition hover:bg-white/95"
            >
              Laat je inspireren →
            </Link>
          </div>
          <div className="max-w-[15rem] lg:text-right">
            <p
              className="rotate-[-5deg] text-[1.15rem] leading-snug text-white/95 lg:text-[1.3rem]"
              style={{ fontFamily: SCRIPT_STACK }}
            >
              “Niet alleen een bestemming, maar een ander perspectief.”
            </p>
            <span className="mt-1.5 inline-block h-[3px] w-20 rounded-full bg-[#E8C547] lg:ml-auto" aria-hidden />
          </div>
        </div>
      </div>
    </section>
  );
}
