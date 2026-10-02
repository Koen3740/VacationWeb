/**
 * t334u: background (non-blocking) L2 -> L1 hydrate of the FULL matchset for the
 * Results count.
 *
 * Before: heading / provider filter / facets each AWAITED an unbudgeted full-matchset
 * hydrate before rendering anything (measured: 788 offers = ~12 s, 6,825 = 98 s, 8,433 =
 * 110 s of "."). Hydrate seeds L1 per record, so the progressive count can follow it
 * while it runs. One in-flight hydrate per pool key (heading hero + section + price-sort
 * share it); the page-1 window keeps its own 1 s budgeted hydrate (unchanged).
 */
import type { SearchParams, TravelOffer } from '@/types/travel';
import { buildPricingRunKey } from '@/lib/search/live-pricing-admission';
import { hydrateResultsLivePriceOverlaysFromL2 } from '@/lib/search/results-live-price-cache';
import { omitProviderFilter } from '@/lib/search/provider-filter';

const POOL_HYDRATE_REUSE_MS = 60_000;

const inflight = new Map<string, number>();

export function startResultsPoolL2Hydrate(
  ranked: readonly TravelOffer[],
  params: SearchParams,
  nowMs: number = Date.now(),
): boolean {
  if (ranked.length === 0) {
    return false;
  }
  const key = `${buildPricingRunKey(omitProviderFilter(params))}|${ranked.length}|${ranked[0]?.id ?? ''}`;
  const startedAt = inflight.get(key);
  if (startedAt !== undefined && nowMs - startedAt < POOL_HYDRATE_REUSE_MS) {
    return false;
  }
  inflight.set(key, nowMs);
  if (inflight.size > 64) {
    for (const [oldKey, at] of inflight) {
      if (nowMs - at >= POOL_HYDRATE_REUSE_MS) inflight.delete(oldKey);
    }
  }
  // Fire and forget: failures only mean the count stays at what L1 already proves.
  void hydrateResultsLivePriceOverlaysFromL2(
    ranked.map((offer) => offer.id),
    params,
    { offers: ranked as TravelOffer[] },
  ).catch(() => undefined);
  return true;
}

export function resetResultsPoolHydrateForTests(): void {
  inflight.clear();
}
