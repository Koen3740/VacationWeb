import {
  ProviderFilterSelect,
  ProviderFilterSelectFallback,
} from '@/components/results/provider-filter-select';
import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';
import {
  listProvidersInMatchset,
  omitProviderFilter,
} from '@/lib/search/provider-filter';
import type { SearchParams } from '@/types/travel';

export type ProviderFilterFromPoolProps = {
  /**
   * Current Results filtering params. Provider is omitted internally so counts
   * reflect the full effective B pool for this search (Alle aanbieders).
   */
  filteringParams: SearchParams;
  selectedProvider?: string;
};

/**
 * Provider options from the catalog matchset of this search (t334u).
 *
 * Before (t334u RCA): the list was built from the proven-B pool at render time, so with
 * 0 B yet (cold L1, live pricing still running) the sidebar showed only "Alle
 * aanbieders" and never changed (one-shot server render). Providers are now known as
 * soon as the matchset is prepared: no L2 hydrate, no wait for live pricing. Selecting a
 * provider still subsets the proven-B pool; "Alle aanbieders" stays available.
 */
export async function ProviderFilterFromPool({
  filteringParams,
  selectedProvider,
}: ProviderFilterFromPoolProps) {
  const baseParams = omitProviderFilter(filteringParams);
  const prepared = await loadPreparedResultsOffers(baseParams);
  const matchset = await prepared.exactOffers;
  const providers = listProvidersInMatchset(matchset).map((provider) => ({ provider }));

  return (
    <ProviderFilterSelect
      total={matchset.length}
      providers={providers}
      selectedProvider={selectedProvider}
    />
  );
}

export { ProviderFilterSelectFallback };
