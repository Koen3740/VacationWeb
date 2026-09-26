/**
 * GO11: schedule FULL-matchset live pricing AFTER page overlays have started.
 * Page work must never wait behind matchset-wide hydrate/live HTTP.
 * GO5 latency kept: macrotask defer so page overlays claim concurrency first.
 * Cap ≤150 on background scope is REVERTED — whole pool is warmed.
 *
 * GO11-followup: wait for page-1 overlay settlement OR a short head-start delay
 * BEFORE full-pool HTTP so cold page-1 is not starved. Still fire-and-forget.
 */
import type { FetchLike } from '../providers/prijsvrij/auth';
import { priceLiveRequiredMatchset } from '../providers/prijsvrij/page1-receipt-pricing';
import { scheduleResultsMatchsetLivePricing } from './schedule-results-matchset-live-pricing';
import { runS6DynamicRefill } from './s6-dynamic-refill';
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
   * Shared live-pricing pool (Default): walk the matchset cheap-first by catalogue
   * price — S6 refill toward 150 in-budget B first, then the full-pool warm in the
   * same order. Cached / in-flight offers are skipped as usual.
   */
  cheapestFirst?: boolean;
};

/** Matchset in ascending catalogue price (stable; same offer objects). */
export function orderMatchsetCheapestFirst(ranked: readonly TravelOffer[]): TravelOffer[] {
  return ranked
    .map((offer, index) => ({ offer, index }))
    .sort((a, b) => a.offer.price - b.offer.price || a.index - b.index)
    .map(({ offer }) => offer);
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
  const matchset = options.cheapestFirst
    ? orderMatchsetCheapestFirst(ranked)
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
            cheapestFirst: Boolean(options.cheapestFirst),
          }),
        );
      }
      if (options.cheapestFirst) {
        await runS6DynamicRefill(matchset, params, { fetchImpl: options.fetchImpl });
      }
      await priceLiveRequiredMatchset(matchset, params, {
        fetchImpl: options.fetchImpl,
      });
    })(),
  );
}
