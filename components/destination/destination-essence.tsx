import Link from 'next/link';

type DestinationEssenceProps = {
  title: string;
  essence: string;
  why: readonly string[];
  earlyBridgeHref: string;
  earlyBridgeLabel: string;
};

/** Essence + why — replaces generic highlight cards as primary story. */
export function DestinationEssence({
  title,
  essence,
  why,
  earlyBridgeHref,
  earlyBridgeLabel,
}: DestinationEssenceProps) {
  return (
    <section className="mt-8" aria-labelledby="destination-essence-heading">
      <h2
        id="destination-essence-heading"
        className="text-[1.45rem] font-semibold text-[#0A2D62] sm:text-[1.6rem]"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        {title}
      </h2>
      <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-[#0A2D62]/95 sm:text-[17px]">
        {essence}
      </p>
      <ul className="mt-5 space-y-2">
        {why.map((item) => (
          <li
            key={item}
            className="flex gap-2 text-[14px] leading-snug text-[#0A2D62]/90"
          >
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A2D62]/55" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-5">
        <Link
          href={earlyBridgeHref}
          className="text-[13.5px] font-medium text-[#0A2D62] underline decoration-[#0A2D62]/35 underline-offset-4 hover:decoration-[#0A2D62]"
        >
          {earlyBridgeLabel} →
        </Link>
      </p>
    </section>
  );
}