import type { SearchParams, TravelOffer } from '@/types/travel';
import {
  ACCOMMODATION_TYPE_FILTER_VALUES,
  effectiveAccommodationTypesForFilter,
  parseAccommodationTypesParam,
} from './accommodation-type-filter';
import { filterOffers } from './filtering';
import { isPriceDependentSort, rankCatalogOffers } from './prepare-results-offers';
import { rankResultsOffers } from './rank-results-offers';
import { applyResultsLivePriceOverlays } from './results-live-price-cache';

/** Budget filters use offer.price; apply cached live overlays so the count matches Results. */
function paramsNeedLivePriceOverlaysForLimit(params: SearchParams): boolean {
  return params.budgetMin !== undefined || params.budgetMax !== undefined;
}

/**
 * Resolve accommodationTypes for filter counting without loading filter-options.
 * Uses the same catalog of known filter values that {@link filterOffers} uses internally.
 */
export function resolveFilteringParamsForEarlyLimit(params: SearchParams): SearchParams {
  if (!params.accommodationTypes?.length) {
    return { ...params, accommodationTypes: undefined };
  }
  const effective = effectiveAccommodationTypesForFilter(
    parseAccommodationTypesParam(params.accommodationTypes.join(',')),
    ACCOMMODATION_TYPE_FILTER_VALUES,
  );
  return {
    ...params,
    accommodationTypes: effective.length > 0 ? effective : undefined,
  };
}

/**
 * Filter + rank the full matchset (tests / callers that need ordering).
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
  return evaluateResultsResultsetLimit(offers, params).matchCount;
}

export type ResultsResultsetLimitEvaluation = {
  /** Exact filtered match count (no product cap). */
  matchCount: number;
  /**
   * Always false — the former RESULTS_USER_RESULTSET_MAX product cap was removed.
   * Kept on the type so existing call sites compile during migration.
   */
  overLimit: false;
  /** Offers examined while counting. */
  scannedOffers: number;
  /** Always false — counting no longer early-stops on a product max. */
  stoppedEarly: false;
};

/**
 * Count the filtered matchset with the same {@link filterOffers} semantics as Results.
 * No product resultset cap, no ranking/sort, no Receipt HTTP.
 * Applies cached live-price overlays only when budget filters are active.
 */
export function evaluateResultsResultsetLimit(
  offers: readonly TravelOffer[],
  params: SearchParams,
): ResultsResultsetLimitEvaluation {
  const filteringParams = resolveFilteringParamsForEarlyLimit(params);
  const source = paramsNeedLivePriceOverlaysForLimit(filteringParams)
    ? applyResultsLivePriceOverlays(offers, filteringParams)
    : (offers as TravelOffer[]);

  const scannedOut = { value: 0 };
  const matched = filterOffers(source, filteringParams, { scannedOut });

  return {
    matchCount: matched.length,
    overLimit: false,
    scannedOffers: scannedOut.value,
    stoppedEarly: false,
  };
}
