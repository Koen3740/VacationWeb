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
  | 'L2_WRITE'
  /** D-v2 S2: R2 read hit its deadline (also counted as STORE_ERROR). */
  | 'L2_TIMEOUT'
  /** D-v2 S2: R2 op skipped because the R2 circuit is open. */
  | 'L2_SKIPPED'
  /** D-v2 S2: R2 circuit transitioned to open. */
  | 'L2_CIRCUIT_OPEN'
  /** D-v2 S2: record read joined an in-flight read (single-flight). */
  | 'L2_READ_JOIN';

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
  L2_TIMEOUT: 0,
  L2_SKIPPED: 0,
  L2_CIRCUIT_OPEN: 0,
  L2_READ_JOIN: 0,
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
