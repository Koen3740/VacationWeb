/**
 * Fase L0 — per-step live-price timing / error telemetry.
 *
 * Observes only. Does not change pricing, caching, concurrency, or fail-closed gates.
 * Never records prices, DOB, or landing URL query strings.
 */

export type LivePriceStepProvider = 'sunweb' | 'eliza';

export type LivePriceStepEvent = {
  provider: LivePriceStepProvider;
  ok: boolean;
  reason?: string;
  /** Landing HTML fetch duration; omitted when context came from cache. */
  landingMs?: number;
  landingFromCache: boolean;
  /** Sunweb grouped availability only. */
  groupedMs?: number;
  /** GetPromotedPriceApi duration when called. */
  gppMs?: number;
  totalMs: number;
  http429Count: number;
  httpErrorStatuses: number[];
  /** Optional transport/undici code (e.g. UND_ERR_CONNECT_TIMEOUT). Observability only. */
  transportErrorCode?: string;
};

export type LivePriceStepTimingStats = {
  n: number;
  mean: number;
  p50: number;
  p95: number;
  min: number;
  max: number;
};

export type LivePriceStepProviderSnapshot = {
  events: number;
  ok: number;
  fail: number;
  http429: number;
  httpErrors: number;
  landingFromCache: number;
  landingFetched: number;
  totalMs: LivePriceStepTimingStats | null;
  landingMs: LivePriceStepTimingStats | null;
  groupedMs: LivePriceStepTimingStats | null;
  gppMs: LivePriceStepTimingStats | null;
  byReason: Record<string, number>;
  byTransportErrorCode: Record<string, number>;
};

export type LivePriceStepTelemetrySnapshot = {
  /** Fixed baseline knobs observed at snapshot time (not changed by L0). */
  baseline: {
    sunwebPage1Concurrency: number;
    elizaPage1Concurrency: number;
    contextItemIdCacheTtlMs: number;
  };
  byProvider: Record<LivePriceStepProvider, LivePriceStepProviderSnapshot>;
  recent: LivePriceStepEvent[];
};

const RING = 500;

const recent: LivePriceStepEvent[] = [];
const byProviderEvents = new Map<LivePriceStepProvider, LivePriceStepEvent[]>();

let baselineKnobs: LivePriceStepTelemetrySnapshot['baseline'] = {
  sunwebPage1Concurrency: 5,
  elizaPage1Concurrency: 5,
  contextItemIdCacheTtlMs: 2_000,
};

export function configureLivePriceStepTelemetryBaseline(
  knobs: Partial<LivePriceStepTelemetrySnapshot['baseline']>,
): void {
  baselineKnobs = { ...baselineKnobs, ...knobs };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

export function timingStats(values: number[]): LivePriceStepTimingStats | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    n: sorted.length,
    mean: Math.round(sum / sorted.length),
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    min: Math.round(sorted[0]!),
    max: Math.round(sorted[sorted.length - 1]!),
  };
}

function providerSnapshot(provider: LivePriceStepProvider): LivePriceStepProviderSnapshot {
  const events = byProviderEvents.get(provider) ?? [];
  const byReason: Record<string, number> = {};
  const byTransportErrorCode: Record<string, number> = {};
  let ok = 0;
  let fail = 0;
  let http429 = 0;
  let httpErrors = 0;
  let landingFromCache = 0;
  let landingFetched = 0;
  const totalMs: number[] = [];
  const landingMs: number[] = [];
  const groupedMs: number[] = [];
  const gppMs: number[] = [];

  for (const event of events) {
    if (event.ok) {
      ok += 1;
    } else {
      fail += 1;
    }
    http429 += event.http429Count;
    httpErrors += event.httpErrorStatuses.length;
    if (event.landingFromCache) {
      landingFromCache += 1;
    }
    if (typeof event.landingMs === 'number') {
      landingFetched += 1;
      landingMs.push(event.landingMs);
    }
    if (typeof event.groupedMs === 'number') {
      groupedMs.push(event.groupedMs);
    }
    if (typeof event.gppMs === 'number') {
      gppMs.push(event.gppMs);
    }
    totalMs.push(event.totalMs);
    if (event.reason) {
      byReason[event.reason] = (byReason[event.reason] ?? 0) + 1;
    }
    if (event.transportErrorCode) {
      byTransportErrorCode[event.transportErrorCode] =
        (byTransportErrorCode[event.transportErrorCode] ?? 0) + 1;
    }
  }

  return {
    events: events.length,
    ok,
    fail,
    http429,
    httpErrors,
    landingFromCache,
    landingFetched,
    totalMs: timingStats(totalMs),
    landingMs: timingStats(landingMs),
    groupedMs: timingStats(groupedMs),
    gppMs: timingStats(gppMs),
    byReason,
    byTransportErrorCode,
  };
}

function maybeLog(event: LivePriceStepEvent): void {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) {
    return;
  }
  const parts = [
    `[live-price-step] provider=${event.provider}`,
    `ok=${event.ok}`,
    event.reason ? `reason=${event.reason}` : null,
    `totalMs=${Math.round(event.totalMs)}`,
    `landingCache=${event.landingFromCache}`,
    typeof event.landingMs === 'number' ? `landingMs=${Math.round(event.landingMs)}` : null,
    typeof event.groupedMs === 'number' ? `groupedMs=${Math.round(event.groupedMs)}` : null,
    typeof event.gppMs === 'number' ? `gppMs=${Math.round(event.gppMs)}` : null,
    event.http429Count ? `http429=${event.http429Count}` : null,
    event.transportErrorCode ? `transport=${event.transportErrorCode}` : null,
  ].filter(Boolean);
  console.info(parts.join(' '));
}

export function recordLivePriceStepEvent(event: LivePriceStepEvent): void {
  const copy: LivePriceStepEvent = {
    ...event,
    httpErrorStatuses: [...event.httpErrorStatuses],
  };
  recent.push(copy);
  if (recent.length > RING) {
    recent.shift();
  }
  const list = byProviderEvents.get(event.provider) ?? [];
  list.push(copy);
  if (list.length > RING) {
    list.shift();
  }
  byProviderEvents.set(event.provider, list);
  maybeLog(copy);
}

export function getLivePriceStepTelemetrySnapshot(): LivePriceStepTelemetrySnapshot {
  return {
    baseline: { ...baselineKnobs },
    byProvider: {
      sunweb: providerSnapshot('sunweb'),
      eliza: providerSnapshot('eliza'),
    },
    recent: recent.map((event) => ({
      ...event,
      httpErrorStatuses: [...event.httpErrorStatuses],
    })),
  };
}

export function clearLivePriceStepTelemetryForTests(): void {
  recent.length = 0;
  byProviderEvents.clear();
}

/** Helper for clients: classify one HTTP status into telemetry counters. */
export function noteHttpStatus(
  status: number | undefined,
  into: { http429Count: number; httpErrorStatuses: number[] },
): void {
  if (status == null) {
    return;
  }
  if (status === 429) {
    into.http429Count += 1;
    into.httpErrorStatuses.push(429);
    return;
  }
  if (status >= 400) {
    into.httpErrorStatuses.push(status);
  }
}

export function nowMs(): number {
  return performance.now();
}
