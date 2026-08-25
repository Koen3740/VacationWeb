import { deriveFilterOptions } from '@/lib/offers/derive-filter-options';
import { canonicalizeFilterOptions } from '@/lib/offers/load-filter-options';
import { loadRuntimeDataset } from '@/lib/offers/load-runtime-dataset';
import { excludeParkedResultsProviders } from '@/lib/search/presentable-price';
import type { FilterOptions } from '@/types/travel';
import type { TravelOffer } from '@/types/travel';

/** UI filter options for the same active provider set as Results. Catalog stays intact. */
export function presentActiveFilterOptions(offers: readonly TravelOffer[]): FilterOptions {
  return canonicalizeFilterOptions(deriveFilterOptions(excludeParkedResultsProviders(offers)));
}

export async function loadPresentedFilterOptions(): Promise<FilterOptions> {
  return presentActiveFilterOptions((await loadRuntimeDataset()).offers);
}
