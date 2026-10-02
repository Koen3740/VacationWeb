import { normalizeDestinationSearchText } from '@/components/search/destination-popup/destination-popup-utils';
import directoryJson from '@/data/destination-directory.json';
import {
  buildDestinationEntries,
  entryLabel,
  type DestinationDirectory,
  type DestinationEntry,
} from '@/lib/search/destination-directory';
import { decodePlaceName } from '@/lib/search/destination-mapping';

/**
 * Single search field of the destination popup: country + area (region/island/collective area) +
 * place. The index is built from the M1 VacationWeb destination directory
 * (data/destination-directory.json, derived from the catalog by lib/search/destination-directory.ts):
 * one entry per destination, one spelling per destination, product names excluded, a short suffix
 * only where the same name is more than one destination ("Alanya - stad" / "Alanya - regio",
 * "Kalamaki - Kreta" / "Kalamaki - Zakynthos"). The URL keeps the existing contract
 * (country / region / city); the Results filter resolves the meaning (lib/search/destination-mapping.ts).
 */
export type DestinationSuggestionKind = 'country' | 'region' | 'city';

/** One area OR one place, always with its parent country (URL: country=A&region=X / country=A&[region=X&]city=P). */
export type DestinationPlaceSelection = {
  country: string;
  region?: string;
  city?: string;
};

export type DestinationSuggestion = {
  id: string;
  kind: DestinationSuggestionKind;
  /** Shown text: the destination name, plus the short suffix for homonyms only. */
  label: string;
  /** Destination name without suffix (entities decoded). For a country: the country. */
  value: string;
  /** Parent country (the country itself for kind "country"). */
  country: string;
  /** Area to write next to a place (only for homonym places). */
  region?: string;
  /** Lower-case, accent-free destination name used for matching. */
  normalized: string;
  /** Lower-case, accent-free label incl. suffix (secondary match: "kalamaki zakynthos"). */
  normalizedFull: string;
};

export const MAX_DESTINATION_SUGGESTIONS = 8;

export const DESTINATION_SEARCH_PLACEHOLDER = 'Zoek land, regio of plaats';

const KIND_RANK: Record<DestinationSuggestionKind, number> = { country: 0, region: 1, city: 2 };

/** Display only: some catalog place names carry HTML entities (e.g. "Cala d&apos;Or"). */
export function decodeDestinationLabel(value: string): string {
  return decodePlaceName(value);
}

function normalizeForMatch(value: string): string {
  return normalizeDestinationSearchText(decodeDestinationLabel(value).replace(/\u2019/g, "'"));
}

type IndexInput = {
  directory?: DestinationDirectory;
  /** When given, countries without offers (count 0) are left out, like the "Alle bestemmingen" list. */
  countryCounts?: Record<string, number>;
};

function suggestionFromEntry(entry: DestinationEntry): DestinationSuggestion {
  const label = entryLabel(entry);
  const value = entry.kind === 'country' ? entry.country : entry.kind === 'region' ? entry.region! : entry.city!;
  return {
    id: `${entry.kind}:${entry.country}:${label}`,
    kind: entry.kind,
    label,
    value,
    country: entry.country,
    ...(entry.kind === 'city' && entry.region ? { region: entry.region } : {}),
    normalized: normalizeForMatch(entry.name),
    normalizedFull: normalizeForMatch(label.replace(/\s\u2014\s/, ' ')),
  };
}

/** Flat list of searchable destinations (each destination once; labels are unique). */
export function buildDestinationSearchIndex(input: IndexInput = {}): DestinationSuggestion[] {
  const directory = input.directory ?? (directoryJson as DestinationDirectory);
  const counts = input.countryCounts ?? {};
  const hasCounts = Object.keys(counts).length > 0;
  const countries = directory.countries.filter((country) => !hasCounts || (counts[country] ?? 0) > 0);
  const allowed = new Set(countries);
  const entries = buildDestinationEntries({
    ...directory,
    countries,
    areas: directory.areas.filter((area) => allowed.has(area.c)),
    places: directory.places.filter((place) => allowed.has(place.c)),
    both: directory.both.filter((entry) => allowed.has(entry.c)),
  });
  return entries.map(suggestionFromEntry);
}

/** Index over the generated destination directory (offers-backed countries only). */
export function loadDestinationSearchIndex(
  countryCounts: Record<string, number>,
): DestinationSuggestion[] {
  return buildDestinationSearchIndex({ countryCounts });
}

function matchRank(normalizedLabel: string, query: string): number {
  if (normalizedLabel === query) {
    return 0;
  }
  if (normalizedLabel.startsWith(query)) {
    return 1;
  }
  const words = normalizedLabel.split(/[\s\-]+/);
  if (words.some((word) => word.startsWith(query))) {
    return 2;
  }
  if (normalizedLabel.includes(` ${query}`) || normalizedLabel.includes(`-${query}`)) {
    return 3;
  }
  return -1;
}

/**
 * Accent- and case-insensitive prefix match on the whole name or any word in it
 * ("tossa" -> Tossa de Mar, "kreta" -> Kreta, "span" -> Spanje). Best matches first, then
 * country before region before place, then alphabetical. Empty query -> no suggestions.
 */
export function searchDestinations(
  index: DestinationSuggestion[],
  query: string,
  limit: number = MAX_DESTINATION_SUGGESTIONS,
): DestinationSuggestion[] {
  const normalizedQuery = normalizeForMatch(query).replace(/\s+/g, ' ');
  if (!normalizedQuery) {
    return [];
  }

  const hits: Array<{ suggestion: DestinationSuggestion; rank: number }> = [];
  for (const suggestion of index) {
    let rank = matchRank(suggestion.normalized, normalizedQuery);
    if (rank < 0 && normalizedQuery.includes(' ') && suggestion.normalizedFull !== suggestion.normalized) {
      const full = matchRank(suggestion.normalizedFull, normalizedQuery);
      rank = full >= 0 ? Math.max(full, 1) : -1;
    }
    if (rank >= 0) {
      hits.push({ suggestion, rank });
    }
  }

  hits.sort(
    (left, right) =>
      left.rank - right.rank ||
      KIND_RANK[left.suggestion.kind] - KIND_RANK[right.suggestion.kind] ||
      left.suggestion.label.localeCompare(right.suggestion.label, 'nl'),
  );

  return hits.slice(0, limit).map((hit) => hit.suggestion);
}

/**
 * Area/place pick -> one single selection with its parent country; a country returns null.
 * Area -> country+region; place -> country+city (+ region only for homonym places).
 */
export function placeSelectionFromSuggestion(
  suggestion: DestinationSuggestion,
): DestinationPlaceSelection | null {
  if (suggestion.kind === 'region') {
    return { country: suggestion.country, region: suggestion.value };
  }
  if (suggestion.kind === 'city') {
    return {
      country: suggestion.country,
      ...(suggestion.region ? { region: suggestion.region } : {}),
      city: suggestion.value,
    };
  }
  return null;
}

export function formatPlaceSelectionLabel(place: DestinationPlaceSelection): string {
  return decodeDestinationLabel(place.city ?? place.region ?? place.country);
}

/** Shared state -> popup place (only meaningful with exactly one country). */
export function placeSelectionFromState(
  countries: string[],
  region?: string | null,
  city?: string | null,
): DestinationPlaceSelection | null {
  const country = countries.length === 1 ? countries[0] : undefined;
  if (!country) {
    return null;
  }
  const cleanRegion = region?.trim() || undefined;
  const cleanCity = city?.trim() || undefined;
  if (!cleanRegion && !cleanCity) {
    return null;
  }
  return {
    country,
    ...(cleanRegion ? { region: cleanRegion } : {}),
    ...(cleanCity ? { city: cleanCity } : {}),
  };
}
