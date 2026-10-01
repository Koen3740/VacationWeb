/**
 * Results live-pricing orchestrator (P0 after head-start → P1 S6 → P2 warm).
 *
 * GO11 background warming of the full pool remains product intent, but dispatch
 * is demand-driven (exact batches). Never pre-enqueues the entire matchset.
 *
 * Unified live-pricing discovery:
 * One matchset, all providers together, ordered by catalogue price ascending.
 * P1 collects proven B until 150; P2 continues while the pricing run is active.
 */
import type { FetchLike } from '../providers/prijsvrij/auth';
import { scheduleResultsMatchsetLivePricing } from './schedule-results-matchset-live-pricing';
import { runS6DynamicRefill } from './s6-dynamic-refill';
import { runP2BackgroundWarm } from './p2-background-warm';
import { isSharedLivePricingPoolSort } from './results-catalog-page';
import {
  beginOrContinuePricingRun,
  buildPricingRunKey,
  markPricingRunPage1Settled,
  type PricingRunHandle,
} from './live-pricing-admission';
import type { SearchParams, TravelOffer } from '@/types/travel';

/** Default head-start for page-1 overlays before P1/P2 live HTTP (ms). */
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
   * Optional promise (e.g. page-1 overlay settlement). P1/P2 wait for it OR
   * the head-start timeout — whichever comes first — then run.
   * Never awaited by the Results render path.
   */
  afterPageOverlays?: Promise<unknown>;
  /** Override head-start ms (default MATCHSET_LIVE_AFTER_PAGE_HEADSTART_MS). */
  headstartMs?: number;
  /**
   * Shared live-pricing pool: walk the matchset in unified discovery order
   * (catalogue price ascending) — P1 toward 150 B, then P2 warm.
   */
  cheapestFirst?: boolean;
  /** Active pricing run (from CatalogLiveBody / prepare). */
  pricingRun?: PricingRunHandle;
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
 * Single Results live-pricing orchestrator: P1 (S6 → 150 B) then P2 warm.
 * Fire-and-forget via {@link scheduleResultsMatchsetLivePricing}.
 *
 * Export name kept for call-site stability.
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

  const pricingRun =
    options.pricingRun ?? beginOrContinuePricingRun(buildPricingRunKey(params));

  scheduleResultsMatchsetLivePricing(
    (async () => {
      await deferToMacrotask();
      const started = Date.now();
      if (options.afterPageOverlays) {
        await Promise.race([options.afterPageOverlays, delay(headstartMs)]);
      } else {
        await delay(headstartMs);
      }
      // Head-start / overlays raced — release P0 reserve for P1/P2 capacity.
      markPricingRunPage1Settled(pricingRun.runId);

      if (process.env.VACATIONWEB_RESULTS_TIMING === '1') {
        console.info(
          '[results-timing]',
          JSON.stringify({
            phase: 'matchset-live-deferred-start',
            matchset: matchset.length,
            scope: 'p1-then-p2',
            pricingRunId: pricingRun.runId,
            waitedMs: Date.now() - started,
            headstartMs,
            hadAfter: Boolean(options.afterPageOverlays),
            cheapestFirst: useUnifiedDiscovery,
            unifiedDiscovery: useUnifiedDiscovery,
          }),
        );
      }

      // P1: coverage milestone 150 proven B (does not stop generation pricing).
      const p1 = await runS6DynamicRefill(matchset, params, {
        fetchImpl: options.fetchImpl,
        pricingRunId: pricingRun.runId,
        lane: 'P1',
      });

      // P2: demand-driven warm — continues after 150 while run is active.
      await runP2BackgroundWarm(matchset, params, {
        fetchImpl: options.fetchImpl,
        pricingRunId: pricingRun.runId,
        startCursor: 0,
      });

      if (process.env.VACATIONWEB_RESULTS_TIMING === '1') {
        console.info(
          '[results-timing]',
          JSON.stringify({
            phase: 'matchset-live-orchestrator-done',
            pricingRunId: pricingRun.runId,
            p1Stop: p1.telemetry.stopReason,
            p1B: p1.telemetry.presentableB,
          }),
        );
      }
    })(),
  );
}
