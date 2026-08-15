/**
 * Budget slider UI treats BUDGET_FILTER_MIN as "€0" (no min) and
 * BUDGET_FILTER_MAX as "€2.000+" (no max). Only persist real constraints.
 */
export function writeBudgetParams(
  params: URLSearchParams,
  budgetMin: number,
  budgetMax: number,
  unboundedMin: number,
  unboundedMax: number,
): void {
  if (budgetMin <= unboundedMin) {
    params.delete('budgetMin');
  } else {
    params.set('budgetMin', String(budgetMin));
  }

  if (budgetMax >= unboundedMax) {
    params.delete('budgetMax');
  } else {
    params.set('budgetMax', String(budgetMax));
  }
}
