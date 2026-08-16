import filterOptions from '@/data/filter-options.json';
import { FilterOptions } from '@/types/travel';
import {
  CANONICAL_BOARD_TYPES,
  canonicalizeBoardType,
} from './canonicalize-board-type';
import { canonicalizeCountryName } from './canonical-country';

function canonicalizeKeyedLists(
  source: Record<string, string[]> | undefined,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (!source) {
    return result;
  }

  for (const [country, values] of Object.entries(source)) {
    const canonicalCountry = canonicalizeCountryName(country);
    const merged = new Set([...(result[canonicalCountry] ?? []), ...values]);
    result[canonicalCountry] = [...merged].sort((left, right) =>
      left.localeCompare(right, 'nl'),
    );
  }

  return result;
}

export function loadFilterOptions(): FilterOptions {
  const stored = filterOptions as FilterOptions;
  const countries = [
    ...new Set(stored.countries.map(canonicalizeCountryName)),
  ].sort((left, right) => left.localeCompare(right, 'nl'));

  const boardTypeSet = new Set(
    stored.boardTypes
      .map((value) => canonicalizeBoardType(value))
      .filter((value): value is NonNullable<typeof value> => Boolean(value)),
  );

  const countryCounts: Record<string, number> = {};
  for (const [country, count] of Object.entries(stored.countryCounts ?? {})) {
    const canonical = canonicalizeCountryName(country);
    countryCounts[canonical] = (countryCounts[canonical] ?? 0) + count;
  }

  return {
    countries,
    regionsByCountry: canonicalizeKeyedLists(stored.regionsByCountry),
    citiesByCountry: canonicalizeKeyedLists(stored.citiesByCountry),
    boardTypes: CANONICAL_BOARD_TYPES.filter((type) => boardTypeSet.has(type)),
    accommodationTypes: stored.accommodationTypes ?? [],
    departureAirports: stored.departureAirports,
    countryCounts,
    totalOffers: stored.totalOffers,
    popularDestinations: stored.popularDestinations ?? [],
    homeThemes: stored.homeThemes ?? [],
  };
}
