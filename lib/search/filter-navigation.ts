/**
 * Results URL paging. Catalog-only refinements keep page1Ids as a skip-HTTP
 * hint so page 1 can re-filter the full loaded catalog when cards are already
 * presentable. Stale IDs are not a whitelist; the page-1 resolver falls back
 * to live pricing when they would empty a live-priceable matchset.
 */
export function applyFilterNavigationPaging(
  params: URLSearchParams,
  options: { preservePage1Ids: boolean; liveQuery?: string },
): void {
  params.delete('page');

  if (!options.preservePage1Ids) {
    params.delete('page1Ids');
    return;
  }

  if (params.get('page1Ids')) {
    return;
  }

  if (!options.liveQuery) {
    return;
  }

  const liveIds = new URLSearchParams(options.liveQuery).get('page1Ids');
  if (liveIds) {
    params.set('page1Ids', liveIds);
  }
}
