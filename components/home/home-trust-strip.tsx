import { CHROME_COPY, type ChromeCopy } from '@/lib/i18n/chrome-copy';

/** t66u: labels from the chrome dictionary (default Dutch). Glass cards over the hero photo. */
export function HomeTrustStrip({ copy = CHROME_COPY.nl.trust }: { copy?: ChromeCopy['trust'] } = {}) {
  return (
    <section aria-label={copy.ariaLabel} className="px-[18px] pb-4 pt-2 sm:px-[clamp(20px,4vw,56px)] sm:pt-[clamp(40px,5vw,70px)]">
      <div className="mx-auto max-w-[1180px]">
        <p className="vw-home-kicker">{copy.kicker}</p>
        <h2 className="vw-home-h2 mb-8 max-w-[16ch] sm:mb-10">{copy.title}</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-[18px] xl:grid-cols-4">
          {copy.items.map((item, index) => (
            <li key={item.label} className="vw-glass px-6 py-6 sm:px-7 sm:py-8">
              <p className="font-vw-serif text-[15px] text-white/70">{String(index + 1).padStart(2, '0')}</p>
              <h3 className="mt-3 font-vw-serif text-[21px] font-medium leading-snug text-white sm:mt-4 sm:text-[23px]">
                {item.label}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-white/80">{item.detail}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
