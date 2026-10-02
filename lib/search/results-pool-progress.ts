/**
 * Results count progress (t334u): replaces the t333u fixed 8 s heading wait loop.
 *
 * Problem (measured t334u): the heading / pagination are one-shot server renders of the
 * proven-B pool at an arbitrary moment (first B, or after an unbudgeted full-matchset
 * L2 hydrate = ~12 s at 788 offers, 98 s at 6,825). Cards stream per B, the count did not.
 *
 * Now the count is a bounded SEQUENCE of server-streamed steps, every step read from the
 * SAME L1 overlay state the cards fill (bookableResultsMembership). Each step is only
 * emitted when the proven value changed (min 1 s apart), the last step ends the stream:
 *  - complete : nothing eligible is left unsettled (no more B can arrive) -> definitive;
 *  - idle     : no progress for IDLE_MS (pricing stalled / superseded) -> stop;
 *  - max      : hard cap MAX_MS (a response must not stay open forever).
 * `checking` ("meer worden gecontroleerd") is only true while provable: still eligible
 * unsettled offers AND progress observed within IDLE_MS.
 *
 * Read-only: starts no live pricing, touches no pricing run / admission / P2 warm.
 */
export const POOL_PROGRESS_POLL_MS = 500;
export const POOL_PROGRESS_MIN_STEP_MS = 1000;
export const POOL_PROGRESS_IDLE_MS = 10_000;
export const POOL_PROGRESS_MAX_MS = 120_000;
/**
 * A read may use at most ~1/POLL_COST_FACTOR of the event loop: the next poll waits at
 * least POLL_COST_FACTOR x the duration of the previous read (t334u: a naive 0.5 s poll
 * of three streams cost ~50% of a core on a 788-offer matchset and slowed live pricing).
 */
export const POOL_PROGRESS_POLL_COST_FACTOR = 40;

export type PoolProgressReading = {
  /** Proven value to show (proven B count, or browse total). */
  count: number;
  /**
   * Eligible offers still unsettled (live pricing can still change the count).
   * `null` = unknown (progress is then judged by `count` changes only).
   */
  pending: number | null;
  /** True when nothing can grow any more (pending 0, or a cap was reached). */
  complete: boolean;
};

export type PoolProgressStep = {
  count: number;
  complete: boolean;
  /** Provable "more are being checked" state at this moment. */
  checking: boolean;
  /** Last step of the stream. */
  final: boolean;
  /** False only for a final step that repeats the previously emitted one. */
  changed: boolean;
};

export type PoolProgressTracker = { next(): Promise<PoolProgressStep> };

export function createPoolProgressTracker(args: {
  read: () => PoolProgressReading;
  pollMs?: number;
  minStepMs?: number;
  idleMs?: number;
  maxMs?: number;
  /** Injectable for deterministic tests. */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): PoolProgressTracker {
  const now = args.now ?? Date.now;
  const sleep =
    args.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const pollMs = args.pollMs && args.pollMs > 0 ? args.pollMs : POOL_PROGRESS_POLL_MS;
  const minStepMs = args.minStepMs ?? POOL_PROGRESS_MIN_STEP_MS;
  const idleMs = args.idleMs ?? POOL_PROGRESS_IDLE_MS;
  const maxMs = args.maxMs ?? POOL_PROGRESS_MAX_MS;
  const startedAt = now();

  let lastKey: string | null = null;
  let lastProgressAt = startedAt;
  let emitted: { count: number; checking: boolean } | null = null;
  let emittedAt = startedAt;

  return {
    async next(): Promise<PoolProgressStep> {
      for (;;) {
        const readStartedAt = now();
        const reading = args.read();
        const t = now();
        const readCostMs = Math.max(0, t - readStartedAt);
        const key = `${reading.count}|${reading.pending ?? 'u'}`;
        if (key !== lastKey) {
          lastKey = key;
          lastProgressAt = t;
        }
        const idle = !reading.complete && t - lastProgressAt >= idleMs;
        const maxed = !reading.complete && t - startedAt >= maxMs;
        const final = reading.complete || idle || maxed;
        const stillMoving = !idle && t - lastProgressAt < idleMs;
        // SF-025: a FINAL step (complete, idle or capped at MAX) never claims "more is being checked":
        // nothing updates this response afterwards, so the claim would stay on screen for good.
        const checking =
          !final && !reading.complete && stillMoving && (reading.pending === null || reading.pending > 0);

        const differs =
          emitted === null || emitted.count !== reading.count || emitted.checking !== checking;
        if (emitted === null || final || (differs && t - emittedAt >= minStepMs)) {
          const changed = emitted === null || differs;
          emitted = { count: reading.count, checking };
          emittedAt = t;
          return { count: reading.count, complete: reading.complete, checking, final, changed };
        }
        await sleep(Math.max(pollMs, readCostMs * POOL_PROGRESS_POLL_COST_FACTOR));
      }
    },
  };
}
