import Link from 'next/link';
import { CHROME_COPY, type ChromeCopy } from '@/lib/i18n/chrome-copy';

/** "Over ons" anchor. Glass steps: search, compare, book with the provider. */
export function HomeValueSection({ copy = CHROME_COPY.nl.value }: { copy?: ChromeCopy['value'] } = {}) {
  return (
    <section id="value" className="px-[18px] pb-[clamp(70px,9vw,130px)] sm:px-[clamp(20px,4vw,56px)]">
      <div className="mx-auto max-w-[1180px]">
        <div className="vw-glass p-2.5 sm:p-2.5">
          <div className="px-5 pb-2 pt-7 sm:px-8 sm:pt-9">
            <p className="vw-home-kicker">{copy.kicker}</p>
            <h2 className="vw-home-h2 max-w-[16ch]">{copy.title}</h2>
            <p className="mt-4 max-w-[40ch] text-[15px] leading-relaxed text-white/80">{copy.body}</p>
          </div>
          <ol className="grid grid-cols-1 sm:grid-cols-3">
            {copy.points.map((point, index) => (
              <li
                key={point.title}
                className="border-t border-white/15 px-5 py-6 sm:border-t-0 sm:px-8 sm:py-9 sm:[&:not(:first-child)]:border-l"
              >
                <span className="grid h-[38px] w-[38px] place-items-center rounded-full border border-white/80 font-vw-serif text-[16px] text-white/80">
                  {index + 1}
                </span>
                <h3 className="mt-5 font-vw-serif text-[22px] font-medium leading-tight sm:text-[24px]">{point.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/80">{point.body}</p>
              </li>
            ))}
          </ol>
          <div className="px-5 pb-6 sm:px-8 sm:pb-8">
            <Link
              href="/#hero"
              className="inline-flex min-h-10 items-center text-[14.5px] font-medium text-white underline decoration-white/60 underline-offset-4"
            >
              {copy.cta}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
