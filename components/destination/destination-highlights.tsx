type DestinationHighlightsProps = {
  items: readonly string[];
};

/** Short why-this-destination bullets — not long blog copy. */
export function DestinationHighlights({ items }: DestinationHighlightsProps) {
  if (!items.length) return null;

  return (
    <section className="mt-8" aria-labelledby="destination-highlights-heading">
      <h2
        id="destination-highlights-heading"
        className="text-[1.35rem] font-semibold text-[#0A2D62]"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        Waarom hierheen
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-[12px] bg-white px-4 py-3 text-[13.5px] leading-snug text-[#0A2D62] shadow-[0_6px_18px_rgba(10,45,98,0.05)] ring-1 ring-[#E8E4DC]/80"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
