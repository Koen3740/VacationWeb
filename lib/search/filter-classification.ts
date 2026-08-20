/**
 * Results filter classification.
 *
 * loadOffers() returns the full catalog every request. filterOffers() then
 * applies URL params to that complete set — never only the visible 10 cards.
 *
 * FAST FILTER: the changed param is a catalog field already present on every
 * offer. Re-filtering the loaded catalog is complete and correct. Live prices
 * are not an input to that filter, so Receipt / Corendon HTTP are not required.
 *
 * NEW SEARCH REQUIRED: occupancy changes the live-price context (Package 1
 * Receipt is proven only for 2A / 0C / 0B / 1 room). Previously presented
 * live prices cannot be reused safely.
 */

export const FAST_FILTER_PARAMS = [
  'budgetMin',
  'budgetMax',
  'stars',
  'boardTypes',
  'amenities',
  'vacationTypes',
  'hasCarRental',
  'accommodationTypes',
  'beachLocation',
  'centerLocation',
  'country',
  'region',
  'city',
  'departureAirport',
  'nights',
  'nightsMin',
  'nightsMax',
  'departureStart',
  'departureEnd',
  'flexibilityDays',
  'sort',
] as const;

export const NEW_SEARCH_OCCUPANCY_PARAMS = [
  'adults',
  'children',
  'babies',
  'rooms',
  'dob',
  'partyRooms',
] as const;

function occupancyValue(params: URLSearchParams, key: (typeof NEW_SEARCH_OCCUPANCY_PARAMS)[number]): string {
  if (key === 'adults') {
    return params.get(key) || '2';
  }
  if (key === 'rooms') {
    return params.get(key) || '1';
  }
  if (key === 'dob' || key === 'partyRooms') {
    return params.get(key) || '';
  }
  return params.get(key) || '0';
}

export function occupancySearchParamsChanged(
  previous: URLSearchParams,
  next: URLSearchParams,
): boolean {
  return NEW_SEARCH_OCCUPANCY_PARAMS.some(
    (key) => occupancyValue(previous, key) !== occupancyValue(next, key),
  );
}

/**
 * True when Results may keep `page1Ids` on the URL as a skip-live-HTTP hint.
 * Occupancy changes wipe them. Catalog filters keep them so already-presentable
 * page-1 cards can re-filter without Receipt.
 *
 * `page1Ids` is not a whitelist. `tryCatalogRefinePage1` still rebuilds page 1
 * from the current filtered pool, and falls back to live pricing when the hint
 * would leave a live-priceable matchset with 0 cards.
 */
export function shouldPreservePage1Ids(
  previous: URLSearchParams,
  next: URLSearchParams,
): boolean {
  return !occupancySearchParamsChanged(previous, next);
}
