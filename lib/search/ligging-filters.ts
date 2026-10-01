/**
 * Ligging filters (SUB 27): Kust, Stedelijke omgeving, Landelijke omgeving,
 * Afstand tot centrum, Afstand tot strand.
 *
 * All five read structured catalog fields (absent = unknown). Nothing here reads
 * offer text; the legacy text filters stay in `location-filters.ts`
 * (`beachLocation` / `centerLocation`, unchanged).
 *
 * Semantics (same as the existing filters): AND between active filters, OR within
 * one distance filter, unknown value => the offer drops out while the filter is active.
 */
import type { TravelOffer } from '@/types/travel';

/** Kust = coast distance (OSM coastline) <= 1 000 m (SUB 27 "work" rule). */
export const COAST_MAX_DISTANCE_M = 1000;

/** GHS-SMOD classes: Stad = 30/23/22, Landelijk = 13/12/11. Class 21 and 10 are neither. */
export const URBAN_SETTING_CLASSES: readonly number[] = [30, 23, 22];
export const RURAL_SETTING_CLASSES: readonly number[] = [13, 12, 11];

export const COAST_FILTER_LABEL = 'Kust';
export const URBAN_FILTER_LABEL = 'Stedelijke omgeving';
export const RURAL_FILTER_LABEL = 'Landelijke omgeving';
export const CENTER_DISTANCE_FILTER_LABEL = 'Afstand tot centrum';
export const BEACH_DISTANCE_FILTER_LABEL = 'Afstand tot strand';

export const COAST_PARAM = 'coast';
export const URBAN_PARAM = 'urban';
export const RURAL_PARAM = 'rural';
export const CENTER_DISTANCE_PARAM = 'centerDistance';
export const BEACH_DISTANCE_PARAM = 'beachDistance';

export const LIGGING_PARAMS = [
  COAST_PARAM,
  URBAN_PARAM,
  RURAL_PARAM,
  CENTER_DISTANCE_PARAM,
  BEACH_DISTANCE_PARAM,
] as const;

/** Provider buckets: In het centrum, <100 m, <250 m, <500 m, <1 km, >=1 km. */
export const CENTER_DISTANCE_VALUES = ['in', 'lt100', 'lt250', 'lt500', 'lt1000', 'ge1000'] as const;
export type CenterDistance = (typeof CENTER_DISTANCE_VALUES)[number];

export const CENTER_DISTANCE_LABELS: Record<CenterDistance, string> = {
  in: 'In het centrum',
  lt100: '<100 m',
  lt250: '<250 m',
  lt500: '<500 m',
  lt1000: '<1 km',
  ge1000: '≥1 km',
};

/** Provider buckets: Direct aan het strand (separate value), <100 m, <250 m, <500 m, <1 km, >=1 km. */
export const BEACH_DISTANCE_VALUES = ['direct', 'lt100', 'lt250', 'lt500', 'lt1000', 'ge1000'] as const;
export type BeachDistance = (typeof BEACH_DISTANCE_VALUES)[number];

export const BEACH_DISTANCE_LABELS: Record<BeachDistance, string> = {
  direct: 'Direct aan het strand',
  lt100: '<100 m',
  lt250: '<250 m',
  lt500: '<500 m',
  lt1000: '<1 km',
  ge1000: '≥1 km',
};

/**
 * "<N" buckets are cumulative and inclusive (provider `0-N`, so exactly 1 000 m is `lt1000`).
 * `ge1000` is disjoint from `lt1000`: strictly more than 1 000 m.
 */
const CEILING_M: Record<'lt100' | 'lt250' | 'lt500' | 'lt1000', number> = {
  lt100: 100,
  lt250: 250,
  lt500: 500,
  lt1000: 1000,
};
const FAR_ABOVE_M = 1000;

type SettingFields = Pick<TravelOffer, 'settingClass'>;
type CoastFields = Pick<TravelOffer, 'coastDistanceM'>;
type CenterFields = Pick<TravelOffer, 'centerDistanceM' | 'centerIsIn'>;
type BeachFields = Pick<TravelOffer, 'beachDistanceM' | 'beachDirect'>;

function isMeasure(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function offerIsCoast(offer: CoastFields): boolean {
  return isMeasure(offer.coastDistanceM) && offer.coastDistanceM <= COAST_MAX_DISTANCE_M;
}

export function offerIsUrban(offer: SettingFields): boolean {
  return typeof offer.settingClass === 'number' && URBAN_SETTING_CLASSES.includes(offer.settingClass);
}

export function offerIsRural(offer: SettingFields): boolean {
  return typeof offer.settingClass === 'number' && RURAL_SETTING_CLASSES.includes(offer.settingClass);
}

/** A hotel literally "in het centrum" has centre distance 0, whatever number the feed also lists. */
function effectiveCenterDistance(offer: CenterFields): number | undefined {
  if (offer.centerIsIn === true) {
    return 0;
  }
  return isMeasure(offer.centerDistanceM) ? offer.centerDistanceM : undefined;
}

export function offerMatchesCenterDistance(offer: CenterFields, value: CenterDistance): boolean {
  if (value === 'in') {
    return offer.centerIsIn === true;
  }
  const meters = effectiveCenterDistance(offer);
  if (meters === undefined) {
    return false;
  }
  if (value === 'ge1000') {
    return meters > FAR_ABOVE_M;
  }
  return meters <= CEILING_M[value];
}

/**
 * `direct` is its own value (offer.beachDirect) and is never treated as <=100 m.
 * Distance buckets read `beachDistanceM`, which is only set for offers with a stated
 * numeric distance.
 */
export function offerMatchesBeachDistance(offer: BeachFields, value: BeachDistance): boolean {
  if (value === 'direct') {
    return offer.beachDirect === true;
  }
  if (!isMeasure(offer.beachDistanceM)) {
    return false;
  }
  if (value === 'ge1000') {
    return offer.beachDistanceM > FAR_ABOVE_M;
  }
  return offer.beachDistanceM <= CEILING_M[value];
}

/** OR across the selected buckets; empty selection = no constraint. */
export function offerMatchesAnyCenterDistance(offer: CenterFields, values: CenterDistance[]): boolean {
  return values.length === 0 || values.some((value) => offerMatchesCenterDistance(offer, value));
}

export function offerMatchesAnyBeachDistance(offer: BeachFields, values: BeachDistance[]): boolean {
  return values.length === 0 || values.some((value) => offerMatchesBeachDistance(offer, value));
}

function parseTokens<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
): T[] {
  if (!value) {
    return [];
  }
  const selected = new Set<string>();
  for (const part of value.split(',')) {
    selected.add(part.trim().toLowerCase());
  }
  return allowed.filter((item) => selected.has(item.toLowerCase()));
}

export function parseCenterDistanceParam(value: string | null | undefined): CenterDistance[] {
  return parseTokens(value, CENTER_DISTANCE_VALUES);
}

export function parseBeachDistanceParam(value: string | null | undefined): BeachDistance[] {
  return parseTokens(value, BEACH_DISTANCE_VALUES);
}

export function serializeCenterDistanceParam(values: readonly string[] | undefined): string | undefined {
  const normalized = parseCenterDistanceParam(values?.join(','));
  return normalized.length > 0 ? normalized.join(',') : undefined;
}

export function serializeBeachDistanceParam(values: readonly string[] | undefined): string | undefined {
  const normalized = parseBeachDistanceParam(values?.join(','));
  return normalized.length > 0 ? normalized.join(',') : undefined;
}

/** URL toggle: only `=1` activates the filter; absent or any other value = off. */
export function parseLiggingToggleParam(raw: string | null | undefined): true | undefined {
  return raw === '1' ? true : undefined;
}

export function serializeLiggingToggleParam(value: boolean | undefined): string | undefined {
  return value === true ? '1' : undefined;
}

export type LiggingFilterParams = {
  coast?: boolean;
  urban?: boolean;
  rural?: boolean;
  centerDistance?: string[];
  beachDistance?: string[];
};

/** Full Ligging predicate used by `filterOffers`. AND across the five filters. */
export function offerMatchesLiggingFilters(offer: TravelOffer, params: LiggingFilterParams): boolean {
  if (params.coast === true && !offerIsCoast(offer)) {
    return false;
  }
  if (params.urban === true && !offerIsUrban(offer)) {
    return false;
  }
  if (params.rural === true && !offerIsRural(offer)) {
    return false;
  }
  if (params.centerDistance?.length) {
    const selected = parseCenterDistanceParam(params.centerDistance.join(','));
    if (selected.length > 0 && !offerMatchesAnyCenterDistance(offer, selected)) {
      return false;
    }
  }
  if (params.beachDistance?.length) {
    const selected = parseBeachDistanceParam(params.beachDistance.join(','));
    if (selected.length > 0 && !offerMatchesAnyBeachDistance(offer, selected)) {
      return false;
    }
  }
  return true;
}