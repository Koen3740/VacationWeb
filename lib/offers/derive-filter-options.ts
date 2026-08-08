import { TravelOffer } from '../feeds/canonical/travel-offer';
import { FilterOptions } from '../../types/travel';
import {
  CANONICAL_BOARD_TYPES,
  canonicalizeBoardType,
} from './canonicalize-board-type';

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

    const boardType = canonicalizeBoardType(offer.boardType);
    if (boardType) {
      boardTypeSet.add(boardType);
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
    boardTypes: CANONICAL_BOARD_TYPES.filter((type) => boardTypeSet.has(type)),
    departureAirports: [...airportSet].sort(),
  };
}
