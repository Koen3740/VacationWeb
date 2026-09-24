import type { SearchParams } from '@/types/travel';

export const RESULTS_PAGE_DEFAULT = 1;
/** Product page size (Master Plan §8.1a: page 1 = 10). Former technical default 24 is not product. */
export const RESULTS_PAGE_SIZE_DEFAULT = 10;
export const RESULTS_PAGE_SIZE_MIN = 1;
export const RESULTS_PAGE_SIZE_MAX = 100;
/**
 * Technical live-pricing / price-sort candidate window after filter+sort.
 * GO11: technical live-pricing *priority window* / browse presentable cap — NEVER the matchset/pool size or heading.
 * Full window may continue pricing in the background after the initial workset.
 */
export const RESULTS_LIVE_PRICING_CANDIDATE_CAP = 150;

/**
 * Initial price-sort await workset (subset of {@link RESULTS_LIVE_PRICING_CANDIDATE_CAP}).
 * Aligned with page size 10 + overlay reserve 40: usable live-ranked page paint
 * without sync-awaiting the entire 150-window. Remainder = refill (background).
 * Must stay ≤ {@link RESULTS_LIVE_PRICING_CANDIDATE_CAP}.
 */
export const RESULTS_LIVE_PRICING_INITIAL_WORKSET = 50;

/**
 * @deprecated Alias of {@link RESULTS_LIVE_PRICING_CANDIDATE_CAP}.
 * Not a user-resultset / browse limit.
 */
export const RESULTS_USER_PAGINATION_CAP = RESULTS_LIVE_PRICING_CANDIDATE_CAP;

/**
 * GO11: max browsable pages (10 cards × 15 = 150 presentable B).
 * Matchset/pool size is uncapped; only the card browse window uses this.
 */
export const RESULTS_MAX_BROWSE_PAGES = 15;

/**
 * GO11: display browse cap for presentable B cards (== USER_PAGINATION_CAP).
 * Alias kept explicit so call sites do not confuse pool size with browse size.
 */
export const RESULTS_BROWSE_PRESENTABLE_CAP = RESULTS_USER_PAGINATION_CAP;


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
  return rankedOffers.slice(0, Math.min(cap, rankedOffers.length));
}

/** Initial price-sort await slice; never larger than the technical candidate window. */
export function limitLivePricingInitialWorkset<T>(
  rankedOffers: readonly T[],
  cap: number = RESULTS_LIVE_PRICING_INITIAL_WORKSET,
): T[] {
  return limitLivePricingCandidatePool(
    rankedOffers,
    Math.min(cap, RESULTS_LIVE_PRICING_CANDIDATE_CAP),
  );
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

  const pages = Math.ceil(totalResults / pageSize);
  return Math.min(pages, RESULTS_MAX_BROWSE_PAGES);
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
