import type { SearchParams } from '@/types/travel';

export const RESULTS_PAGE_DEFAULT = 1;
export const RESULTS_PAGE_SIZE_DEFAULT = 24;
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

  if (params.country) {
    query.set('country', params.country);
  }

  if (params.region) {
    query.set('region', params.region);
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

  if (params.adults !== undefined && !Number.isNaN(params.adults)) {
    query.set('adults', String(params.adults));
  }

  if (params.children !== undefined && !Number.isNaN(params.children)) {
    query.set('children', String(params.children));
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

  if (params.departureAirport) {
    query.set('departureAirport', params.departureAirport);
  }

  if (params.stars !== undefined && !Number.isNaN(params.stars) && params.stars > 0) {
    query.set('stars', String(params.stars));
  }

  if (params.sort) {
    query.set('sort', params.sort);
  }

  query.set('page', String(page));
  query.set('pageSize', String(params.pageSize ?? RESULTS_PAGE_SIZE_DEFAULT));

  return `/results?${query.toString()}`;
}
