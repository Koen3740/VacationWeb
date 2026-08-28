import type { SearchParams } from '@/types/travel';

export const RESULTS_PAGE_DEFAULT = 1;
/** Product page size (Master Plan §8.1a: page 1 = 10). Former technical default 24 is not product. */
export const RESULTS_PAGE_SIZE_DEFAULT = 10;
export const RESULTS_PAGE_SIZE_MIN = 1;
export const RESULTS_PAGE_SIZE_MAX = 100;
/**
 * Technical live-pricing / price-sort await window after filter+sort.
 * Never a user-browse, matchCount, or paginationTotal cap.
 */
export const RESULTS_LIVE_PRICING_CANDIDATE_CAP = 150;

/** Product limit for the user-facing Results result set after filter + rank. Not live-pricing. */
export const RESULTS_USER_RESULTSET_MAX = 1000;

/**
 * @deprecated Alias of {@link RESULTS_LIVE_PRICING_CANDIDATE_CAP}.
 * Not a user-resultset / browse limit.
 */
export const RESULTS_USER_PAGINATION_CAP = RESULTS_LIVE_PRICING_CANDIDATE_CAP;

/** True when the ranked matchset exceeds the product user-resultset limit. */
export function isResultsResultsetOverLimit(
  matchCount: number,
  max: number = RESULTS_USER_RESULTSET_MAX,
): boolean {
  return matchCount > max;
}

/**
 * First `cap` offers of an already-ranked matchset for live-pricing work only.
 * Never use this to shrink the user-facing result set, matchCount, or paginationTotal.
 */
export function limitLivePricingCandidatePool<T>(
  rankedOffers: readonly T[],
  cap: number = RESULTS_LIVE_PRICING_CANDIDATE_CAP,
): T[] {
  if (cap <= 0) {
    return [];
  }
  return rankedOffers.slice(0, cap);
}

/** @deprecated Use {@link limitLivePricingCandidatePool}. Live-pricing window only. */
export function limitRankedResultsForPagination<T>(
  rankedOffers: readonly T[],
  cap: number = RESULTS_LIVE_PRICING_CANDIDATE_CAP,
): T[] {
  return limitLivePricingCandidatePool(rankedOffers, cap);
}

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

export function buildResultsSearchQuery(params: SearchParams, page: number): URLSearchParams {
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

  if (params.nights?.length) {
    query.set('nights', params.nights.join(','));
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

  if (params.party && params.party.length > 0) {
    query.set('dob', params.party.map((traveller) => traveller.dateOfBirth ?? '').join(','));
    const maxRoomIndex = params.party.reduce(
      (highest, traveller) => Math.max(highest, traveller.roomIndex),
      0,
    );
    const roomCount = Math.max(params.rooms ?? 1, maxRoomIndex + 1);
    if (roomCount > 1) {
      if (!query.has('rooms')) {
        query.set('rooms', String(roomCount));
      }
      query.set('partyRooms', params.party.map((traveller) => String(traveller.roomIndex + 1)).join(','));
    }
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

  if (params.hasCarRental === true) {
    query.set('hasCarRental', '1');
  }

  if (params.sort && params.sort !== 'value') {
    query.set('sort', params.sort);
  }

  if (params.page1Ids?.length) {
    query.set('page1Ids', params.page1Ids.join(','));
  }

  query.set('page', String(page));
  query.set('pageSize', String(params.pageSize ?? RESULTS_PAGE_SIZE_DEFAULT));

  return query;
}

export function buildResultsPageHref(params: SearchParams, page: number): string {
  return `/results?${buildResultsSearchQuery(params, page).toString()}`;
}

/** Detail URL that keeps the Results search context (occupancy, dates, filters). */
export function buildOfferDetailHref(offerId: string, params: SearchParams): string {
  const page = params.page ?? RESULTS_PAGE_DEFAULT;
  const query = buildResultsSearchQuery(params, page);
  if (params.selectedRoom) {
    query.set('room', params.selectedRoom);
  }
  return `/offers/${encodeURIComponent(offerId)}?${query.toString()}`;
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
