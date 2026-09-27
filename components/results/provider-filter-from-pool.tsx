import {
  ProviderFilterSelect,
  ProviderFilterSelectFallback,
} from '@/components/results/provider-filter-select';
import { loadPreparedResultsOffers } from '@/lib/search/prepared-results-request';
import {
  countProvidersInEffectivePool,
  omitProviderFilter,
} from '@/lib/search/provider-filter';
import { bookableResultsMembership } from '@/lib/search/results-catalog-page';
import { hydrateResultsLivePriceOverlaysFromL2 } from '@/lib/search/results-live-price-cache';
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
 * Provider options + counts from the same proven-B pool as the Results heading.
 * Does not re-run catalog filtering or live pricing — hydrates L2 then counts
 * {@link bookableResultsMembership} without the provider constraint.
 */
export async function ProviderFilterFromPool({
  filteringParams,
  selectedProvider,
}: ProviderFilterFromPoolProps) {
  const baseParams = omitProviderFilter(filteringParams);
  const prepared = await loadPreparedResultsOffers(baseParams);
  const ranked = await prepared.exactOffers;
  await hydrateResultsLivePriceOverlaysFromL2(
    ranked.map((offer) => offer.id),
    baseParams,
    { offers: ranked },
  );
  const effectivePool = bookableResultsMembership(ranked, baseParams);
  const { total, providers } = countProvidersInEffectivePool(effectivePool);

  return (
    <ProviderFilterSelect
      total={total}
      providers={providers}
      selectedProvider={selectedProvider}
    />
  );
}

export { ProviderFilterSelectFallback };
