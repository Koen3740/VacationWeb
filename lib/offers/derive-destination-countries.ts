import { TravelOffer } from '@/types/travel';

export type DestinationCountryCount = {
  name: string;
  count: number;
};

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
