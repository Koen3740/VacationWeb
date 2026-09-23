/**
 * AN-077 — Homepage → Results live-price prefetch bridge.
 *
 * Starts the existing production PRICE workset live-pricing flow once a
 * definitive homepage search context is known. Non-blocking; Results stays
 * unaware of the bridge and only sees L1/L2 overlays / inflight.
 */

import type { FetchLike } from '@/lib/providers/prijsvrij/auth';
import { priceLiveRequiredMatchset, stampUnpricedWhenLiveOccupancyUnsupported } from '@/lib/providers/prijsvrij/page1-receipt-pricing';
import { loadOffers } from '@/lib/offers/load-offers';
import { excludeParkedResultsProviders } from '@/lib/search/presentable-price';
import {
  offerNeedsLivePriceWork,
  rankCatalogOffers,
} from '@/lib/search/prepare-results-offers';
import {
  selectLivePricingCandidateWindow,
  selectLivePricingInitialWorkset,
} from '@/lib/search/live-pricing-workset';
import { hydrateResultsLivePriceOverlaysFromL2 } from '@/lib/search/results-live-price-cache';
import { scheduleResultsMatchsetLivePricing } from '@/lib/search/schedule-results-matchset-live-pricing';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import {
  isDefinitiveSearchParams,
  isHomeLivePricePrefetchEnabled,
} from '@/lib/search/home-live-price-prefetch-context';
import type { SearchParams, TravelOffer } from '@/types/travel';

export {
  homeSearchContextKey,
  isDefinitiveHomeSearchContext,
  isDefinitiveSearchParams,
  isHomeLivePricePrefetchEnabled,
  setHomeLivePricePrefetchEnabledForTests,
} from '@/lib/search/home-live-price-prefetch-context';

/** Monotonic generation: newer definitive contexts supersede older prefetch work. */
let latestPrefetchGeneration = 0;

export function resetHomeLivePricePrefetchGenerationForTests(): void {
  latestPrefetchGeneration = 0;
}

export function getHomeLivePricePrefetchGenerationForTests(): number {
  return latestPrefetchGeneration;
}

export function searchParamsFromResultsHref(href: string): SearchParams {
  const url = new URL(href, 'http://localhost');
  const raw: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  return parseSearchParams(raw);
}

export type HomeLivePricePrefetchResult = {
  accepted: boolean;
  reason?:
    | 'flag_off'
    | 'not_definitive'
    | 'stale_generation'
    | 'empty_workset'
    | 'ok';
  generation: number;
  worksetSize?: number;
  windowSize?: number;
  pendingAtStart?: number;
};

/**
 * Run production candidate window → initial workset → priceLiveRequiredMatchset.
 * Does not change caps, ranking, or Results semantics.
 */
export async function runHomeLivePricePrefetchWorkset(
  offers: readonly TravelOffer[],
  params: SearchParams,
  options: {
    fetchImpl?: FetchLike;
    generation?: number;
    isCurrent?: () => boolean;
  } = {},
): Promise<HomeLivePricePrefetchResult> {
  const generation = options.generation ?? 0;
  if (options.isCurrent && !options.isCurrent()) {
    return { accepted: false, reason: 'stale_generation', generation };
  }

  stampUnpricedWhenLiveOccupancyUnsupported(offers as TravelOffer[], params);

  // Same selection order as prepareResultsOffers PRICE branch.
  const catalogRanked = rankCatalogOffers(offers, { ...params, sort: 'price' });
  const liveWindow = selectLivePricingCandidateWindow(catalogRanked, params);
  const workset = selectLivePricingInitialWorkset(liveWindow, params);

  if (options.isCurrent && !options.isCurrent()) {
    return {
      accepted: false,
      reason: 'stale_generation',
      generation,
      worksetSize: workset.length,
      windowSize: liveWindow.length,
    };
  }

  await hydrateResultsLivePriceOverlaysFromL2(
    workset.map((offer) => offer.id),
    params,
  );

  const pendingAtStart = workset.filter((offer) => offerNeedsLivePriceWork(offer, params)).length;
  if (workset.length === 0) {
    return {
      accepted: true,
      reason: 'empty_workset',
      generation,
      worksetSize: 0,
      windowSize: liveWindow.length,
      pendingAtStart: 0,
    };
  }

  if (options.isCurrent && !options.isCurrent()) {
    return {
      accepted: false,
      reason: 'stale_generation',
      generation,
      worksetSize: workset.length,
      windowSize: liveWindow.length,
      pendingAtStart,
    };
  }

  await priceLiveRequiredMatchset(workset, params, { fetchImpl: options.fetchImpl });

  return {
    accepted: true,
    reason: 'ok',
    generation,
    worksetSize: workset.length,
    windowSize: liveWindow.length,
    pendingAtStart,
  };
}

/**
 * Fire-and-forget: schedule existing waitUntil helper. Never awaited by callers
 * on the homepage critical path.
 */
export function scheduleHomeLivePricePrefetch(
  params: SearchParams,
  options: { generation?: number; fetchImpl?: FetchLike; dryRun?: boolean } = {},
): HomeLivePricePrefetchResult {
  if (!isHomeLivePricePrefetchEnabled()) {
    return { accepted: false, reason: 'flag_off', generation: options.generation ?? 0 };
  }
  if (!isDefinitiveSearchParams(params)) {
    return { accepted: false, reason: 'not_definitive', generation: options.generation ?? 0 };
  }

  const generation = options.generation ?? 0;
  if (generation < latestPrefetchGeneration) {
    return { accepted: false, reason: 'stale_generation', generation };
  }
  latestPrefetchGeneration = Math.max(latestPrefetchGeneration, generation);
  const genAtSchedule = generation;

  if (options.dryRun) {
    return { accepted: true, reason: 'ok', generation };
  }

  scheduleResultsMatchsetLivePricing(
    (async () => {
      if (genAtSchedule < latestPrefetchGeneration) {
        return;
      }
      const offers = excludeParkedResultsProviders(await loadOffers());
      await runHomeLivePricePrefetchWorkset(offers, params, {
        fetchImpl: options.fetchImpl,
        generation: genAtSchedule,
        isCurrent: () => genAtSchedule >= latestPrefetchGeneration,
      });
    })(),
  );

  return { accepted: true, reason: 'ok', generation };
}
