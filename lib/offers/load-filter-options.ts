import filterOptions from '@/data/filter-options.json';
import { FilterCountryCount, FilterOptions } from '@/types/travel';
import {
  CANONICAL_BOARD_TYPES,
  canonicalizeBoardType,
} from './canonicalize-board-type';
import { canonicalizeCountryName } from './canonical-country';
import { canonicalizeRegionName } from './canonical-region';

function canonicalizeKeyedLists(
  source: Record<string, string[]> | undefined,
  canonicalizeValue: (value: string) => string = (value) => value,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (!source) {
    return result;
  }

  for (const [country, values] of Object.entries(source)) {
    const canonicalCountry = canonicalizeCountryName(country);
    const merged = new Set([
      ...(result[canonicalCountry] ?? []),
      ...values.map((value) => canonicalizeValue(value)).filter(Boolean),
    ]);
    result[canonicalCountry] = [...merged].sort((left, right) =>
      left.localeCompare(right, 'nl'),
    );
  }

  return result;
}

function canonicalizePopularDestinations(
  stored: FilterCountryCount[] | undefined,
): FilterCountryCount[] {
  const counts = new Map<string, number>();
  for (const destination of stored ?? []) {
    const name = canonicalizeCountryName(destination.name);
    if (!name) {
      continue;
    }
    counts.set(name, (counts.get(name) ?? 0) + destination.count);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'nl'));
}

export function canonicalizeFilterOptions(stored: FilterOptions): FilterOptions {
  const countries = [
    ...new Set((stored.countries ?? []).map(canonicalizeCountryName)),
  ].sort((left, right) => left.localeCompare(right, 'nl'));

  const boardTypeSet = new Set(
    (stored.boardTypes ?? [])
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
    regionsByCountry: canonicalizeKeyedLists(stored.regionsByCountry, canonicalizeRegionName),
    citiesByCountry: canonicalizeKeyedLists(stored.citiesByCountry),
    boardTypes: CANONICAL_BOARD_TYPES.filter((type) => boardTypeSet.has(type)),
    accommodationTypes: stored.accommodationTypes ?? [],
    departureAirports: stored.departureAirports,
    countryCounts,
    totalOffers: stored.totalOffers,
    popularDestinations: canonicalizePopularDestinations(stored.popularDestinations),
    homeThemes: stored.homeThemes ?? [],
  };
}

export function loadFilterOptions(): FilterOptions {
  return canonicalizeFilterOptions(filterOptions as FilterOptions);
}
