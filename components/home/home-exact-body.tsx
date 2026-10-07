import Image from 'next/image';
import Link from 'next/link';

/**
 * Mockup slab: trust → vandaag ontdekt → inspiration → popular → waarom → blijf ontdekken → footer.
 * Interactive hit-areas over baked UI; visuals are the mockup raster.
 */
export function HomeExactBody() {
  return (
    <section id="ontdekt" className="relative w-full bg-[#F7F5F1]" aria-label="Homepage body">
      <div className="relative mx-auto w-full max-w-[1440px]">
        <div className="relative aspect-[1440/1742] w-full">
          <Image
            src="/images/mockup-ssot/slab-body.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-top"
            priority={false}
          />

          {/* Discover 2x2 — approximate relative positions in body slab */}
          <div id="inspiratie" className="absolute left-0 top-[38%] h-[1px] w-full" aria-hidden />
          <div id="waarom" className="absolute left-0 top-[78%] h-[1px] w-full" aria-hidden />

          {/* Discover cards */}
          <Link href="/results?country=Albanië" className="absolute left-[5%] top-[12%] z-10 h-[14%] w-[44%]" aria-label="Albanië" />
          <Link href="/results?country=Italië" className="absolute left-[51%] top-[12%] z-10 h-[14%] w-[44%]" aria-label="Sicilië" />
          <Link href="/results?country=Griekenland" className="absolute left-[5%] top-[27%] z-10 h-[14%] w-[44%]" aria-label="Kreta" />
          <Link href="/results?country=Italië" className="absolute left-[51%] top-[27%] z-10 h-[14%] w-[44%]" aria-label="Sardinië" />

          {/* Inspiration CTA */}
          <Link href="/#hero" className="absolute left-[5%] top-[48%] z-10 h-[3.5%] w-[16%]" aria-label="Inspiratie opdoen" />

          {/* Popular destinations */}
          <Link href="/results?country=Griekenland" className="absolute left-[5%] top-[58%] z-10 h-[10%] w-[29%]" aria-label="Griekenland" />
          <Link href="/results?country=Spanje" className="absolute left-[35.5%] top-[58%] z-10 h-[10%] w-[29%]" aria-label="Spanje" />
          <Link href="/results?country=Turkije" className="absolute left-[66%] top-[58%] z-10 h-[10%] w-[29%]" aria-label="Turkije" />
          <Link href="/results?country=Italië" className="absolute left-[20%] top-[69%] z-10 h-[10%] w-[29%]" aria-label="Italië" />
          <Link href="/results?country=Portugal" className="absolute left-[51%] top-[69%] z-10 h-[10%] w-[29%]" aria-label="Portugal" />

          {/* Blijf ontdekken CTA */}
          <Link href="/bestemmingen" className="absolute right-[6%] top-[86%] z-10 h-[3%] w-[18%]" aria-label="Verken bestemmingen" />
        </div>
      </div>
    </section>
  );
}
