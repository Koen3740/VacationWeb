/**
 * Fase B4 — per-provider live-price circuit breaker.
 * Opens after consecutive technical failures; half-opens after cool-down.
 * Does not substitute catalog € for live prices while open.
 */

export type LivePriceCircuitProvider = 'corendon' | 'sunweb' | 'eliza' | 'prijsvrij';

/** Consecutive technical failures before opening. */
export const LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD = 5;
/** How long the circuit stays open before a single probe is allowed. */
export const LIVE_PRICE_CIRCUIT_OPEN_MS = 30_000;

type CircuitState = {
  consecutiveFailures: number;
  openUntilMs: number;
};

const states = new Map<LivePriceCircuitProvider, CircuitState>();
let nowMsOverride: number | null = null;

function nowMs(): number {
  return nowMsOverride ?? Date.now();
}

function stateOf(provider: LivePriceCircuitProvider): CircuitState {
  let state = states.get(provider);
  if (!state) {
    state = { consecutiveFailures: 0, openUntilMs: 0 };
    states.set(provider, state);
  }
  return state;
}

/** True while the circuit is open (skip provider HTTP; treat as technical miss). */
export function isLivePriceCircuitOpen(provider: LivePriceCircuitProvider): boolean {
  const state = stateOf(provider);
  return nowMs() < state.openUntilMs;
}

export function recordLivePriceCircuitSuccess(provider: LivePriceCircuitProvider): void {
  const state = stateOf(provider);
  state.consecutiveFailures = 0;
  state.openUntilMs = 0;
}

export function recordLivePriceCircuitFailure(provider: LivePriceCircuitProvider): void {
  const state = stateOf(provider);
  state.consecutiveFailures += 1;
  if (state.consecutiveFailures >= LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD) {
    state.openUntilMs = nowMs() + LIVE_PRICE_CIRCUIT_OPEN_MS;
  }
}

/**
 * After open window elapses, allow one probe (half-open).
 * Callers that skip while open never reach this; a caller that sees closed after
 * cool-down runs one attempt and records success/failure normally.
 */
export function resetLivePriceCircuitForTests(): void {
  states.clear();
  nowMsOverride = null;
}

export function setLivePriceCircuitNowMsForTests(nowMsValue: number | null): void {
  nowMsOverride = nowMsValue;
}

export function getLivePriceCircuitSnapshotForTests(provider: LivePriceCircuitProvider): {
  consecutiveFailures: number;
  openUntilMs: number;
  open: boolean;
} {
  const state = stateOf(provider);
  return {
    consecutiveFailures: state.consecutiveFailures,
    openUntilMs: state.openUntilMs,
    open: isLivePriceCircuitOpen(provider),
  };
}
