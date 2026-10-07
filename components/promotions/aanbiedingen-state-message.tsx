import Link from 'next/link';

const SERIF = { fontFamily: 'var(--font-vw-serif), Georgia, serif' } as const;

/**
 * Empty and error state for /aanbiedingen. Never shows stand-in promotions.
 * Links go to routes that exist (/bestemmingen, /).
 */
export function AanbiedingenStateMessage({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div
      role="status"
      className="mx-auto max-w-[640px] rounded-2xl border border-[#E8E4DC] bg-white px-6 py-12 text-center sm:px-10 sm:py-14"
    >
      <h3
        style={SERIF}
        className="text-[24px] font-semibold leading-snug tracking-tight text-[#0A2D62] sm:text-[28px]"
      >
        {title}
      </h3>
      <p className="mx-auto mt-3 max-w-[30rem] text-[15px] leading-relaxed text-[#475569]">{body}</p>
      <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Link
          href="/bestemmingen"
          className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#0A2D62] px-6 py-2.5 text-[15px] font-semibold text-white transition hover:bg-[#082452] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A2D62]"
        >
          Bekijk bestemmingen
        </Link>
        <Link
          href="/"
          className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-[#D6D0C4] px-6 py-2.5 text-[15px] font-semibold text-[#0A2D62] transition hover:border-[#0A2D62] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A2D62]"
        >
          Naar de homepage
        </Link>
      </div>
    </div>
  );
}
