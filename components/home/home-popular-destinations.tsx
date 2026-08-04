import { PopularDestination } from '@/lib/offers/derive-destination-countries';
import { HomePhotoCardLink } from '@/components/home/home-photo-card-link';

type HomePopularDestinationsProps = {
  destinations: PopularDestination[];
};

const TOP_DESTINATIONS = [
  'Spanje',
  'Griekenland',
  'Turkije',
  'Canarische Eilanden',
  'Portugal',
] as const;

const DESTINATION_IMAGES: Record<(typeof TOP_DESTINATIONS)[number], string> = {
  Spanje: '/images/destinations/spanje.png',
  Griekenland: '/images/destinations/griekenland.png',
  Turkije: '/images/destinations/turkije.png',
  'Canarische Eilanden': '/images/destinations/canarische-eilanden.png',
  Portugal: '/images/destinations/portugal.png',
};

function prepareDestinationsForDisplay(destinations: PopularDestination[]): PopularDestination[] {
  const available = new Map(destinations.map((destination) => [destination.name, destination]));

  return TOP_DESTINATIONS.map((name) => available.get(name) ?? { name, count: 0 });
}

export function HomePopularDestinations({ destinations }: HomePopularDestinationsProps) {
  const displayDestinations = prepareDestinationsForDisplay(destinations);

  return (
    <section id="popular-destinations" className="mx-auto max-w-[1200px] px-4 py-14 sm:px-5 lg:px-6">
      <div className="max-w-2xl">
        <h2 className="text-[28px] font-bold tracking-[-0.02em] text-[#0A2D62] sm:text-[32px]">
          Populaire bestemmingen
        </h2>
        <p className="mt-3 text-[17px] leading-relaxed text-slate-600">
          Ontdek populaire zonbestemmingen en vergelijk direct beschikbare vakanties.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-5 gap-3 sm:gap-4">
        {displayDestinations.map((destination) => (
          <HomePhotoCardLink
            key={destination.name}
            href={`/results?country=${encodeURIComponent(destination.name)}`}
            imageSrc={DESTINATION_IMAGES[destination.name as keyof typeof DESTINATION_IMAGES]}
            title={destination.name}
          />
        ))}
      </div>
    </section>
  );
}
