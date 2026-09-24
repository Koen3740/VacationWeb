/**
 * GO11: Results HEADING / facet pool counts.
 *
 * POOL = full filter matchset (uncapped). Heading and sidebar facet badges count
 * this pool — identical across sorts, stable as live prices arrive.
 * Presentable B / browse cap (150) are separate (cards + pagination only).
 */
export function countResultsPool(offers: readonly unknown[]): number {
  return offers.length;
}

/** Cap browsable presentable (B) cards at 150 (15 pages × 10). Not a pool cap. */
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
