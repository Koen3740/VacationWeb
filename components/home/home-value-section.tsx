import Image from 'next/image';
import Link from 'next/link';

const POINTS = [
  { title: 'Eenvoudig vergelijken', body: 'Meerdere reisorganisaties' },
  { title: 'Altijd actuele prijzen', body: 'Geen verouderde vanaf-prijzen' },
  { title: 'Rechtstreeks boeken', body: 'Bij de aanbieder zelf' },
] as const;

/** WOW value — flat cream band, compact row (headline | icons | stamp). NOT elevated card. */
export function HomeValueSection() {
  return (
    <section id="value" className="bg-[#F6EFE8]">
      <div className="mx-auto box-border w-[86.8vw] px-4 py-7 sm:px-6 lg:flex lg:min-h-[400px] lg:items-center lg:px-0 lg:py-20">
        <div className="grid w-full items-center gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-3">
            <h2
              className="text-[1.75rem] font-semibold leading-snug text-[#0A2D62] sm:text-[2.1rem] lg:text-[2.4rem]"
              style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
            >
              Jouw volgende vakantie begint hier
            </h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-[#475569]">
              Of je nu al weet waar je naartoe wilt, of gewoon wilt ontdekken — wij helpen je verder.
            </p>
            <Link
              href="/#hero"
              className="mt-5 inline-flex min-h-[40px] items-center justify-center rounded-full bg-[#0A2D62] px-4 text-[12.5px] font-semibold text-white transition hover:bg-[#082452]"
            >
              Start met zoeken →
            </Link>
          </div>
          <ul className="grid gap-6 sm:grid-cols-3 lg:col-span-6 lg:grid-cols-3 lg:gap-8">
            {POINTS.map((p) => (
              <li key={p.title} className="text-center sm:text-left">
                <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-[#D6D0C4]/90 text-[#0A2D62] sm:mx-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </span>
                <p className="text-[15px] font-semibold text-[#0A2D62]">{p.title}</p>
                <p className="mt-1.5 text-[14px] leading-snug text-[#475569]">{p.body}</p>
              </li>
            ))}
          </ul>
          <div className="hidden items-center justify-center lg:col-span-3 lg:flex">
            <Image
              src="/images/wow-ssot/travel-good-stamp.png"
              alt="Travel good — feel better"
              width={220}
              height={165}
              className="h-auto w-[180px] opacity-95"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
