import { decodeHtmlEntities } from '@/lib/feeds/canonical/decode-html-entities';
import directoryJson from '@/data/destination-directory.json';
import { canonicalizeRegionName } from '@/lib/offers/canonical-region';
import type { TravelOffer } from '@/types/travel';

/**
 * M1 / U2 destination mapping (Search Architecture, 2026-10-02).
 *
 * The user searches a VacationWeb DESTINATION, not a provider field. The URL keeps the existing
 * contract (country / single region / single city); the meaning of `region` and `city` is resolved
 * here, at query time, over the unchanged catalog fields.
 *
 * Provider independence (Provider Protocol, geo-mapping rule): the meaning of destinationRegion,
 * destinationProvince and destinationCity is NOT a provider-independent taxonomy. One feed puts a
 * collective area in `region` and the island in `province`, another feed the reverse, a third fills
 * only one of the two. The rule below therefore never looks at the provider: an offer belongs to a
 * region/area destination when the (canonical) area label is carried by REGION OR PROVINCE.
 * Nothing in this file may branch on `provider` / `sourceProvider`.
 */

/**
 * Collective destinations that are real destinations AND contain separate island destinations.
 * `Balearen` returns every offer of its islands, an island returns only that island (child -> child
 * only; parent -> parent label + all children). Only children that exist in the catalog are listed
 * (no dead entries); a guard test compares this table against the catalog.
 */
export const DESTINATION_PARENTS: Readonly<Record<string, readonly string[]>> = {
  Balearen: ['Mallorca', 'Menorca', 'Ibiza'],
  'Canarische Eilanden': ['Tenerife', 'Gran Canaria', 'Lanzarote', 'Fuerteventura', 'La Palma'],
};

/**
 * Category 2 (proven provider spelling/language variants of ONE place that are not mechanical):
 * variant -> VacationWeb name. Every key and value occurs in the catalog (guard test).
 * Mechanical variants (accent, HTML entity, case, hyphen, apostrophe, trailing period) need no entry.
 */
export const PLACE_ALIASES: Readonly<Record<string, string>> = {
  Lisbonne: 'Lissabon',
  'Kos Town': 'Kos-Stad',
  'Karpathos Town': 'Karpathos-Stad',
  'Hurghada-Ville': 'Hurghada-Stad',
  Portopetro: 'Porto Petro',
  Makrigialos: 'Makri Gialos',
};

/**
 * Provider-specific composite place names: a feed writes "<parent> - <place>" ("Chania - Agia Marina",
 * "Ierapetra - Koutsounari") or "<place> - <parent>" ("Afitos - Kassandra") into the city field.
 * Which side is the place is NOT guessable from the string: the directory build decides it from the
 * catalog (the side repeated by several composites is the parent) and stores the result in the generated
 * directory (`composites`: composite value -> place). Applied here, provider independent.
 */
export function splitCompositePlace(
  value: string | undefined | null,
): { head: string; tail: string } | null {
  const parts = decodeHtmlEntities(value ?? '')
    .split(/\s+-\s+/)
    .map((part) => part.trim());
  return parts.length === 2 && parts[0] && parts[1] ? { head: parts[0], tail: parts[1] } : null;
}

let compositePlaceByKey: Map<string, string> | null = null;

/** Place a provider composite value resolves to (generated directory), or undefined. */
function compositePlaceName(value: string): string | undefined {
  if (!compositePlaceByKey) {
    const composites = (directoryJson as { composites?: Array<{ n: string; p: string }> }).composites ?? [];
    compositePlaceByKey = new Map(composites.map((entry) => [normalizePlaceText(entry.n), entry.p]));
  }
  return compositePlaceByKey.get(normalizePlaceText(value));
}

/** Mechanical normal form of a place name: entity, accent, case, apostrophe, hyphen, period, spaces. */
export function normalizePlaceText(value: string): string {
  return decodeHtmlEntities(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['\u2019`\u00b4]/g, '')
    .replace(/[-\u2013\u2014]/g, ' ')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Spelling-group key without the generated composite table (pure: used by the directory build, so the
 * generated JSON never depends on its own previous version).
 */
export function basePlaceGroupKey(value: string | undefined | null): string {
  const text = decodeHtmlEntities(value ?? '').trim();
  if (!text) {
    return '';
  }
  return normalizePlaceText(PLACE_ALIASES[text] ?? text);
}

/**
 * Spelling-group key of a place: provider composite -> its place, explicit pair, then the mechanical
 * normal form. "Chania - Agia Marina" and "Agia Marina" are one place group.
 */
export function placeGroupKey(value: string | undefined | null): string {
  const text = decodeHtmlEntities(value ?? '').trim();
  if (!text) {
    return '';
  }
  return basePlaceGroupKey(compositePlaceName(text) ?? text);
}

/** Decoded, trimmed catalog place name (for display; the URL may carry any spelling of the group). */
export function decodePlaceName(value: string): string {
  return decodeHtmlEntities(value).trim();
}

function spellingScore(name: string): number {
  let score = 0;
  if (/[\u00c0-\u024f]/.test(name)) score += 4; // proper diacritics
  if (!/\.$/.test(name)) score += 2; // no stray trailing period
  if (/\S-\S/.test(name)) score += 1; // compact hyphen ("Lefkas-Stad")
  if (name.split(/\s+/).every((word) => /^[\p{Lu}\d(]/u.test(word) || word.length <= 2)) score += 1;
  return score;
}

/**
 * VacationWeb name of a spelling group: explicit alias target, display override, or the best variant
 * by spelling quality (never by offer count). Deterministic: ties break by plain code-unit order.
 */
export function pickPlaceDisplayName(variants: readonly string[]): string {
  return chooseDisplayName([
    ...new Set(variants.map((variant) => compositePlaceName(variant) ?? decodePlaceName(variant)).filter(Boolean)),
  ]);
}

/** Same choice without the generated composite table (directory build). */
export function pickBasePlaceDisplayName(variants: readonly string[]): string {
  return chooseDisplayName([...new Set(variants.map(decodePlaceName).filter(Boolean))]);
}

function chooseDisplayName(decoded: string[]): string {
  if (decoded.length === 0) {
    return '';
  }
  const aliasTarget = decoded.map((name) => PLACE_ALIASES[name]).find(Boolean);
  if (aliasTarget) {
    return aliasTarget;
  }
  return [...decoded].sort((left, right) => {
    const diff = spellingScore(right) - spellingScore(left);
    if (diff !== 0) return diff;
    return left < right ? -1 : left > right ? 1 : 0;
  })[0];
}

/** Canonical label list of a region/province pair (R-or-P rule; provider independent). */
export function offerAreaLabels(
  region: string | undefined | null,
  province: string | undefined | null,
): string[] {
  const labels: string[] = [];
  const canonicalRegion = canonicalizeRegionName(region ?? undefined);
  const canonicalProvince = canonicalizeRegionName(province ?? undefined);
  if (canonicalRegion) labels.push(canonicalRegion);
  if (canonicalProvince && canonicalProvince !== canonicalRegion) labels.push(canonicalProvince);
  return labels;
}

/** Area labels that satisfy a requested region: the label itself + (for a collective area) its children. */
export function expandAreaLabels(region: string): Set<string> {
  const target = canonicalizeRegionName(region);
  return new Set([target, ...(DESTINATION_PARENTS[target] ?? [])]);
}

export type OfferDestinationFields = Pick<
  TravelOffer,
  'destinationRegion' | 'destinationProvince' | 'destinationCity'
>;

let knownAreaLabels: Set<string> | null = null;

/**
 * Areas the mapping knows: the generated destination directory (data/destination-directory.json,
 * built from the catalog) plus the collective areas. A region value that is not known keeps the old
 * exact destinationRegion behaviour, so a new feed value is never guessed.
 */
function isKnownArea(canonicalRegion: string): boolean {
  if (!knownAreaLabels) {
    knownAreaLabels = new Set([
      ...Object.keys(DESTINATION_PARENTS),
      ...(directoryJson as { areas: Array<{ n: string }> }).areas.map((area) => area.n),
    ]);
  }
  return knownAreaLabels.has(canonicalRegion);
}

/**
 * region=X -> true when the offer's region OR province is X (or a child of collective X).
 * Unknown X -> old exact behaviour (destinationRegion equals X after canonicalisation).
 */
export function createRegionMatcher(region: string): (offer: OfferDestinationFields) => boolean {
  const target = canonicalizeRegionName(region);
  if (!isKnownArea(target)) {
    return (offer) => canonicalizeRegionName(offer.destinationRegion) === target;
  }
  const labels = expandAreaLabels(region);
  return (offer) =>
    labels.has(canonicalizeRegionName(offer.destinationRegion)) ||
    labels.has(canonicalizeRegionName(offer.destinationProvince));
}

const OFFER_PLACE_KEY_CACHE = new Map<string, string>();

function offerPlaceKey(raw: string): string {
  let key = OFFER_PLACE_KEY_CACHE.get(raw);
  if (key === undefined) {
    key = placeGroupKey(raw);
    if (OFFER_PLACE_KEY_CACHE.size < 20000) {
      OFFER_PLACE_KEY_CACHE.set(raw, key);
    }
  }
  return key;
}

/** city=Y -> true when the offer's place is in the same spelling group as Y. */
export function createCityMatcher(city: string): (offer: OfferDestinationFields) => boolean {
  const wanted = placeGroupKey(city);
  return (offer) => {
    const raw = offer.destinationCity;
    if (!raw) {
      return false;
    }
    if (raw === city) {
      return true;
    }
    return wanted !== '' && offerPlaceKey(raw) === wanted;
  };
}
