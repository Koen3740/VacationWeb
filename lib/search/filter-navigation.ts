/**
 * Results URL paging. Catalog-only refinements keep page1Ids as a skip-HTTP
 * hint so page 1 can re-filter the full loaded catalog when cards are already
 * presentable. Stale IDs are not a whitelist; the page-1 resolver falls back
 * to live pricing when they would empty a live-priceable matchset.
 * Clearing page1Ids also clears catalogGen (Page 15 Gold freeze stamp).
 */
import { CATALOG_GENERATION_PARAM } from '@/lib/search/catalog-generation-freeze';

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
