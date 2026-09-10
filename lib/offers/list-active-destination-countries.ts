import { loadPresentedFilterOptions } from '@/lib/offers/present-active-filter-options';
import type { FilterOptions } from '@/types/travel';

/**
 * Countries that currently have ≥1 active catalog package offer.
 * Uses the same presented/active catalog set as Results (not a static tourist list).
 */
export function listActiveDestinationCountries(options: FilterOptions): string[] {
  const counts = options.countryCounts ?? {};
  return (options.countries ?? [])
    .filter((name) => Boolean(name) && (counts[name] ?? 0) > 0)
    .sort((left, right) => left.localeCompare(right, 'nl'));
}

export async function loadActiveDestinationCountries(): Promise<string[]> {
  return listActiveDestinationCountries(await loadPresentedFilterOptions());
}
