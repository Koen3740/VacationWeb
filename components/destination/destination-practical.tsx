type DestinationPracticalProps = {
  title: string;
  items: readonly string[];
};

export function DestinationPractical({ title, items }: DestinationPracticalProps) {
  return (
    <section className="mt-12" aria-labelledby="destination-practical-heading">
      <h2
        id="destination-practical-heading"
        className="text-[1.25rem] font-semibold text-[#0A2D62]"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        {title}
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-[14px] leading-snug text-[#0A2D62]/88">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
