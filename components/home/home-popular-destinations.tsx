import { PopularDestination } from '@/lib/offers/derive-destination-countries';
import { HomePhotoCardLink } from '@/components/home/home-photo-card-link';
import { RESULTS_MUTED, RESULTS_NAVY } from '@/components/results-v2/results-design-tokens';

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
    <section id="popular-destinations" className="mx-auto max-w-[1600px] px-6 pb-10 pt-12 lg:px-8 lg:pb-12 lg:pt-14">
      <div className="max-w-2xl">
        <h2 className="text-[22px] font-bold tracking-tight" style={{ color: RESULTS_NAVY }}>
          Populaire bestemmingen
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: RESULTS_MUTED }}>
          Ontdek populaire zonbestemmingen en vergelijk direct beschikbare vakanties.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 lg:gap-5">
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
