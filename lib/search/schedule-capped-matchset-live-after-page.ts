/**
 * GO11: schedule FULL-matchset live pricing AFTER page overlays have started.
 * Page work must never wait behind matchset-wide hydrate/live HTTP.
 * GO5 latency kept: macrotask defer so page overlays claim concurrency first.
 * Cap ≤150 on background scope is REVERTED — whole pool is warmed.
 *
 * GO11-followup: wait for page-1 overlay settlement OR a short head-start delay
 * BEFORE full-pool HTTP so cold page-1 is not starved. Still fire-and-forget.
 *
 * Unified live-pricing discovery (architecture):
 * One matchset, all providers together, ordered by catalogue price ascending.
 * Discovery prices along that order and collects proven B until 150 (S6) —
 * never provider quotas, never feed/provider block order.
 */
import type { FetchLike } from '../providers/prijsvrij/auth';
import { priceLiveRequiredMatchset } from '../providers/prijsvrij/page1-receipt-pricing';
import { scheduleResultsMatchsetLivePricing } from './schedule-results-matchset-live-pricing';
import { runS6DynamicRefill } from './s6-dynamic-refill';
import { isSharedLivePricingPoolSort } from './results-catalog-page';
import type { SearchParams, TravelOffer } from '@/types/travel';

/** Default head-start for page-1 overlays before full-pool live HTTP (ms). */
export const MATCHSET_LIVE_AFTER_PAGE_HEADSTART_MS = 1500;

function deferToMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type ScheduleMatchsetLiveAfterPageOptions = {
  fetchImpl?: FetchLike;
  /**
   * Optional promise (e.g. page-1 overlay settlement). Full-pool pricing waits
   * for it OR the head-start timeout — whichever comes first — then runs.
   * Never awaited by the Results render path.
   */
  afterPageOverlays?: Promise<unknown>;
  /** Override head-start ms (default MATCHSET_LIVE_AFTER_PAGE_HEADSTART_MS). */
  headstartMs?: number;
  /**
   * Shared live-pricing pool: walk the matchset in unified discovery order
   * (catalogue price ascending) — S6 refill toward 150 B first, then full-pool
   * warm in the same order. Cached / in-flight offers are skipped as usual.
   */
  cheapestFirst?: boolean;
};

/**
 * Unified live-pricing discovery order: one matchset, catalogue price ascending,
 * stable on ties. Provider is only an offer attribute — never a batch key.
 */
export function orderMatchsetForUnifiedLiveDiscovery(
  ranked: readonly TravelOffer[],
): TravelOffer[] {
  return ranked
    .map((offer, index) => ({ offer, index }))
    .sort((a, b) => a.offer.price - b.offer.price || a.index - b.index)
    .map(({ offer }) => offer);
}

/** @deprecated Alias — prefer {@link orderMatchsetForUnifiedLiveDiscovery}. */
export function orderMatchsetCheapestFirst(ranked: readonly TravelOffer[]): TravelOffer[] {
  return orderMatchsetForUnifiedLiveDiscovery(ranked);
}

/**
 * Discovery ranking for shared-pool sorts (Default / Laag→Hoog): unified
 * cheapest-first. Other sorts keep their own rank order.
 */
export function discoveryRankedForLivePricing(
  ranked: readonly TravelOffer[],
  params: SearchParams,
): TravelOffer[] {
  if (!isSharedLivePricingPoolSort(params.sort)) {
    return ranked as TravelOffer[];
  }
  return orderMatchsetForUnifiedLiveDiscovery(ranked);
}

/** @deprecated Alias — prefer {@link discoveryRankedForLivePricing}. */
export function page1DiscoveryRanked(
  ranked: readonly TravelOffer[],
  params: SearchParams,
): TravelOffer[] {
  return discoveryRankedForLivePricing(ranked, params);
}

/**
 * Fire-and-forget: price the entire ranked matchset after page-1 head-start.
 * Export name kept for call-site stability; scope is uncapped (GO11).
 */
export function scheduleCappedMatchsetLiveAfterPage(
  ranked: readonly TravelOffer[],
  params: SearchParams,
  options: ScheduleMatchsetLiveAfterPageOptions = {},
): void {
  if (ranked.length === 0) {
    return;
  }
  const useUnifiedDiscovery =
    options.cheapestFirst === true || isSharedLivePricingPoolSort(params.sort);
  const matchset = useUnifiedDiscovery
    ? orderMatchsetForUnifiedLiveDiscovery(ranked)
    : (ranked as TravelOffer[]);
  const headstartMs =
    typeof options.headstartMs === 'number' && Number.isFinite(options.headstartMs)
      ? Math.max(0, Math.floor(options.headstartMs))
      : MATCHSET_LIVE_AFTER_PAGE_HEADSTART_MS;

  scheduleResultsMatchsetLivePricing(
    (async () => {
      await deferToMacrotask();
      const started = Date.now();
      if (options.afterPageOverlays) {
        await Promise.race([options.afterPageOverlays, delay(headstartMs)]);
      } else {
        await delay(headstartMs);
      }
      if (process.env.VACATIONWEB_RESULTS_TIMING === '1') {
        console.info(
          '[results-timing]',
          JSON.stringify({
            phase: 'matchset-live-deferred-start',
            matchset: matchset.length,
            scope: 'full-pool',
            waitedMs: Date.now() - started,
            headstartMs,
            hadAfter: Boolean(options.afterPageOverlays),
            cheapestFirst: useUnifiedDiscovery,
            unifiedDiscovery: useUnifiedDiscovery,
          }),
        );
      }
      if (useUnifiedDiscovery) {
        // S6 walks discovery order until 150 proven B (A/C skipped; continues past 150 attempts).
        await runS6DynamicRefill(matchset, params, { fetchImpl: options.fetchImpl });
      }
      await priceLiveRequiredMatchset(matchset, params, {
        fetchImpl: options.fetchImpl,
      });
    })(),
  );
}
