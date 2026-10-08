import { writeTravelerQueryFromParams } from '@/lib/search/traveler-contract';
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
 * D-v2 hasMore (owner decision 25-09-2026 18:50, closes A-39): true when the current
 * valid presentable pool holds MORE B offers than the current page window shows.
 * Only B counts (A / C / Pending are never in a presentable pool). Not coupled to
 * Pending, C, provider responses, raw matchset or catalogue counts.
 * - `presentableCount`: B offers in the valid (browse-capped; page1Ids-excluded for
 *   page 2+ with a freeze) presentable pool.
 * - `windowEnd`: pool index just after the current page window.
 * Page 1, pageSize 10: 0-10 B -> false; > 10 B -> true.
 */
export function resultsHasMore(args: {
  presentableCount: number;
  windowEnd: number;
  page: number;
}): boolean {
  const count = Number.isFinite(args.presentableCount)
    ? Math.max(0, Math.floor(args.presentableCount))
    : 0;
  const windowEnd = Number.isFinite(args.windowEnd) ? Math.max(0, Math.floor(args.windowEnd)) : 0;
  const page = Number.isFinite(args.page) && args.page >= 1 ? Math.floor(args.page) : 1;
  return page < RESULTS_MAX_BROWSE_PAGES && count > windowEnd;
}

/**
 * Next control on the last browsable page (15) is not page 16.
 * It opens the existing max-150 / refine message while the 150-card cap stays.
 */
export function resultsNextControlKind(args: {
  currentPage: number;
  totalPages: number;
}): 'page' | 'browse-cap' | 'hidden' {
  const current =
    Number.isFinite(args.currentPage) && args.currentPage >= 1
      ? Math.floor(args.currentPage)
      : 1;
  const total =
    Number.isFinite(args.totalPages) && args.totalPages >= 1
      ? Math.floor(args.totalPages)
      : 1;
  if (current < total) {
    return 'page';
  }
  if (current === RESULTS_MAX_BROWSE_PAGES && total === RESULTS_MAX_BROWSE_PAGES) {
    return 'browse-cap';
  }
  return 'hidden';
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

/**
 * Stable Results browse page count for the pagination UI (cap ÷ pageSize).
 * Prefer {@link getResultsTotalPages} with the effective browse total for the
 * visible page list — that respects small provider pools (e.g. 3 → 1 page).
 */
export function getResultsBrowsePageCount(
  pageSize: number = RESULTS_PAGE_SIZE_DEFAULT,
): number {
  const size =
    Number.isFinite(pageSize) && pageSize > 0
      ? Math.floor(pageSize)
      : RESULTS_PAGE_SIZE_DEFAULT;
  return Math.min(
    RESULTS_MAX_BROWSE_PAGES,
    Math.max(1, Math.ceil(RESULTS_BROWSE_PRESENTABLE_CAP / size)),
  );
}

export type CompactPaginationItem = number | 'ellipsis';

function paginationRange(from: number, to: number): number[] {
  const start = Math.max(1, Math.floor(from));
  const end = Math.max(start, Math.floor(to));
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

/**
 * Compact page list that always exposes the next numbered page.
 * Examples (15 pages): 1 2 3 … 15 | 1 2 3 4 … 15 | 1 … 14 15
 */
export function buildCompactPaginationItems(
  currentPage: number,
  totalPages: number,
): CompactPaginationItem[] {
  if (!Number.isFinite(totalPages) || totalPages <= 0) {
    return [];
  }
  const total = Math.floor(totalPages);
  if (total === 1) {
    return [1];
  }
  if (total <= 7) {
    return paginationRange(1, total);
  }

  const current = Math.min(Math.max(1, Math.floor(currentPage) || 1), total);

  // Last two pages: keep 15 as the last real results page (never page 16).
  if (current >= total - 1) {
    if (current === total) {
      return [1, 'ellipsis', total - 1, total];
    }
    return [1, 'ellipsis', total - 2, total - 1, total];
  }

  // After the expanding prefix, slide so current-1 / current / current+1 stay clickable.
  if (current >= 6) {
    return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
  }

  // Pages 1–5: grow the leading window so the next page is always visible.
  // page 1 → 1 2 3; page 2/3 → through 4; page 4 → through 5; page 5 → through 6.
  const high = Math.min(total - 1, current === 2 ? 4 : Math.max(3, current + 1));
  if (high >= total - 1) {
    return paginationRange(1, total);
  }
  return [...paginationRange(1, high), 'ellipsis', total];
}

/** Clamp a requested page into 1..totalPages (empty pool → page 1). */
export function clampResultsPage(page: number, totalPages: number): number {
  const safeTotal =
    Number.isFinite(totalPages) && totalPages >= 1 ? Math.floor(totalPages) : 1;
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  return Math.min(safePage, safeTotal);
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

  // DEC-019: the single traveller writer (adults + childAges + derived counts + rooms); never a DOB.
  writeTravelerQueryFromParams(query, params);

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

  if (params.coast === true) {
    query.set('coast', '1');
  }

  if (params.urban === true) {
    query.set('urban', '1');
  }

  if (params.rural === true) {
    query.set('rural', '1');
  }

  if (params.centerDistance?.length) {
    query.set('centerDistance', params.centerDistance.join(','));
  }

  if (params.beachDistance?.length) {
    query.set('beachDistance', params.beachDistance.join(','));
  }

  if (params.amenities?.length) {
    query.set('amenities', params.amenities.join(','));
  }

  if (params.hasCarRental === true) {
    query.set('hasCarRental', '1');
  }

  if (params.provider) {
    query.set('provider', params.provider);
  }

  if (params.sort && params.sort !== 'value') {
    query.set('sort', params.sort);
  }

  if (params.page1Ids?.length) {
    query.set('page1Ids', params.page1Ids.join(','));
  }

  if (params.catalogGen) {
    query.set('catalogGen', params.catalogGen);
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
