import { HomeDiscoverCard } from '@/components/home/home-discover-card';
import { homepageDiscoverGridClass } from '@/components/home/home-discover-grid';
import { RESULTS_NAVY } from '@/components/results-v2/results-design-tokens';
import { DISCOVER_FALLBACK_IMAGE } from '@/lib/discover/constants';
import { getHomepageDiscoverDestinations } from '@/lib/discover/homepage';
import { resolveDiscoverImageSrc } from '@/lib/discover/media';

export function HomeDiscoverTeaser() {
  const destinations = getHomepageDiscoverDestinations();

  return (
    <section
      id="ontdekt"
      aria-labelledby="ontdekt-heading"
      className="mx-auto max-w-[1600px] px-6 pb-10 pt-12 lg:px-8 lg:pb-12 lg:pt-14"
    >
      <div className="max-w-2xl">
        <h2
          id="ontdekt-heading"
          className="text-[22px] font-bold tracking-tight"
          style={{ color: RESULTS_NAVY }}
        >
          Vandaag ontdekt
        </h2>
      </div>

      <div className={homepageDiscoverGridClass(destinations.length)}>
        {destinations.map((destination) => (
          <HomeDiscoverCard
            key={destination.destinationId}
            destination={destination}
            imageSrc={resolveDiscoverImageSrc(destination.imageSrc)}
            fallbackSrc={DISCOVER_FALLBACK_IMAGE}
          />
        ))}
      </div>
    </section>
  );
}
