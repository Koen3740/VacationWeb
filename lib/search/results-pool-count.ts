/**
 * Results HEADING / user-facing result count.
 *
 * Count = proven listable B only ({@link bookableResultsMembership}).
 * Catalog matchset size is NEVER the end-user result count — A / C / Pending /
 * unpriced offers are excluded.
 *
 * Browse/pagination may still cap cards at 150; the heading is uncapped B.
 */
import type { SearchParams, TravelOffer } from '@/types/travel';
import { bookableResultsMembership } from '@/lib/search/results-catalog-page';

/**
 * User-facing Results count: proven B/listable offers for this search
 * (same membership as Results cards). Not the catalog matchset length.
 */
export function countResultsPool(
  offers: readonly TravelOffer[],
  params?: SearchParams,
): number {
  return bookableResultsMembership(offers, params).length;
}

/** Raw catalog/filter matchset size — internal/diagnostics only, never heading. */
export function countCatalogMatchset(offers: readonly unknown[]): number {
  return offers.length;
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
