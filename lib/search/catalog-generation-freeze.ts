/**
 * Page 15 Gold: Results freeze validity is bound to the catalog generation that
 * produced the definitive Page-1 freeze (`page1Ids`).
 *
 * Validity boundary = runtime `generationId` from `loadRuntimeDataset()` (current.json).
 * No TTL. No L1/L2 keying. No session store — URL stamp only (`catalogGen`).
 *
 * Stamp only READY / EXHAUSTED (DEFINITIVE). Anchors / pending / provisional: no stamp.
 * Mismatch or legacy `page1Ids` without stamp → drop `page` + `page1Ids` (+ stamp),
 * keep search criteria, restart at page 1 (same reset shape as budget-generation nav).
 */

import type { SearchParams } from '@/types/travel';

/** URL param carrying the catalog generation of a definitive Page-1 freeze. */
export const CATALOG_GENERATION_PARAM = 'catalogGen';

/**
 * Navigation options when catalog generation invalidates freeze/paging
 * (mirrors {@link BUDGET_GENERATION_NAVIGATION} paging reset).
 */
export const CATALOG_GENERATION_MISMATCH_NAVIGATION = {
  preservePage1Ids: false,
} as const;

export function parseCatalogGenerationParam(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * True when existing `page1Ids` must be cleared before Results hydrate.
 *
 * - No `page1Ids` → false (cold deep-link / page-1 without freeze keeps existing flow).
 * - `page1Ids` without `catalogGen` (legacy) → true.
 * - `page1Ids` with stamp ≠ current runtime generation → true.
 * - Matching stamp → false.
 * - Current generation missing while freeze present → true (cannot validate).
 */
export function shouldInvalidateResultsFreeze(args: {
  page1Ids: readonly string[] | undefined;
  catalogGen: string | undefined;
  currentGenerationId: string | null | undefined;
}): boolean {
  const ids = (args.page1Ids ?? []).filter((id) => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) return false;

  const stamp = args.catalogGen?.trim() ?? '';
  if (!stamp) return true;

  const current = args.currentGenerationId?.trim() ?? '';
  if (!current) return true;

  return stamp !== current;
}

/**
 * Drop freeze/paging only. Preserves all search criteria (provider, sort, budget,
 * destination, dates, airport, duration, stars, board, occupancy, …).
 */
export function stripResultsFreezePaging(params: SearchParams): SearchParams {
  const next: SearchParams = { ...params };
  delete next.page1Ids;
  delete next.catalogGen;
  next.page = 1;
  return next;
}

/** Delete page / page1Ids / catalogGen on a mutable URLSearchParams (filter nav). */
export function clearResultsFreezePagingParams(params: URLSearchParams): void {
  params.delete('page');
  params.delete('page1Ids');
  params.delete(CATALOG_GENERATION_PARAM);
}