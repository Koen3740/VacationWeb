type ChapterNavItem = { id: string; title: string };

type DestinationChapterNavProps = {
  items: readonly ChapterNavItem[];
};

/** In-page chapter chips — mobile wrap, no overflow. */
export function DestinationChapterNav({ items }: DestinationChapterNavProps) {
  if (!items.length) return null;

  return (
    <nav
      className="mt-8 border-y border-[#E8E4DC] py-3"
      aria-label="Hoofdstukken"
    >
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="inline-flex rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#0A2D62] ring-1 ring-[#E8E4DC] hover:bg-[#F5F0E8]"
            >
              {item.title}
            </a>
          </li>
        ))}
        <li>
          <a
            href="#wow"
            className="inline-flex rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#0A2D62] ring-1 ring-[#E8E4DC] hover:bg-[#F5F0E8]"
          >
            WOW
          </a>
        </li>
      </ul>
    </nav>
  );
}
