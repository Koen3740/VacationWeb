/**
 * Results budget generations (owner decision 25-09-2026 22:24).
 *
 * The budget slider has two independent handles (min = "vanaf", max = "tot"). Every
 * committed change of either handle is a NEW query generation (G1, G2, ...). A newer
 * generation must never be dropped because an older one is still loading, and it
 * never inherits page1Ids from an older generation: it builds its own Page 1.
 *
 * Stale protection itself is the existing Next.js App Router action queue
 * (next/dist/shared/lib/router/action-queue.js): a new navigation marks the pending
 * older navigation as discarded, so an older generation's RSC response is never
 * applied once a newer one exists. Nothing here cancels server work (old runs may
 * finish; their live prices are per-offer facts in L1/L2, filtered by the current
 * generation's budget when it renders). No debounce.
 */

export type BudgetRange = { min: number; max: number };

export type BudgetHandle = 'min' | 'max';

/** Draft after moving one handle (the handles never cross; the other one is pushed). */
export function nextBudgetDraft(
  current: BudgetRange,
  handle: BudgetHandle,
  value: number,
): BudgetRange {
  return handle === 'min'
    ? { min: value, max: Math.max(current.max, value) }
    : { max: value, min: Math.min(current.min, value) };
}

/** A committed budget that differs from the current criteria is a new generation. */
export function isNewBudgetGeneration(current: BudgetRange, next: BudgetRange): boolean {
  return next.min !== current.min || next.max !== current.max;
}

/**
 * Navigation options for a budget commit: allowed while an older navigation is still
 * in flight (the router discards the older one) and never carrying page1Ids over.
 */
export const BUDGET_GENERATION_NAVIGATION = {
  allowWhileNavigating: true,
  preservePage1Ids: false,
} as const;