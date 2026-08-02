import { TravelOffer } from '@/types/travel';

export type DestinationCountryCount = {
  name: string;
  count: number;
};

export type PopularDestination = DestinationCountryCount;

const POPULAR_DESTINATIONS_LIMIT = 10;

const POPULAR_COUNTRY_NAMES = [
  'Spanje',
  'Griekenland',
  'Turkije',
  'Canarische Eilanden',
  'Italië',
  'Portugal',
  'Egypte',
  'Marokko',
  'Tunesië',
  'Albanië',
] as const;

export function deriveDestinationCountryCounts(offers: TravelOffer[]): DestinationCountryCount[] {
  const counts = new Map<string, number>();

  for (const offer of offers) {
    const country = offer.destinationCountry;
    if (!country) {
      continue;
    }

    counts.set(country, (counts.get(country) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => left.name.localeCompare(right.name, 'nl'));
}

export function derivePopularDestinations(offers: TravelOffer[]): PopularDestination[] {
  const counts = new Map<string, number>();

  for (const offer of offers) {
    const country = offer.destinationCountry;
    if (!country) {
      continue;
    }

    counts.set(country, (counts.get(country) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .filter((destination) => destination.count > 0)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'nl'))
    .slice(0, POPULAR_DESTINATIONS_LIMIT);
}

export function derivePopularCountries(offers: TravelOffer[]): DestinationCountryCount[] {
  const counts = new Map<string, number>();

  for (const offer of offers) {
    const country = offer.destinationCountry;
    if (!country) {
      continue;
    }

    counts.set(country, (counts.get(country) ?? 0) + 1);
  }

  return POPULAR_COUNTRY_NAMES
    .filter((name) => (counts.get(name) ?? 0) > 0)
    .map((name) => ({ name, count: counts.get(name) ?? 0 }));
}
