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
 * only where the same name is more than one destination ("Alanya \u2014 stad" / "Alanya \u2014 regio",
 * "Kalamaki \u2014 Kreta" / "Kalamaki \u2014 Zakynthos"). Label rule (owner, t334u): the name the user
 * searches on is ALWAYS first, the context ALWAYS last and only when needed - never "Regio - Plaats".
 * The URL keeps the existing contract
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
  /** True for the place of a name that is also a region ("Alanya \u2014 stad" next to "Alanya \u2014 regio"). */
  regionTwin?: boolean;
  /** Lower-case, accent-free parent of a provider composite name ("chania", "kassandra"): last-resort match only. */
  normalizedParent?: string;
};

export const MAX_DESTINATION_SUGGESTIONS = 8;

export const DESTINATION_SEARCH_PLACEHOLDER = 'Zoek land, regio of plaats';

/**
 * Tie-break on EQUAL match quality: country first, then the place of a name that is also a region
 * ("Alanya \u2014 stad" before "Alanya \u2014 regio", product decision t330u), then the other regions, then
 * the other places. This is NOT a global place-before-region rule (that would push Santorini ("san"),
 * Porto ("port") and Costa Blanca/Del Sol ("costa") out of the 8 suggestions for 59 terms): the only
 * exception is the same-name pair. Match quality is compared first: an exact region (Kreta, Mallorca,
 * Kos) stays above a prefix place.
 */
function tieRank(suggestion: DestinationSuggestion): number {
  if (suggestion.kind === 'country') return 0;
  if (suggestion.kind === 'city' && suggestion.regionTwin) return 1;
  return suggestion.kind === 'region' ? 2 : 3;
}

/** Name part of a label ("Kalamaki" for "Kalamaki \u2014 Kreta"): group order is alphabetical on the name. */
function labelName(suggestion: DestinationSuggestion): string {
  return suggestion.label.split(' \u2014 ')[0] ?? suggestion.label;
}

/** Match tier for a hit through the parent of a provider composite name (below every name match). */
const PARENT_MATCH_RANK = 4;

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
    ...(entry.kind === 'city' && entry.suffix === 'stad' ? { regionTwin: true } : {}),
    ...(entry.parent ? { normalizedParent: normalizeForMatch(entry.parent) } : {}),
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
 * ("tossa" -> Tossa de Mar, "kreta" -> Kreta, "span" -> Spanje). Best matches first, then (equal
 * quality) country, region-twin place, region, place, then alphabetical. A place is also found through the parent of its
 * provider composite name (query "kassandra" -> Afitos, ...), after every name match. Empty query -> no suggestions.
 *
 * The limit is only a UI limit, not a "top 8 destinations" rule (t334u): all destinations that share one
 * primary name (Agia Paraskevi \u2014 Samos / \u2014 Santorini, Kalamaki x4, Alanya \u2014 stad / \u2014 regio) are
 * one group. Equal-quality groups are ordered as a unit (so the same-name pair stays adjacent), and a
 * group that straddles the limit is completed (at most the group size, 4 on the real directory) - so a
 * disambiguation is never half visible. Match quality stays the primary key.
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
    if (rank < 0 && suggestion.normalizedParent && matchRank(suggestion.normalizedParent, normalizedQuery) >= 0) {
      rank = PARENT_MATCH_RANK;
    }
    if (rank >= 0) {
      hits.push({ suggestion, rank });
    }
  }

  // Group = same primary name within one match tier; the group sorts by its best member.
  const groupKey = (hit: { suggestion: DestinationSuggestion; rank: number }) =>
    `${hit.rank}|${hit.suggestion.normalized}`;
  const groupTier = new Map<string, number>();
  for (const hit of hits) {
    const key = groupKey(hit);
    groupTier.set(key, Math.min(groupTier.get(key) ?? 99, tieRank(hit.suggestion)));
  }

  hits.sort(
    (left, right) =>
      left.rank - right.rank ||
      groupTier.get(groupKey(left))! - groupTier.get(groupKey(right))! ||
      labelName(left.suggestion).localeCompare(labelName(right.suggestion), 'nl') ||
      groupKey(left).localeCompare(groupKey(right)) ||
      tieRank(left.suggestion) - tieRank(right.suggestion) ||
      left.suggestion.label.localeCompare(right.suggestion.label, 'nl'),
  );

  let end = Math.min(Math.max(0, limit), hits.length);
  if (end > 0) {
    const lastKey = groupKey(hits[end - 1]!);
    while (end < hits.length && groupKey(hits[end]!) === lastKey) {
      end += 1;
    }
  }
  return hits.slice(0, end).map((hit) => hit.suggestion);
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

let labelLookup: Map<string, string> | null = null;

function labelLookupMap(): Map<string, string> {
  if (!labelLookup) {
    labelLookup = new Map();
    for (const entry of buildDestinationEntries(directoryJson as DestinationDirectory)) {
      const label = entryLabel(entry);
      if (entry.kind === 'city') {
        labelLookup.set(`c|${entry.country}|${entry.city ?? ''}|${entry.region ?? ''}`, label);
      } else if (entry.kind === 'region') {
        labelLookup.set(`r|${entry.country}|${entry.region ?? ''}`, label);
      }
    }
  }
  return labelLookup;
}

/**
 * Display label (name first, context last) of a stored selection (country + region / city URL values):
 * the same label the popup shows, e.g. city "Chania - Kalamaki" -> "Kalamaki \u2014 Chania", city Agia Paraskevi
 * + region Samos -> "Agia Paraskevi \u2014 Samos", region Alanya -> "Alanya \u2014 regio". Falls back to the
 * decoded value (nothing is hidden or invented). The URL values themselves never change.
 */
export function destinationDisplayLabel(
  country: string | undefined,
  value: { region?: string | null; city?: string | null },
): string | undefined {
  if (!country) {
    return undefined;
  }
  const map = labelLookupMap();
  const city = value.city?.trim();
  const region = value.region?.trim();
  if (city) {
    return map.get(`c|${country}|${city}|${region ?? ''}`) ?? map.get(`c|${country}|${city}|`);
  }
  if (region) {
    return map.get(`r|${country}|${region}`);
  }
  return undefined;
}

export function formatPlaceSelectionLabel(place: DestinationPlaceSelection): string {
  return (
    destinationDisplayLabel(place.country, place) ??
    decodeDestinationLabel(place.city ?? place.region ?? place.country)
  );
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
