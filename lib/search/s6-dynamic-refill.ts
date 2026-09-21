/**
 * S6 — Dynamic live-pricing refill toward 150 presentable B results.
 *
 * Product target: {@link S6_TARGET_PRESENTABLE_B} proven live B's (not attempts).
 * AN-057 TARGET 10/20 were research-only and must not stop the product path.
 *
 * Cursor walks the catalog-ranked filter matchset; respects cache, DEC-011,
 * missing-context gate (CHG-039), and circuit-open skip (CHG-039).
 * Does not reshuffle frozen page1 — runs after initial workset via background.
 */

import type { FetchLike } from '@/lib/providers/prijsvrij/auth';
import { priceLiveRequiredMatchset } from '@/lib/providers/prijsvrij/page1-receipt-pricing';
import { RESULTS_LIVE_PRICING_INITIAL_WORKSET } from '@/lib/search/pagination';
import {
  canAttemptLivePrice,
  isLivePriceProviderOffer,
} from '@/lib/search/live-price-context-gate';
import { isOfferLivePriceCircuitOpen } from '@/lib/search/live-pricing-workset';
import {
  applyResultsLivePriceOverlays,
  hasResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import { hasValidPresentablePrice } from '@/lib/search/presentable-price';
import type { SearchParams, TravelOffer } from '@/types/travel';

/** Product stop: 15 pages × 10 cards with proven live B. */
export const S6_TARGET_PRESENTABLE_B = 150;

/**
 * Absolute cap on NEW offers submitted to pricing during one S6 run.
 * Caps attempts (HTTP-bound work), NOT B count — must not silently stop at 50/100 B.
 * Natural stop earlier when candidates are exhausted.
 */
export const S6_MAX_NEW_ATTEMPTS = 500;

/** Max consecutive refill batches that yield 0 new B before giving up. */
export const S6_MAX_EMPTY_BATCHES = 3;

export type S6StopReason =
  | 'target_met'
  | 'matchset_exhausted'
  | 'no_eligible_candidates'
  | 'max_attempts'
  | 'no_progress'
  | 'already_met';

export type S6RefillTelemetry = {
  targetB: number;
  presentableB: number;
  deficit: number;
  attempts: number;
  batches: number;
  candidatesConsumed: number;
  candidatesRemaining: number;
  eligibleCandidateCount: number;
  skippedMissingContext: number;
  skippedCircuitOpen: number;
  skippedCachedOrSettled: number;
  stopReason: S6StopReason;
  durationMs: number;
};

export type S6RefillResult = {
  telemetry: S6RefillTelemetry;
};

export function countPresentableB(
  offers: readonly TravelOffer[],
  params: SearchParams,
): number {
  return applyResultsLivePriceOverlays(offers as TravelOffer[], params).filter(
    hasValidPresentablePrice,
  ).length;
}

/**
 * Next S6 candidates in catalog rank order that still need a live attempt.
 * Skips: non-live providers, missing context, open circuit, already-settled overlays.
 */
export function selectS6RefillBatch(
  catalogRanked: readonly TravelOffer[],
  params: SearchParams,
  cursor: number,
  limit: number,
): {
  batch: TravelOffer[];
  nextCursor: number;
  skippedMissingContext: number;
  skippedCircuitOpen: number;
  skippedCachedOrSettled: number;
} {
  const batch: TravelOffer[] = [];
  let i = cursor;
  let skippedMissingContext = 0;
  let skippedCircuitOpen = 0;
  let skippedCachedOrSettled = 0;

  while (i < catalogRanked.length && batch.length < limit) {
    const offer = catalogRanked[i]!;
    i += 1;

    if (!isLivePriceProviderOffer(offer, params)) {
      continue;
    }

    if (hasResultsLivePriceOverlay(offer.id, params)) {
      skippedCachedOrSettled += 1;
      continue;
    }

    if (!canAttemptLivePrice(offer, params)) {
      skippedMissingContext += 1;
      continue;
    }

    if (isOfferLivePriceCircuitOpen(offer)) {
      skippedCircuitOpen += 1;
      continue;
    }

    batch.push(offer);
  }

  return {
    batch,
    nextCursor: i,
    skippedMissingContext,
    skippedCircuitOpen,
    skippedCachedOrSettled,
  };
}

/** How many eligible (priceable, not yet settled) candidates remain from cursor. */
export function countEligibleS6CandidatesFrom(
  catalogRanked: readonly TravelOffer[],
  params: SearchParams,
  cursor: number,
): number {
  let n = 0;
  for (let i = cursor; i < catalogRanked.length; i += 1) {
    const offer = catalogRanked[i]!;
    if (!isLivePriceProviderOffer(offer, params)) {
      continue;
    }
    if (hasResultsLivePriceOverlay(offer.id, params)) {
      continue;
    }
    if (!canAttemptLivePrice(offer, params)) {
      continue;
    }
    if (isOfferLivePriceCircuitOpen(offer)) {
      continue;
    }
    n += 1;
  }
  return n;
}

function batchSizeForDeficit(deficit: number, remainingEligible: number): number {
  if (deficit <= 0 || remainingEligible <= 0) {
    return 0;
  }
  // Price only what we still need (bounded by workset width) — no blind +150.
  return Math.min(deficit, RESULTS_LIVE_PRICING_INITIAL_WORKSET, remainingEligible);
}

function maybeLogS6(telemetry: S6RefillTelemetry): void {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) {
    return;
  }
  console.info(
    `[s6-refill] stop=${telemetry.stopReason}` +
      ` B=${telemetry.presentableB}/${telemetry.targetB}` +
      ` deficit=${telemetry.deficit}` +
      ` attempts=${telemetry.attempts}` +
      ` batches=${telemetry.batches}` +
      ` consumed=${telemetry.candidatesConsumed}` +
      ` remaining=${telemetry.candidatesRemaining}` +
      ` skipCtx=${telemetry.skippedMissingContext}` +
      ` skipCircuit=${telemetry.skippedCircuitOpen}` +
      ` ms=${telemetry.durationMs}`,
  );
}

function emitS6Telemetry(telemetry: S6RefillTelemetry): S6RefillResult {
  maybeLogS6(telemetry);
  // AN-064: persist last S6 coverage for ops cockpit.
  void import('@/lib/ops/live-pricing/store')
    .then((m) => m.recordOpsS6Telemetry(telemetry))
    .catch(() => undefined);
  return { telemetry };
}

export type RunS6DynamicRefillOptions = {
  fetchImpl?: FetchLike;
  /** Start cursor into catalogRanked (offers before this are already considered). */
  startCursor?: number;
  targetB?: number;
  maxNewAttempts?: number;
  maxEmptyBatches?: number;
};

/**
 * Walk catalogRanked from cursor, pricing bounded batches until 150 B or a hard stop.
 * Intended for background after the initial workset await (page1 freeze unchanged).
 */
export async function runS6DynamicRefill(
  catalogRanked: readonly TravelOffer[],
  params: SearchParams,
  options: RunS6DynamicRefillOptions = {},
): Promise<S6RefillResult> {
  const t0 = Date.now();
  const targetB = options.targetB ?? S6_TARGET_PRESENTABLE_B;
  const maxNewAttempts = options.maxNewAttempts ?? S6_MAX_NEW_ATTEMPTS;
  const maxEmptyBatches = options.maxEmptyBatches ?? S6_MAX_EMPTY_BATCHES;

  let cursor = Math.max(0, options.startCursor ?? 0);
  let attempts = 0;
  let batches = 0;
  let candidatesConsumed = 0;
  let skippedMissingContext = 0;
  let skippedCircuitOpen = 0;
  let skippedCachedOrSettled = 0;
  let emptyBatches = 0;
  let stopReason: S6StopReason = 'matchset_exhausted';

  const eligibleCandidateCount = countEligibleS6CandidatesFrom(catalogRanked, params, 0);

  let presentableB = countPresentableB(catalogRanked, params);
  if (presentableB >= targetB) {
    const telemetry: S6RefillTelemetry = {
      targetB,
      presentableB,
      deficit: 0,
      attempts: 0,
      batches: 0,
      candidatesConsumed: 0,
      candidatesRemaining: countEligibleS6CandidatesFrom(catalogRanked, params, cursor),
      eligibleCandidateCount,
      skippedMissingContext: 0,
      skippedCircuitOpen: 0,
      skippedCachedOrSettled: 0,
      stopReason: 'already_met',
      durationMs: Date.now() - t0,
    };
    return emitS6Telemetry(telemetry);
  }

  if (eligibleCandidateCount === 0 && presentableB < targetB) {
    const telemetry: S6RefillTelemetry = {
      targetB,
      presentableB,
      deficit: Math.max(0, targetB - presentableB),
      attempts: 0,
      batches: 0,
      candidatesConsumed: 0,
      candidatesRemaining: 0,
      eligibleCandidateCount: 0,
      skippedMissingContext: 0,
      skippedCircuitOpen: 0,
      skippedCachedOrSettled: 0,
      stopReason: 'no_eligible_candidates',
      durationMs: Date.now() - t0,
    };
    return emitS6Telemetry(telemetry);
  }

  while (presentableB < targetB) {
    const deficit = targetB - presentableB;
    const remainingEligible = countEligibleS6CandidatesFrom(catalogRanked, params, cursor);
    if (remainingEligible === 0) {
      stopReason = cursor >= catalogRanked.length ? 'matchset_exhausted' : 'no_eligible_candidates';
      break;
    }

    const limit = batchSizeForDeficit(deficit, remainingEligible);
    if (limit <= 0) {
      stopReason = 'target_met';
      break;
    }

    if (attempts >= maxNewAttempts) {
      stopReason = 'max_attempts';
      break;
    }

    const take = Math.min(limit, maxNewAttempts - attempts);
    const selected = selectS6RefillBatch(catalogRanked, params, cursor, take);
    cursor = selected.nextCursor;
    skippedMissingContext += selected.skippedMissingContext;
    skippedCircuitOpen += selected.skippedCircuitOpen;
    skippedCachedOrSettled += selected.skippedCachedOrSettled;

    if (selected.batch.length === 0) {
      // Cursor advanced past only skips — continue until exhausted or no progress.
      if (cursor >= catalogRanked.length) {
        stopReason = 'matchset_exhausted';
        break;
      }
      emptyBatches += 1;
      if (emptyBatches >= maxEmptyBatches) {
        stopReason = 'no_progress';
        break;
      }
      continue;
    }

    const bBefore = presentableB;
    await priceLiveRequiredMatchset(selected.batch, params, {
      fetchImpl: options.fetchImpl,
    });
    attempts += selected.batch.length;
    candidatesConsumed += selected.batch.length;
    batches += 1;
    presentableB = countPresentableB(catalogRanked, params);

    if (presentableB >= targetB) {
      stopReason = 'target_met';
      break;
    }

    if (presentableB <= bBefore) {
      emptyBatches += 1;
      if (emptyBatches >= maxEmptyBatches) {
        stopReason = 'no_progress';
        break;
      }
    } else {
      emptyBatches = 0;
    }

    if (attempts >= maxNewAttempts) {
      stopReason = 'max_attempts';
      break;
    }
  }

  if (presentableB >= targetB) {
    stopReason = 'target_met';
  }

  const telemetry: S6RefillTelemetry = {
    targetB,
    presentableB,
    deficit: Math.max(0, targetB - presentableB),
    attempts,
    batches,
    candidatesConsumed,
    candidatesRemaining: countEligibleS6CandidatesFrom(catalogRanked, params, cursor),
    eligibleCandidateCount,
    skippedMissingContext,
    skippedCircuitOpen,
    skippedCachedOrSettled,
    stopReason,
    durationMs: Date.now() - t0,
  };
  return emitS6Telemetry(telemetry);
}

/** Cursor index after the given priced prefix (for starting S6 past the initial window). */
export function s6CursorAfterOffers(
  catalogRanked: readonly TravelOffer[],
  pricedPrefix: readonly TravelOffer[],
): number {
  if (pricedPrefix.length === 0) {
    return 0;
  }
  const lastId = pricedPrefix[pricedPrefix.length - 1]?.id;
  if (!lastId) {
    return 0;
  }
  const idx = catalogRanked.findIndex((offer) => offer.id === lastId);
  return idx >= 0 ? idx + 1 : pricedPrefix.length;
}
