import { TravelOffer } from '../feeds/canonical/travel-offer';
import { FilterOptions } from '../../types/travel';

export function deriveFilterOptions(offers: TravelOffer[]): FilterOptions {
  const countrySet = new Set<string>();
  const regionsByCountryMap = new Map<string, Set<string>>();
  const boardTypeSet = new Set<string>();
  const airportSet = new Set<string>();

  for (const offer of offers) {
    const country = offer.destinationCountry;
    if (country) {
      countrySet.add(country);

      if (offer.destinationRegion) {
        const regions = regionsByCountryMap.get(country) ?? new Set<string>();
        regions.add(offer.destinationRegion);
        regionsByCountryMap.set(country, regions);
      }
    }

    if (offer.boardType) {
      boardTypeSet.add(offer.boardType);
    }

    if (offer.departureAirport) {
      airportSet.add(offer.departureAirport);
    }
  }

  const regionsByCountry: Record<string, string[]> = {};
  for (const [country, regions] of regionsByCountryMap) {
    regionsByCountry[country] = [...regions].sort();
  }

  return {
    countries: [...countrySet].sort(),
    regionsByCountry,
    boardTypes: [...boardTypeSet].sort(),
    departureAirports: [...airportSet].sort(),
  };
}
