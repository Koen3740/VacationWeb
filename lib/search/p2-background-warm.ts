/**
 * P2 — demand-driven background live-price warming after P1 (150 B milestone).
 *
 * Does NOT stop at 150 presentable B. Continues while the pricing run is active
 * and eligible candidates remain. Never pre-enqueues the full matchset.
 */

import type { FetchLike } from '@/lib/providers/prijsvrij/auth';
import { createRollingExactPricer } from '@/lib/search/rolling-exact-pricing';
import {
  assertCanAdmit,
  LIVE_PRICE_EXACT_BATCH_MAX,
} from '@/lib/search/live-pricing-admission';
import { selectS6RefillBatch } from '@/lib/search/s6-dynamic-refill';
import type { SearchParams, TravelOffer } from '@/types/travel';

export type P2WarmTelemetry = {
  batches: number;
  attempts: number;
  stopReason: 'exhausted' | 'superseded' | 'no_progress' | 'max_batches';
  durationMs: number;
};

export type RunP2BackgroundWarmOptions = {
  fetchImpl?: FetchLike;
  pricingRunId: number;
  startCursor?: number;
  /** Max offers per admit batch (default LIVE_PRICE_EXACT_BATCH_MAX = 8). */
  batchSize?: number;
  /** Safety: absolute max batches in one P2 invocation (not a 150-B stop). */
  maxBatches?: number;
  /** Unused since the rolling window (select-to-end never yields empty batches); kept for callers. */
  maxEmptyBatches?: number;
};

const P2_DEFAULT_MAX_BATCHES = 50_000;

/**
 * Walk matchset in discovery order, admitting small eligible batches until
 * exhausted or the pricing run is superseded.
 */
export async function runP2BackgroundWarm(
  catalogRanked: readonly TravelOffer[],
  params: SearchParams,
  options: RunP2BackgroundWarmOptions,
): Promise<P2WarmTelemetry> {
  const t0 = Date.now();
  const batchSize = Math.max(
    1,
    Math.min(options.batchSize ?? LIVE_PRICE_EXACT_BATCH_MAX, LIVE_PRICE_EXACT_BATCH_MAX),
  );
  const maxBatches = options.maxBatches ?? P2_DEFAULT_MAX_BATCHES;
  const runId = options.pricingRunId;

  let cursor = Math.max(0, options.startCursor ?? 0);
  let batches = 0;
  let attempts = 0;
  let stopReason: P2WarmTelemetry['stopReason'] = 'exhausted';

  // Rolling window (t337u): same ceilings as the old batch loop (batchSize in flight, per-provider
  // caps, Corendon shared pool) but a freed slot is refilled immediately. Strict rank order.
  const pricer = createRollingExactPricer(params, {
    fetchImpl: options.fetchImpl,
    pricingRunId: runId,
    lane: 'P2',
    window: batchSize,
  });
  const maxAttempts = maxBatches * batchSize;
  let head: TravelOffer | null = null;

  while (assertCanAdmit(runId)) {
    while (attempts < maxAttempts && assertCanAdmit(runId)) {
      if (head == null) {
        const selected = selectS6RefillBatch(catalogRanked, params, cursor, 1);
        cursor = selected.nextCursor;
        head = selected.batch[0] ?? null;
        if (head == null) {
          break;
        }
      }
      if (!pricer.canAdmit(head)) {
        break;
      }
      pricer.admit(head);
      head = null;
      attempts += 1;
    }
    if (pricer.inFlight === 0) {
      if (head != null && attempts >= maxAttempts) {
        stopReason = 'max_batches';
      }
      break;
    }
    await pricer.nextSettled();
    pricer.takeSettled();
  }
  await pricer.drain();
  batches = Math.ceil(attempts / batchSize);

  if (
    !assertCanAdmit(runId) &&
    stopReason === 'exhausted' &&
    (cursor < catalogRanked.length || head != null)
  ) {
    stopReason = 'superseded';
  }

  return {
    batches,
    attempts,
    stopReason,
    durationMs: Date.now() - t0,
  };
}
