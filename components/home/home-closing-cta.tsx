import Link from 'next/link';

/** Mockup SSOT — Blijf ontdekken band with Verken bestemmingen CTA. */
export function HomeClosingCta() {
  return (
    <section className="border-y border-[#E8E4DC] bg-[#FBF9F6]">
      <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-6 px-6 py-12 sm:flex-row sm:items-center lg:px-8 lg:py-14">
        <div className="max-w-lg">
          <h2
            className="text-[1.65rem] font-semibold tracking-tight text-[#0A2D62] sm:text-[1.85rem]"
            style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
          >
            Blijf ontdekken
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-[#64748B]">
            Nieuwe bestemmingen, sfeerbeelden en vakantie-ideeën — wanneer jij eraan toe bent.
          </p>
        </div>
        <Link
          href="/bestemmingen"
          className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-full bg-[#0A2D62] px-7 text-[14px] font-semibold text-white transition hover:bg-[#082452] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B8FC7]"
        >
          Verken bestemmingen
        </Link>
      </div>
    </section>
  );
}
