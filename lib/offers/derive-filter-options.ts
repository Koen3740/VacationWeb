import { TravelOffer } from '../feeds/canonical/travel-offer';
import { FilterOptions } from '../../types/travel';
import {
  CANONICAL_BOARD_TYPES,
  canonicalizeBoardType,
} from './canonicalize-board-type';
import { canonicalizeCountryName } from './canonical-country';
import {
  deriveDestinationCountryCounts,
  derivePopularDestinations,
} from './derive-destination-countries';
import { deriveHomeThemes } from './derive-home-themes';

export function deriveCitiesByCountry(offers: TravelOffer[]): Record<string, string[]> {
  const map = new Map<string, Set<string>>();

  for (const offer of offers) {
    const country = canonicalizeCountryName(offer.destinationCountry);
    const city = offer.destinationCity?.trim();
    if (!country || !city) {
      continue;
    }

    const set = map.get(country) ?? new Set<string>();
    set.add(city);
    map.set(country, set);
  }

  const result: Record<string, string[]> = {};
  for (const [country, cities] of map) {
    result[country] = [...cities].sort((left, right) => left.localeCompare(right, 'nl'));
  }
  return result;
}

export function deriveAccommodationTypes(offers: TravelOffer[]): string[] {
  const counts = new Map<string, number>();

  for (const offer of offers) {
    const type = offer.accommodationType?.trim();
    if (!type) {
      continue;
    }
    counts.set(type, (counts.get(type) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'nl'))
    .map(([type]) => type);
}

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

  const countryCounts: Record<string, number> = {};
  for (const { name, count } of deriveDestinationCountryCounts(offers)) {
    countryCounts[name] = count;
  }

  return {
    countries: [...countrySet].sort(),
    regionsByCountry,
    citiesByCountry: deriveCitiesByCountry(offers),
    boardTypes: CANONICAL_BOARD_TYPES.filter((type) => boardTypeSet.has(type)),
    accommodationTypes: deriveAccommodationTypes(offers),
    departureAirports: [...airportSet].sort(),
    countryCounts,
    totalOffers: offers.length,
    popularDestinations: derivePopularDestinations(offers),
    homeThemes: deriveHomeThemes(offers),
  };
}
