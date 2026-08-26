import type { TravelOffer } from '@/types/travel';
import { offerMatchesAnyKeyword, offerSearchText } from '@/lib/search/offer-text';

/** Beach location buckets — multi-select (OR). */
export const BEACH_LOCATION_VALUES = [
  'direct',
  'lt150',
  'lt500',
  'lt1000',
  'lt3000',
  'gt3000',
] as const;
export type BeachLocation = (typeof BEACH_LOCATION_VALUES)[number];

export const BEACH_LOCATION_LABELS: Record<BeachLocation, string> = {
  direct: 'Aan het strand',
  lt150: '<150 m',
  lt500: '<500 m',
  lt1000: '<1 km',
  lt3000: '<3 km',
  gt3000: '>3 km',
};

const BEACH_DIRECT_KEYWORDS = [
  'direct aan het strand',
  'direct aan strand',
  'aan het strand',
  'direct aan zee',
  'beachfront',
  'beach front',
  'zo op het strand',
  'vrijwel aan het strand',
];

/** Center location buckets — multi-select (OR). */
export const CENTER_LOCATION_VALUES = [
  'in',
  'lt250',
  'lt500',
  'lt1000',
  'lt3000',
  'gt3000',
] as const;
export type CenterLocation = (typeof CENTER_LOCATION_VALUES)[number];

export const CENTER_LOCATION_LABELS: Record<CenterLocation, string> = {
  in: 'In centrum',
  lt250: '<250 m',
  lt500: '<500 m',
  lt1000: '<1 km',
  lt3000: '<3 km',
  gt3000: '>3 km',
};

const CENTER_IN_KEYWORDS = ['in het centrum', 'midden in het centrum', 'in centrum'];

/** Legacy URL values mapped to the current taxonomy. */
const LEGACY_BEACH_ALIASES: Record<string, BeachLocation> = {
  walk: 'lt1000',
  lt100: 'lt150',
  lt250: 'lt500',
  ge1000: 'gt3000',
};

const LEGACY_CENTER_ALIASES: Record<string, CenterLocation> = {
  near: 'lt1000',
  lt100: 'lt250',
  ge1000: 'gt3000',
};

function parseMeterToken(raw: string): number | undefined {
  const normalized = raw.replace(/\./g, '').replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0 || value > 50000) {
    return undefined;
  }
  return value;
}

function toMeters(value: number, unit: string): number {
  const normalized = unit.toLowerCase();
  if (normalized.startsWith('km') || normalized.startsWith('kilometer') || normalized.startsWith('kilometre')) {
    return Math.round(value * 1000);
  }
  return value;
}

/** Extract distances in meters that appear near the given terms in offer text. */
function extractDistancesNearTerms(text: string, terms: string[]): number[] {
  const lower = text.toLowerCase();
  const distances: number[] = [];

  for (const term of terms) {
    const termIndex = lower.indexOf(term);
    if (termIndex === -1) {
      continue;
    }

    const windowStart = Math.max(0, termIndex - 50);
    const windowEnd = Math.min(lower.length, termIndex + term.length + 50);
    const window = lower.slice(windowStart, windowEnd);

    const meterPattern = /(\d+(?:[.,]\d+)?)\s*(?:m|meter|meters|metres|mtr)\b/gi;
    let match: RegExpExecArray | null;
    while ((match = meterPattern.exec(window))) {
      const meters = parseMeterToken(match[1]);
      if (meters !== undefined) {
        distances.push(meters);
      }
    }

    const kmPattern = /(\d+(?:[.,]\d+)?)\s*(?:km|kilometer|kilometers|kilometre|kilometres)\b/gi;
    while ((match = kmPattern.exec(window))) {
      const km = parseMeterToken(match[1]);
      if (km !== undefined) {
        distances.push(Math.round(km * 1000));
      }
    }
  }

  return distances;
}

/**
 * Extract beach distances only from phrases that explicitly link a distance
 * to the beach. Nearby amenity distances ("winkel op circa 100 meter" next to
 * "aan het strand") must not become beach distance.
 */
export function extractBeachDistanceMeters(offer: TravelOffer): number | undefined {
  const text = offerSearchText(offer);
  if (!text) {
    return undefined;
  }

  const distances: number[] = [];

  // "openbaar strand op circa 250 meter" / "openbaar strand tsilivi beach op circa 300 meter"
  // Do not cross amenity clauses ("...strand * winkel op circa 100 meter").
  const afterBeach =
    /(?:strand|beach)((?:\s+[a-z0-9][\w'&-]*){0,8})\s+op\s+(?:circa|ca\.?|ongeveer)?\s*(\d+(?:[.,]\d+)?)\s*(km|kilometer|kilometers|kilometre|kilometres|meter|meters|metres|mtr|m)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = afterBeach.exec(text))) {
    const bridge = match[1] ?? '';
    if (/(?:winkel|restaurant|bar|centrum|shop|dichtstbijzijnde)/i.test(bridge)) {
      continue;
    }
    const raw = parseMeterToken(match[2]);
    if (raw === undefined) {
      continue;
    }
    const unit = match[3];
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 2);
    if (/^m$/i.test(unit) && /^[²2]/.test(after.trimStart())) {
      continue;
    }
    distances.push(toMeters(raw, unit));
  }

  // "circa 100 meter van het strand"
  const beforeBeach =
    /(\d+(?:[.,]\d+)?)\s*(km|kilometer|kilometers|kilometre|kilometres|meter|meters|metres|mtr|m)\s*(?:van|vanaf|tot|naar)\s+(?:het\s+|de\s+|een\s+)?(?:strand|beach)\b/gi;
  while ((match = beforeBeach.exec(text))) {
    const raw = parseMeterToken(match[1]);
    if (raw === undefined) {
      continue;
    }
    const unit = match[2];
    const after = text.slice(match.index + match[0].length, match.index + match[0].length + 2);
    if (/^m$/i.test(unit) && /^[²2]/.test(after.trimStart())) {
      continue;
    }
    distances.push(toMeters(raw, unit));
  }

  if (distances.length === 0) {
    return undefined;
  }
  return Math.min(...distances);
}

export function extractCenterDistanceMeters(offer: TravelOffer): number | undefined {
  const text = offerSearchText(offer);
  const distances = extractDistancesNearTerms(text, [
    'centrum',
    'city centre',
    'city center',
    'center',
    'centre',
  ]);
  if (distances.length === 0) {
    return undefined;
  }
  return Math.min(...distances);
}

function matchesBeachDistanceBucket(
  meters: number | undefined,
  value: Exclude<BeachLocation, 'direct'>,
): boolean {
  if (meters === undefined) {
    return false;
  }
  switch (value) {
    case 'lt150':
      return meters < 150;
    case 'lt500':
      return meters < 500;
    case 'lt1000':
      return meters < 1000;
    case 'lt3000':
      return meters < 3000;
    case 'gt3000':
      return meters > 3000;
    default:
      return false;
  }
}

function matchesCenterDistanceBucket(
  meters: number | undefined,
  value: Exclude<CenterLocation, 'in'>,
): boolean {
  if (meters === undefined) {
    return false;
  }
  switch (value) {
    case 'lt250':
      return meters < 250;
    case 'lt500':
      return meters < 500;
    case 'lt1000':
      return meters < 1000;
    case 'lt3000':
      return meters < 3000;
    case 'gt3000':
      return meters > 3000;
    default:
      return false;
  }
}

export function offerMatchesBeachLocation(offer: TravelOffer, value: BeachLocation): boolean {
  if (value === 'direct') {
    return offerMatchesAnyKeyword(offerSearchText(offer), BEACH_DIRECT_KEYWORDS);
  }
  return matchesBeachDistanceBucket(extractBeachDistanceMeters(offer), value);
}

export function offerMatchesCenterLocation(offer: TravelOffer, value: CenterLocation): boolean {
  if (value === 'in') {
    return offerMatchesAnyKeyword(offerSearchText(offer), CENTER_IN_KEYWORDS);
  }
  return matchesCenterDistanceBucket(extractCenterDistanceMeters(offer), value);
}

/** OR across selected beach location values. */
export function offerMatchesAnyBeachLocation(offer: TravelOffer, values: BeachLocation[]): boolean {
  if (values.length === 0) {
    return true;
  }
  return values.some((value) => offerMatchesBeachLocation(offer, value));
}

/** OR across selected center location values. */
export function offerMatchesAnyCenterLocation(offer: TravelOffer, values: CenterLocation[]): boolean {
  if (values.length === 0) {
    return true;
  }
  return values.some((value) => offerMatchesCenterLocation(offer, value));
}

function resolveBeachValue(raw: string): BeachLocation | undefined {
  const trimmed = raw.trim().toLowerCase();
  if ((BEACH_LOCATION_VALUES as readonly string[]).includes(trimmed)) {
    return trimmed as BeachLocation;
  }
  return LEGACY_BEACH_ALIASES[trimmed];
}

function resolveCenterValue(raw: string): CenterLocation | undefined {
  const trimmed = raw.trim().toLowerCase();
  if ((CENTER_LOCATION_VALUES as readonly string[]).includes(trimmed)) {
    return trimmed as CenterLocation;
  }
  return LEGACY_CENTER_ALIASES[trimmed];
}

export function parseBeachLocationsParam(value: string | null | undefined): BeachLocation[] {
  if (!value) {
    return [];
  }
  const selected = new Set<BeachLocation>();
  for (const part of value.split(',')) {
    const match = resolveBeachValue(part);
    if (match) {
      selected.add(match);
    }
  }
  return BEACH_LOCATION_VALUES.filter((item) => selected.has(item));
}

export function parseCenterLocationsParam(value: string | null | undefined): CenterLocation[] {
  if (!value) {
    return [];
  }
  const selected = new Set<CenterLocation>();
  for (const part of value.split(',')) {
    const match = resolveCenterValue(part);
    if (match) {
      selected.add(match);
    }
  }
  return CENTER_LOCATION_VALUES.filter((item) => selected.has(item));
}

/** @deprecated Prefer parseBeachLocationsParam */
export function parseBeachLocationParam(value: string | null | undefined): BeachLocation | undefined {
  return parseBeachLocationsParam(value)[0];
}

/** @deprecated Prefer parseCenterLocationsParam */
export function parseCenterLocationParam(value: string | null | undefined): CenterLocation | undefined {
  return parseCenterLocationsParam(value)[0];
}

export function serializeBeachLocationsParam(values: BeachLocation[] | undefined): string | undefined {
  if (!values?.length) {
    return undefined;
  }
  const normalized = parseBeachLocationsParam(values.join(','));
  return normalized.length > 0 ? normalized.join(',') : undefined;
}

export function serializeCenterLocationsParam(values: CenterLocation[] | undefined): string | undefined {
  if (!values?.length) {
    return undefined;
  }
  const normalized = parseCenterLocationsParam(values.join(','));
  return normalized.length > 0 ? normalized.join(',') : undefined;
}
