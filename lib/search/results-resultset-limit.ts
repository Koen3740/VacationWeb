import type { SearchParams, TravelOffer } from '@/types/travel';
import { isResultsResultsetOverLimit, RESULTS_USER_RESULTSET_MAX } from './pagination';
import { isPriceDependentSort, rankCatalogOffers } from './prepare-results-offers';
import { rankResultsOffers } from './rank-results-offers';

export { RESULTS_USER_RESULTSET_MAX, isResultsResultsetOverLimit };

/**
 * Filter + rank the full matchset for limit evaluation.
 * Uses catalog ranking only — no live-pricing HTTP.
 */
export function rankResultsMatchsetForLimit(
  offers: readonly TravelOffer[],
  params: SearchParams,
): TravelOffer[] {
  return isPriceDependentSort(params.sort)
    ? rankCatalogOffers(offers, params)
    : rankResultsOffers(offers, params);
}

export function countResultsMatchsetForLimit(
  offers: readonly TravelOffer[],
  params: SearchParams,
): number {
  return rankResultsMatchsetForLimit(offers, params).length;
}

export type ResultsResultsetLimitEvaluation = {
  ranked: TravelOffer[];
  matchCount: number;
  overLimit: boolean;
};

export function evaluateResultsResultsetLimit(
  offers: readonly TravelOffer[],
  params: SearchParams,
): ResultsResultsetLimitEvaluation {
  const ranked = rankResultsMatchsetForLimit(offers, params);
  const matchCount = ranked.length;
  return {
    ranked,
    matchCount,
    overLimit: isResultsResultsetOverLimit(matchCount),
  };
}
