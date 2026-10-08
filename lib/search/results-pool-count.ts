/**
 * Results count helpers.
 *
 * Proven-B membership ({@link countResultsPool} / {@link bookableResultsMembership})
 * stays the card/browse source of truth. User-facing display is a separate choice
 * ({@link selectDisplayedResultsCount}): catalog matchset when strictly > 150,
 * else Proven-B. A / C / Pending / unpriced are never Proven-B.
 *
 * Browse/pagination still caps cards at 150; that cap is not a display count.
 */
import type { SearchParams, TravelOffer } from '@/types/travel';
import { RESULTS_BROWSE_PRESENTABLE_CAP } from '@/lib/search/pagination';
import { scopeOffersToProviderFilter } from '@/lib/search/provider-filter';
import { bookableResultsMembership } from '@/lib/search/results-catalog-page';

/**
 * Proven B/listable membership for this search (same set as Results cards).
 * Not the catalog matchset length and not the user-facing display count.
 */
export function countResultsPool(
  offers: readonly TravelOffer[],
  params?: SearchParams,
): number {
  return bookableResultsMembership(offers, params).length;
}

/** Raw catalog/filter matchset size. Display uses this only when strictly > 150. */
export function countCatalogMatchset(offers: readonly unknown[]): number {
  return offers.length;
}

/**
 * Catalog matchset size for the CURRENT search, including `?provider=`.
 * Global (alle aanbieders) length must not be reused after a provider subset.
 */
export function countCatalogMatchsetForSearch(
  offers: readonly Pick<TravelOffer, 'provider'>[],
  params?: Pick<SearchParams, 'provider'>,
): number {
  return countCatalogMatchset(scopeOffersToProviderFilter(offers, params));
}

/**
 * Display rule (Main Chat 5): catalogCount > 150 → catalog; catalogCount <= 150 → Proven-B.
 * Threshold is the existing 150-card browse cap; not a new product number.
 */
export function usesCatalogResultsDisplayCount(catalogCount: number): boolean {
  return Number.isFinite(catalogCount) && catalogCount > RESULTS_BROWSE_PRESENTABLE_CAP;
}

/**
 * User-facing Results/facet number. Does not change Proven-B membership or card cap.
 */
export function selectDisplayedResultsCount(
  catalogCount: number,
  provenBCount: number,
): number {
  if (usesCatalogResultsDisplayCount(catalogCount)) {
    return Math.floor(catalogCount);
  }
  if (!Number.isFinite(provenBCount) || provenBCount <= 0) {
    return 0;
  }
  return Math.floor(provenBCount);
}

/** Cap browsable presentable (B) cards at 150 (15 pages × 10). Not a pool/heading cap. */
export function capBrowsablePresentableCount(
  presentableCount: number,
  cap: number,
): number {
  if (!Number.isFinite(presentableCount) || presentableCount <= 0) {
    return 0;
  }
  if (!Number.isFinite(cap) || cap <= 0) {
    return 0;
  }
  return Math.min(Math.floor(presentableCount), Math.floor(cap));
}
