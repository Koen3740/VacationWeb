/**
 * t334u: reads of the proven-B pool for the progressive Results count.
 * Same membership as the cards (bookableResultsMembership) plus the number of eligible
 * offers that are still unsettled (live pricing may still add B).
 * Read-only: starts no pricing, touches no run / admission state.
 *
 * Cost (measured t334u, 788-offer matchset): one overlay pass ~25-30 ms, the eligibility
 * walk ~76 ms (hasResultsLivePriceOverlay scans the L1 map per unsettled offer). So:
 *  - eligibility is computed ONCE per pool (baseline, kept as an index list); afterwards
 *    pending = baseline-eligible offers that still show no overlay in the single overlay
 *    pass (SF-026: exact per offer; no longer derived from a settled-count difference, which
 *    over-counted overlays of offers that were never eligible);
 *  - the reader is shared per (matchset, provider) so hero + section heading cost one read;
 *  - a read is skipped while the L1 version is unchanged and is reused for 300 ms.
 */
import type { SearchParams, TravelOffer } from '@/types/travel';
import { bookableMembershipFromOverlaid } from '@/lib/search/results-catalog-page';
import {
  applyResultsLivePriceOverlays,
  getResultsLivePriceCacheVersion,
} from '@/lib/search/results-live-price-cache';
import type { PoolProgressReading } from '@/lib/search/results-pool-progress';
import {
  canAttemptLivePrice,
  isLivePriceProviderOffer,
} from '@/lib/search/live-price-context-gate';
import { isOfferLivePriceCircuitOpen } from '@/lib/search/live-pricing-workset';
import { hasResultsLivePriceOverlay } from '@/lib/search/results-live-price-cache';

const REUSE_MS = 300;

/** Skip `compute` while the L1 version is unchanged (or the last read is < REUSE_MS old). */
export function memoizeByCacheVersion<T>(
  compute: () => T,
  options: {
    version?: () => number;
    now?: () => number;
    reuseMs?: number;
  } = {},
): () => T {
  const version = options.version ?? getResultsLivePriceCacheVersion;
  const now = options.now ?? Date.now;
  const reuseMs = options.reuseMs ?? REUSE_MS;
  let last: { value: T; version: number; at: number } | null = null;
  return () => {
    const v = version();
    const t = now();
    if (last && (last.version === v || t - last.at < reuseMs)) {
      return last.value;
    }
    last = { value: compute(), version: v, at: t };
    return last.value;
  };
}

/**
 * Indexes of offers that still need a live attempt (same predicates as
 * `countEligibleS6CandidatesFrom`: live provider, no overlay yet, attemptable, circuit closed).
 */
function listEligibleIndexes(ranked: readonly TravelOffer[], params: SearchParams): number[] {
  const indexes: number[] = [];
  for (let i = 0; i < ranked.length; i += 1) {
    const offer = ranked[i]!;
    if (!isLivePriceProviderOffer(offer, params)) continue;
    if (hasResultsLivePriceOverlay(offer.id, params)) continue;
    if (!canAttemptLivePrice(offer, params)) continue;
    if (isOfferLivePriceCircuitOpen(offer)) continue;
    indexes.push(i);
  }
  return indexes;
}

export function createResultsPoolReader(
  ranked: readonly TravelOffer[],
  params: SearchParams,
  memo?: { now?: () => number; reuseMs?: number },
): () => PoolProgressReading {
  let eligibleIndexes: number[] | null = null;
  return memoizeByCacheVersion((): PoolProgressReading => {
    if (ranked.length === 0) {
      return { count: 0, pending: 0, complete: true };
    }
    const overlaid = applyResultsLivePriceOverlays(ranked as TravelOffer[], params);
    const count = bookableMembershipFromOverlaid(overlaid, params).length;
    if (eligibleIndexes === null) {
      eligibleIndexes = listEligibleIndexes(ranked, params);
    }
    let pending = 0;
    for (const i of eligibleIndexes) {
      // applyResultsLivePriceOverlay returns the SAME object when no overlay exists.
      if (overlaid[i] === ranked[i]) pending += 1;
    }
    return { count, pending, complete: pending === 0 };
  }, memo);
}

const sharedReaders = new WeakMap<
  readonly TravelOffer[],
  Map<string, () => PoolProgressReading>
>();

/** One reader per (matchset array, provider filter): hero + section share it. */
export function getSharedResultsPoolReader(
  ranked: readonly TravelOffer[],
  params: SearchParams,
): () => PoolProgressReading {
  const key = params.provider ?? '';
  let perMatchset = sharedReaders.get(ranked);
  if (!perMatchset) {
    perMatchset = new Map();
    sharedReaders.set(ranked, perMatchset);
  }
  let reader = perMatchset.get(key);
  if (!reader) {
    reader = createResultsPoolReader(ranked, params);
    perMatchset.set(key, reader);
  }
  return reader;
}
