import Link from 'next/link';
import { CHROME_COPY, type ChromeCopy } from '@/lib/i18n/chrome-copy';
import { HOMEPAGE_DISCOVERY_HREF } from '@/lib/home/homepage-sections';

/** Inspiration anchor. Glass copy over the photo, linking into Discovery. */
export function HomeInspirationBand({
  copy = CHROME_COPY.nl.inspiration,
}: { copy?: ChromeCopy['inspiration'] } = {}) {
  return (
    <section id="inspiratie" className="px-[18px] pb-[clamp(48px,7vw,90px)] sm:px-[clamp(20px,4vw,56px)]">
      <div className="mx-auto max-w-[1180px]">
        <div className="vw-glass max-w-3xl px-6 py-8 sm:px-9 sm:py-10">
          <p className="vw-home-kicker">{copy.eyebrow}</p>
          <h2 className="vw-home-h2">{copy.title}</h2>
          <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-white/80">{copy.body}</p>
          <p className="mt-5 max-w-[28ch] font-vw-serif text-[22px] leading-snug text-white/95">{copy.quote}</p>
          <Link
            href={HOMEPAGE_DISCOVERY_HREF}
            className="mt-6 inline-flex border-b border-current pb-0.5 text-[14.5px] font-medium text-white"
          >
            {copy.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}
