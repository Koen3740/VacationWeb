/**
 * Minimal L2 live-price store observability (AN-076).
 * Counters only — no secrets, no offer payloads.
 */

export type LivePriceL2Event =
  | 'L1_HIT'
  | 'L2_HIT'
  | 'L2_MISS'
  | 'PROVIDER_FETCH'
  | 'INFLIGHT_JOIN'
  | 'LOCK_CLAIM'
  | 'LOCK_WAIT'
  | 'STORE_ERROR'
  | 'L2_WRITE';

const counts: Record<LivePriceL2Event, number> = {
  L1_HIT: 0,
  L2_HIT: 0,
  L2_MISS: 0,
  PROVIDER_FETCH: 0,
  INFLIGHT_JOIN: 0,
  LOCK_CLAIM: 0,
  LOCK_WAIT: 0,
  STORE_ERROR: 0,
  L2_WRITE: 0,
};

export function noteLivePriceL2Event(event: LivePriceL2Event): void {
  counts[event] += 1;
}

export function getLivePriceL2ObservabilitySnapshot(): Record<LivePriceL2Event, number> {
  return { ...counts };
}

export function clearLivePriceL2ObservabilityForTests(): void {
  for (const key of Object.keys(counts) as LivePriceL2Event[]) {
    counts[key] = 0;
  }
}
