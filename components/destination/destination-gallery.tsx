import Image from 'next/image';

export type DestinationGalleryCard = {
  assetId: string;
  src: string;
  placeLabel: string;
};

type DestinationGalleryProps = {
  destinationName: string;
  intro: string;
  items: readonly DestinationGalleryCard[];
};

/** Destination Media gallery — FINAL curated set only. */
export function DestinationGallery({ destinationName, intro, items }: DestinationGalleryProps) {
  return (
    <section className="mt-10" aria-labelledby="destination-gallery-heading">
      <h2
        id="destination-gallery-heading"
        className="text-[1.35rem] font-semibold text-[#0A2D62]"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        Beelden uit {destinationName}
      </h2>
      <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-[#64748B]">{intro}</p>

      {items.length === 0 ? (
        <p className="mt-6 text-[14px] text-[#64748B]">
          Nog geen scherpe beelden beschikbaar voor deze bestemming.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.assetId}
              className="overflow-hidden rounded-[12px] bg-white shadow-[0_8px_24px_rgba(10,45,98,0.06)] ring-1 ring-[#E8E4DC]/80"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden">
                <Image
                  src={item.src}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 90vw, 30vw"
                />
              </div>
              {item.placeLabel ? (
                <div className="px-3 py-2.5">
                  <p className="text-[12.5px] font-semibold text-[#0A2D62]">{item.placeLabel}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
