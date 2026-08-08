import filterOptions from '@/data/filter-options.json';
import { FilterOptions } from '@/types/travel';
import {
  CANONICAL_BOARD_TYPES,
  canonicalizeBoardType,
} from './canonicalize-board-type';
import { canonicalizeCountryName } from './canonical-country';

export function loadFilterOptions(): FilterOptions {
  const countries = [
    ...new Set(filterOptions.countries.map(canonicalizeCountryName)),
  ].sort((left, right) => left.localeCompare(right, 'nl'));

  const regionsByCountry: Record<string, string[]> = {};

  for (const [country, regions] of Object.entries(filterOptions.regionsByCountry)) {
    const canonicalCountry = canonicalizeCountryName(country);
    const mergedRegions = new Set([
      ...(regionsByCountry[canonicalCountry] ?? []),
      ...regions,
    ]);
    regionsByCountry[canonicalCountry] = [...mergedRegions].sort((left, right) =>
      left.localeCompare(right, 'nl'),
    );
  }

  const boardTypeSet = new Set(
    filterOptions.boardTypes
      .map((value) => canonicalizeBoardType(value))
      .filter((value): value is NonNullable<typeof value> => Boolean(value)),
  );

  return {
    countries,
    regionsByCountry,
    boardTypes: CANONICAL_BOARD_TYPES.filter((type) => boardTypeSet.has(type)),
    departureAirports: filterOptions.departureAirports,
  };
}
