/**
 * Results URL paging. Catalog-only refinements keep page1Ids as a skip-HTTP
 * hint so page 1 can re-filter the full loaded catalog when cards are already
 * presentable. Stale IDs are not a whitelist; the page-1 resolver falls back
 * to live pricing when they would empty a live-priceable matchset.
 * Clearing page1Ids also clears catalogGen (Page 15 Gold freeze stamp).
 *
 * Latest-commit wins: the Next.js App Router action queue discards a pending
 * older navigation when a newer `router.replace` is issued (same mechanism as
 * {@link BUDGET_GENERATION_NAVIGATION} in budget-generation.ts). Sidebar filter
 * clicks must not be dropped while that older replace is in flight.
 */
import { CATALOG_GENERATION_PARAM } from '@/lib/search/catalog-generation-freeze';

/**
 * Catalog sidebar filters: a newer click starts a new replace immediately.
 * Next discards the older RSC; server pricing supersedes via pricingRunKey.
 */
export const SIDEBAR_FILTER_NAVIGATION = {
  allowWhileNavigating: true,
} as const;

/**
 * User sort change is a new ranking generation: drop the previous page-1 freeze
 * so rating/stars/etc. are not pinned to an older arrival/default order.
 * Live prices stay L1/L2 reuse (occupancy unchanged).
 */
export const SORT_NAVIGATION = {
  preservePage1Ids: false,
} as const;

export function shouldDropFilterCommit(args: {
  navigationLocked: boolean;
  allowWhileNavigating?: boolean;
}): boolean {
  return args.navigationLocked && args.allowWhileNavigating !== true;
}

/** Compose rapid checkbox toggles on the latest local selection (not a stale render). */
export function toggleSelectedValue<T>(selected: readonly T[], value: T): T[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}

export function applyFilterNavigationPaging(
  params: URLSearchParams,
  options: { preservePage1Ids: boolean; liveQuery?: string },
): void {
  params.delete('page');

  if (!options.preservePage1Ids) {
    params.delete('page1Ids');
    params.delete(CATALOG_GENERATION_PARAM);
    return;
  }

  if (params.get('page1Ids')) {
    return;
  }

  if (!options.liveQuery) {
    return;
  }

  const live = new URLSearchParams(options.liveQuery);
  const liveIds = live.get('page1Ids');
  if (liveIds) {
    params.set('page1Ids', liveIds);
    const liveGen = live.get(CATALOG_GENERATION_PARAM);
    if (liveGen) {
      params.set(CATALOG_GENERATION_PARAM, liveGen);
    }
  }
}
