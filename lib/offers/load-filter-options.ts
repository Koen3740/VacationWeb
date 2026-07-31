import filterOptions from '@/data/filter-options.json';
import { FilterOptions } from '@/types/travel';
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

  return {
    countries,
    regionsByCountry,
    boardTypes: filterOptions.boardTypes,
    departureAirports: filterOptions.departureAirports,
  };
}
