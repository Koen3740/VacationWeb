/**
 * P2 — demand-driven background live-price warming after P1 (150 B milestone).
 *
 * Does NOT stop at 150 presentable B. Continues while the pricing run is active
 * and eligible candidates remain. Never pre-enqueues the full matchset.
 */

import type { FetchLike } from '@/lib/providers/prijsvrij/auth';
import { priceExactBatch } from '@/lib/providers/prijsvrij/page1-receipt-pricing';
import {
  assertCanAdmit,
  LIVE_PRICE_EXACT_BATCH_MAX,
} from '@/lib/search/live-pricing-admission';
import {
  selectS6RefillBatch,
  S6_MAX_EMPTY_BATCHES,
} from '@/lib/search/s6-dynamic-refill';
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
  const maxEmptyBatches = options.maxEmptyBatches ?? S6_MAX_EMPTY_BATCHES;
  const runId = options.pricingRunId;

  let cursor = Math.max(0, options.startCursor ?? 0);
  let batches = 0;
  let attempts = 0;
  let emptyBatches = 0;
  let stopReason: P2WarmTelemetry['stopReason'] = 'exhausted';

  while (assertCanAdmit(runId)) {
    if (batches >= maxBatches) {
      stopReason = 'max_batches';
      break;
    }

    const selected = selectS6RefillBatch(catalogRanked, params, cursor, batchSize);
    cursor = selected.nextCursor;

    if (selected.batch.length === 0) {
      if (cursor >= catalogRanked.length) {
        stopReason = 'exhausted';
        break;
      }
      emptyBatches += 1;
      if (emptyBatches >= maxEmptyBatches) {
        stopReason = 'no_progress';
        break;
      }
      continue;
    }

    if (!assertCanAdmit(runId)) {
      stopReason = 'superseded';
      break;
    }

    emptyBatches = 0;
    await priceExactBatch(selected.batch, params, {
      fetchImpl: options.fetchImpl,
      pricingRunId: runId,
      lane: 'P2',
    });
    attempts += selected.batch.length;
    batches += 1;
  }

  if (!assertCanAdmit(runId) && stopReason === 'exhausted' && cursor < catalogRanked.length) {
    stopReason = 'superseded';
  }

  return {
    batches,
    attempts,
    stopReason,
    durationMs: Date.now() - t0,
  };
}
