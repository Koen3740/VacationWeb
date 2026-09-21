import Image from 'next/image';

export type DestinationPlaceItem = {
  placeId: string;
  label: string;
  src: string;
};

type DestinationPlacesProps = {
  destinationName: string;
  places: readonly DestinationPlaceItem[];
};

/** Places derived from curated Destination Media gallery (unique placeIds). */
export function DestinationPlaces({ destinationName, places }: DestinationPlacesProps) {
  if (!places.length) return null;

  return (
    <section className="mt-10" aria-labelledby="destination-places-heading">
      <h2
        id="destination-places-heading"
        className="text-[1.35rem] font-semibold text-[#0A2D62]"
        style={{ fontFamily: 'var(--font-vw-serif), Georgia, serif' }}
      >
        Plekken in {destinationName}
      </h2>
      <p className="mt-1 text-[13.5px] text-[#64748B]">
        Een selectie van plekken die je op de foto&apos;s hieronder terugziet.
      </p>
      <ul className="mt-4 flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-3 sm:overflow-visible lg:grid-cols-6 [&::-webkit-scrollbar]:hidden">
        {places.map((place) => (
          <li
            key={place.placeId}
            className="w-[42%] shrink-0 overflow-hidden rounded-[12px] bg-white shadow-[0_6px_18px_rgba(10,45,98,0.05)] ring-1 ring-[#E8E4DC]/80 sm:w-auto"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={place.src}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 640px) 42vw, 15vw"
              />
            </div>
            <p className="px-2.5 py-2 text-[12px] font-semibold text-[#0A2D62]">{place.label}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
