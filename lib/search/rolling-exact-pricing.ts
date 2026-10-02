/**
 * Rolling exact-pricing window for S6 / P2.
 *
 * priceExactBatch is a barrier: every batch of up to LIVE_PRICE_EXACT_BATCH_MAX offers waits
 * for its slowest provider call before the next offers are admitted, so provider slots sit
 * idle (measured t337u: ~4.3 effective parallelism of 8). This window keeps the SAME ceilings
 * (total in-flight <= LIVE_PRICE_EXACT_BATCH_MAX, per-provider caps from
 * exactPricingProviderLane, Corendon shared pool still authoritative) but refills a freed
 * slot immediately. Demand-driven: the caller admits one offer at a time in strict rank
 * order; nothing is pre-queued. One priceExactBatch([offer]) per offer keeps classification,
 * circuit/breaker, cache and A/B/C semantics byte-identical to the batch path.
 */

import type { FetchLike } from '@/lib/providers/prijsvrij/auth';
import {
  exactPricingProviderLane,
  priceExactBatch,
} from '@/lib/providers/prijsvrij/page1-receipt-pricing';
import { LIVE_PRICE_EXACT_BATCH_MAX, type PricingLane } from '@/lib/search/live-pricing-admission';
import type { SearchParams, TravelOffer } from '@/types/travel';

export type RollingExactPricerOptions = {
  fetchImpl?: FetchLike;
  pricingRunId?: number;
  lane?: PricingLane;
  /** Max offers in flight (default and ceiling: LIVE_PRICE_EXACT_BATCH_MAX). */
  window?: number;
};

export type RollingExactPricer = {
  readonly inFlight: number;
  /** True when a free total slot AND a free slot of this offer's provider exist. */
  canAdmit(offer: TravelOffer): boolean;
  admit(offer: TravelOffer): void;
  /** Resolves when at least one offer settled since the last takeSettled (or nothing is in flight). */
  nextSettled(): Promise<void>;
  /** Offers settled since the previous call. */
  takeSettled(): number;
  /** Wait for every in-flight offer (no new admits). */
  drain(): Promise<void>;
};

export function createRollingExactPricer(
  params: SearchParams,
  options: RollingExactPricerOptions = {},
): RollingExactPricer {
  const windowSize = Math.max(
    1,
    Math.min(options.window ?? LIVE_PRICE_EXACT_BATCH_MAX, LIVE_PRICE_EXACT_BATCH_MAX),
  );
  const priceOptions = {
    fetchImpl: options.fetchImpl,
    pricingRunId: options.pricingRunId,
    lane: options.lane,
  };
  const perProvider = new Map<string, number>();
  const flights = new Set<Promise<void>>();
  let settled = 0;
  let waiters: Array<() => void> = [];

  return {
    get inFlight() {
      return flights.size;
    },
    canAdmit(offer) {
      if (flights.size >= windowSize) {
        return false;
      }
      const lane = exactPricingProviderLane(offer);
      return (perProvider.get(lane.key) ?? 0) < lane.cap;
    },
    admit(offer) {
      const lane = exactPricingProviderLane(offer);
      perProvider.set(lane.key, (perProvider.get(lane.key) ?? 0) + 1);
      const flight: Promise<void> = priceExactBatch([offer], params, priceOptions)
        .then(
          () => undefined,
          (error: unknown) => {
            console.warn(
              '[rolling-exact-pricing] offer failed',
              error instanceof Error ? error.message : String(error),
            );
          },
        )
        .then(() => {
          flights.delete(flight);
          perProvider.set(lane.key, Math.max(0, (perProvider.get(lane.key) ?? 1) - 1));
          settled += 1;
          const wake = waiters;
          waiters = [];
          for (const resolve of wake) {
            resolve();
          }
        });
      flights.add(flight);
    },
    nextSettled() {
      if (settled > 0 || flights.size === 0) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        waiters.push(resolve);
      });
    },
    takeSettled() {
      const n = settled;
      settled = 0;
      return n;
    },
    async drain() {
      while (flights.size > 0) {
        await Promise.allSettled([...flights]);
      }
    },
  };
}
