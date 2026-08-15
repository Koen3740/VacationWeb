import type { SearchParams } from '@/types/travel';

export const RESULTS_PAGE_DEFAULT = 1;
/** Product page size (Master Plan §8.1a: page 1 = 10). Former technical default 24 is not product. */
export const RESULTS_PAGE_SIZE_DEFAULT = 10;
export const RESULTS_PAGE_SIZE_MIN = 1;
export const RESULTS_PAGE_SIZE_MAX = 100;

function parsePositiveInteger(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < min) {
    return fallback;
  }

  return Math.min(parsed, max);
}

export function parseResultsPageParam(raw: string | undefined): number {
  return parsePositiveInteger(raw, RESULTS_PAGE_DEFAULT, 1, Number.MAX_SAFE_INTEGER);
}

export function parseResultsPageSizeParam(raw: string | undefined): number {
  return parsePositiveInteger(
    raw,
    RESULTS_PAGE_SIZE_DEFAULT,
    RESULTS_PAGE_SIZE_MIN,
    RESULTS_PAGE_SIZE_MAX,
  );
}

export function paginateResults<T>(items: T[], page: number, pageSize: number): T[] {
  const startIndex = (page - 1) * pageSize;

  if (startIndex >= items.length || pageSize <= 0) {
    return [];
  }

  return items.slice(startIndex, startIndex + pageSize);
}

export function getResultsTotalPages(totalResults: number, pageSize: number): number {
  if (totalResults <= 0) {
    return 1;
  }

  return Math.ceil(totalResults / pageSize);
}

export function buildResultsPageHref(params: SearchParams, page: number): string {
  const query = new URLSearchParams();

  if (params.countries?.length) {
    query.set('country', params.countries.join(','));
  } else if (params.country) {
    query.set('country', params.country);
  }

  if (params.region) {
    query.set('region', params.region);
  }

  if (params.city) {
    query.set('city', params.city);
  }

  if (params.budgetMin !== undefined && !Number.isNaN(params.budgetMin)) {
    query.set('budgetMin', String(params.budgetMin));
  }

  if (params.budgetMax !== undefined && !Number.isNaN(params.budgetMax)) {
    query.set('budgetMax', String(params.budgetMax));
  }

  if (params.nightsMin !== undefined && !Number.isNaN(params.nightsMin)) {
    query.set('nightsMin', String(params.nightsMin));
  }

  if (params.nightsMax !== undefined && !Number.isNaN(params.nightsMax)) {
    query.set('nightsMax', String(params.nightsMax));
  }

  if (params.boardTypes?.length) {
    query.set('boardTypes', params.boardTypes.join(','));
  }

  if (params.accommodationTypes?.length) {
    query.set('accommodationTypes', params.accommodationTypes.join(','));
  }

  if (params.adults !== undefined && !Number.isNaN(params.adults)) {
    query.set('adults', String(params.adults));
  }

  if (params.children !== undefined && !Number.isNaN(params.children)) {
    query.set('children', String(params.children));
  }

  if (params.babies !== undefined && !Number.isNaN(params.babies)) {
    query.set('babies', String(params.babies));
  }

  if (params.rooms !== undefined && !Number.isNaN(params.rooms)) {
    query.set('rooms', String(params.rooms));
  }

  if (params.departureStart) {
    query.set('departureStart', params.departureStart);
  }

  if (params.departureEnd) {
    query.set('departureEnd', params.departureEnd);
  }

  if (params.flexibilityDays !== undefined && !Number.isNaN(params.flexibilityDays) && params.flexibilityDays > 0) {
    query.set('flexibilityDays', String(params.flexibilityDays));
  }

  if (params.departureAirport) {
    query.set('departureAirport', params.departureAirport);
  }

  if (params.stars?.length) {
    query.set('stars', params.stars.join(','));
  }

  if (params.vacationTypes?.length) {
    query.set('vacationTypes', params.vacationTypes.join(','));
  }

  if (params.beachLocation?.length) {
    query.set('beachLocation', params.beachLocation.join(','));
  }

  if (params.centerLocation?.length) {
    query.set('centerLocation', params.centerLocation.join(','));
  }

  if (params.amenities?.length) {
    query.set('amenities', params.amenities.join(','));
  }

  if (params.sort) {
    query.set('sort', params.sort);
  }

  if (params.page1Ids?.length) {
    query.set('page1Ids', params.page1Ids.join(','));
  }

  query.set('page', String(page));
  query.set('pageSize', String(params.pageSize ?? RESULTS_PAGE_SIZE_DEFAULT));

  return `/results?${query.toString()}`;
}

/** Parse definitive page-1 offer IDs carried for page 2+ remaining (no Receipt). */
export function parsePage1IdsParam(raw: string | undefined): string[] | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return undefined;
  }

  const ids = raw
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  return ids.length > 0 ? ids : undefined;
}
