/**
 * AN-076 — L1 + L2 shared live-price store tests (memory backend).
 */
import assert from 'node:assert/strict';
import { afterEach, test, type TestContext } from 'node:test';
import {
  RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS,
  RESULTS_LIVE_PRICE_TTL_MS,
  clearResultsLivePriceCache,
  getResultsLivePriceOverlay,
  hasResultsLivePriceOverlay,
  hydrateResultsLivePriceOverlaysFromL2,
  livePriceCacheKey,
  setResultsLivePriceNowMsForTests,
  setResultsLivePriceOverlay,
} from './results-live-price-cache';
import {
  LIVE_PRICE_L2_CONNECT_TIMEOUT_MS,
  LIVE_PRICE_L2_GATE_R2_BUDGET_MS,
  LIVE_PRICE_L2_LOCK_OP_TIMEOUT_MS,
  LIVE_PRICE_L2_LOCK_POLL_MS,
  LIVE_PRICE_L2_LOCK_RELEASE_TIMEOUT_MS,
  LIVE_PRICE_L2_LOCK_TTL_MS,
  LIVE_PRICE_L2_MAX_ATTEMPTS,
  LIVE_PRICE_L2_RECORD_READ_TIMEOUT_MS,
  LIVE_PRICE_L2_REQUEST_TIMEOUT_MS,
  LIVE_PRICE_L2_SCHEMA_VERSION,
  LIVE_PRICE_L2_WRITE_TIMEOUT_MS,
  buildLivePriceL2S3Client,
  getLivePriceL2CircuitSnapshotForTests,
  getLivePriceL2InflightReadCountForTests,
  getLivePriceL2MemoryBackendForTests,
  isLivePriceL2Enabled,
  livePriceL2LockObjectKey,
  LIVE_PRICE_L2_CIRCUIT_OPEN_MS,
  LIVE_PRICE_L2_INFLIGHT_READ_CAP,
  readLivePriceL2Record,
  readLivePriceL2RecordResult,
  releaseLivePriceL2Lock,
  resetLivePriceL2CircuitForTests,
  resetLivePriceL2MemoryBackendForTests,
  setLivePriceL2BackendForTests,
  setLivePriceL2EnabledForTests,
  tryClaimLivePriceL2Lock,
  waitForLivePriceL2Record,
  withLivePriceL2ProviderGate,
  writeLivePriceL2Record,
  type LivePriceL2Backend,
  type LivePriceL2Record,
} from './live-price-l2-store';
import {
  clearLivePriceL2ObservabilityForTests,
  getLivePriceL2ObservabilitySnapshot,
} from './live-price-l2-observability';

const occupancy = { adults: 2, children: 0, babies: 0, rooms: 1 } as const;

const proven = {
  price: 410,
  pricePerDay: 51,
  livePriceStatus: 'proven' as const,
  livePriceSource: 'getPromotedPrice' as const,
  liveTotalPrice: 820,
  liveTotalPriceField: 'getPromotedPrice.totalPrice' as const,
};

afterEach(() => {
  clearResultsLivePriceCache();
  setResultsLivePriceNowMsForTests(null);
  setLivePriceL2EnabledForTests(null);
  setLivePriceL2BackendForTests(null);
  resetLivePriceL2CircuitForTests();
  clearLivePriceL2ObservabilityForTests();
});

test('L2 disabled: no write / no hydrate / flag false', async () => {
  setLivePriceL2EnabledForTests(false);
  assert.equal(isLivePriceL2Enabled(), false);
  setResultsLivePriceOverlay('offer-a', occupancy, proven);
  const key = livePriceCacheKey('offer-a', occupancy);
  assert.equal(await readLivePriceL2Record(key), null);
  clearResultsLivePriceCache();
  const hydrated = await hydrateResultsLivePriceOverlaysFromL2(['offer-a'], occupancy);
  assert.equal(hydrated.hydrated, 0);
  assert.equal(hasResultsLivePriceOverlay('offer-a', occupancy), false);
});

test('TEST1/3: write L1+L2 then cold L1 hydrate from L2 (warm L2)', async () => {
  resetLivePriceL2MemoryBackendForTests();
  setLivePriceL2EnabledForTests(true);

  setResultsLivePriceOverlay('offer-a', occupancy, proven);
  // Allow write-through promise to settle
  await new Promise((r) => setTimeout(r, 20));

  const key = livePriceCacheKey('offer-a', occupancy);
  const fromL2 = await readLivePriceL2Record(key);
  assert.ok(fromL2);
  assert.equal(fromL2!.overlay.price, 410);

  clearResultsLivePriceCache();
  assert.equal(hasResultsLivePriceOverlay('offer-a', occupancy), false);

  const hydrated = await hydrateResultsLivePriceOverlaysFromL2(['offer-a'], occupancy);
  assert.equal(hydrated.hydrated, 1);
  assert.equal(getResultsLivePriceOverlay('offer-a', occupancy)?.price, 410);
});

test('TEST4: cold L1 cold L2 miss', async () => {
  resetLivePriceL2MemoryBackendForTests();
  setLivePriceL2EnabledForTests(true);
  const hydrated = await hydrateResultsLivePriceOverlaysFromL2(['missing'], occupancy);
  assert.equal(hydrated.hydrated, 0);
  assert.equal(hasResultsLivePriceOverlay('missing', occupancy), false);
});

test('TEST6/7: different occupancy and offer — no cross-reuse', async () => {
  resetLivePriceL2MemoryBackendForTests();
  setLivePriceL2EnabledForTests(true);
  setResultsLivePriceOverlay('offer-a', occupancy, proven);
  await new Promise((r) => setTimeout(r, 20));
  clearResultsLivePriceCache();

  await hydrateResultsLivePriceOverlaysFromL2(['offer-a'], { ...occupancy, adults: 3 });
  assert.equal(hasResultsLivePriceOverlay('offer-a', { ...occupancy, adults: 3 }), false);

  await hydrateResultsLivePriceOverlaysFromL2(['offer-b'], occupancy);
  assert.equal(hasResultsLivePriceOverlay('offer-b', occupancy), false);

  await hydrateResultsLivePriceOverlaysFromL2(['offer-a'], occupancy);
  assert.equal(hasResultsLivePriceOverlay('offer-a', occupancy), true);
});

test('TEST8: TTL expiry on L2', async () => {
  resetLivePriceL2MemoryBackendForTests();
  setLivePriceL2EnabledForTests(true);
  const key = livePriceCacheKey('offer-ttl', occupancy);
  const t0 = 5_000_000;
  await writeLivePriceL2Record(key, proven, {
    cachedAtMs: t0,
    ttlMs: RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS,
  });
  // Fresh within TTL
  const fresh = await readLivePriceL2Record(key);
  // readLivePriceL2Record uses Date.now() — write with old cachedAtMs relative to now
  // Force by writing with cachedAtMs = now - ttl - 1
  const now = Date.now();
  await writeLivePriceL2Record(key, proven, {
    cachedAtMs: now - RESULTS_LIVE_PRICE_TTL_MS - 1,
    ttlMs: RESULTS_LIVE_PRICE_TTL_MS,
  });
  assert.equal(await readLivePriceL2Record(key), null);
  void fresh;
});

test('TEST9/10: C uses 2min TTL; A/B use 8h via setResultsLivePriceOverlay options', async () => {
  resetLivePriceL2MemoryBackendForTests();
  setLivePriceL2EnabledForTests(true);
  const keyC = livePriceCacheKey('offer-c', occupancy);
  setResultsLivePriceOverlay(
    'offer-c',
    occupancy,
    {
      price: 0,
      pricePerDay: 0,
      livePriceStatus: 'unavailable',
      livePriceSource: 'getPromotedPrice',
      livePriceFailureReason: 'timeout',
    },
    { ttlMs: RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS },
  );
  await new Promise((r) => setTimeout(r, 20));
  const recC = await readLivePriceL2Record(keyC);
  assert.ok(recC);
  assert.equal(recC!.ttlMs, RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS);

  const keyB = livePriceCacheKey('offer-b', occupancy);
  setResultsLivePriceOverlay('offer-b', occupancy, proven);
  await new Promise((r) => setTimeout(r, 20));
  const recB = await readLivePriceL2Record(keyB);
  assert.ok(recB);
  assert.equal(recB!.ttlMs, RESULTS_LIVE_PRICE_TTL_MS);
});

test('TEST5/12: lock claim busy + expiry reclaim; no permanent block', async () => {
  resetLivePriceL2MemoryBackendForTests();
  setLivePriceL2EnabledForTests(true);
  const key = livePriceCacheKey('offer-lock', occupancy);

  const first = await tryClaimLivePriceL2Lock(key, 'owner-a');
  assert.equal(first, 'claimed');
  const second = await tryClaimLivePriceL2Lock(key, 'owner-b');
  assert.equal(second, 'busy');

  // Simulate expiry by writing stale lock then reclaim
  const backend = getLivePriceL2MemoryBackendForTests();
  await backend.put(
    livePriceL2LockObjectKey(key),
    JSON.stringify({ ownerId: 'owner-a', expiresAtMs: Date.now() - 1 }),
  );
  const reclaimed = await tryClaimLivePriceL2Lock(key, 'owner-c');
  assert.equal(reclaimed, 'claimed');
  await releaseLivePriceL2Lock(key);
});

test('TEST5 gate: concurrent gate — second skips provider when L2 filled', async () => {
  resetLivePriceL2MemoryBackendForTests();
  setLivePriceL2EnabledForTests(true);
  clearLivePriceL2ObservabilityForTests();
  const key = livePriceCacheKey('offer-gate', occupancy);
  let providerCalls = 0;

  const a = withLivePriceL2ProviderGate(key, async () => {
    providerCalls += 1;
    await new Promise((r) => setTimeout(r, 80));
    await writeLivePriceL2Record(key, proven, { ttlMs: RESULTS_LIVE_PRICE_TTL_MS });
  });

  // Slightly delayed second contender
  await new Promise((r) => setTimeout(r, 10));
  let seeded = false;
  const b = withLivePriceL2ProviderGate(
    key,
    async () => {
      providerCalls += 1;
    },
    () => {
      seeded = true;
    },
  );

  const [ra, rb] = await Promise.all([a, b]);
  assert.ok(ra === 'ran' || ra === 'ran_without_lock');
  // b should ideally skip via L2 hit after wait; if race, at most 2 providers
  assert.ok(providerCalls >= 1 && providerCalls <= 2);
  if (rb === 'skipped_l2_hit') {
    assert.equal(seeded, true);
    assert.equal(providerCalls, 1);
  }
  const snap = getLivePriceL2ObservabilitySnapshot();
  assert.ok(snap.LOCK_CLAIM >= 1 || snap.L2_WRITE >= 1);
});

test('TEST11: store failure soft — gate still runs provider', async () => {
  setLivePriceL2EnabledForTests(true);
  setLivePriceL2BackendForTests({
    async get() {
      throw new Error('down');
    },
    async put() {
      throw new Error('down');
    },
    async putIfAbsent() {
      throw new Error('down');
    },
    async delete() {
      throw new Error('down');
    },
  });
  let ran = false;
  const result = await withLivePriceL2ProviderGate('any-key', async () => {
    ran = true;
  });
  assert.equal(ran, true);
  assert.ok(result === 'ran' || result === 'ran_without_lock');
});

test('observability counters increment', async () => {
  resetLivePriceL2MemoryBackendForTests();
  setLivePriceL2EnabledForTests(true);
  clearLivePriceL2ObservabilityForTests();
  const key = livePriceCacheKey('obs-1', occupancy);
  await writeLivePriceL2Record(key, proven, { ttlMs: RESULTS_LIVE_PRICE_TTL_MS });
  await readLivePriceL2Record(key);
  await readLivePriceL2Record(livePriceCacheKey('obs-miss', occupancy));
  const snap = getLivePriceL2ObservabilitySnapshot();
  assert.ok(snap.L2_WRITE >= 1);
  assert.ok(snap.L2_HIT >= 1);
  assert.ok(snap.L2_MISS >= 1);
});

// ---------------------------------------------------------------------------
// D-v2 S1: R2 bounds (review table A). Mocked setTimeout + Date; scripted backend
// whose ops can be delayed or hang forever (hanging ops ignore the abort signal,
// so these tests prove the store bounds the wait itself).
// ---------------------------------------------------------------------------

const T0 = 1_000_000;

type OpLog = {
  op: 'get' | 'put' | 'putIfAbsent' | 'delete';
  key: string;
  startedAt: number;
  abortedAt: number | null;
};

/** null = hang forever; number = resolve after that many ms (mocked clock). */
type Step<T> = { delayMs: number | null; value?: () => T; error?: true };

function scriptedBackend(script: {
  get?: (key: string, callIndex: number) => Step<string | null>;
  put?: (key: string) => Step<void>;
  putIfAbsent?: (key: string) => Step<'created' | 'exists'>;
  delete?: (key: string) => Step<void>;
}): { backend: LivePriceL2Backend; log: OpLog[] } {
  const log: OpLog[] = [];
  let getCalls = 0;
  function run<T>(
    op: OpLog['op'],
    key: string,
    signal: AbortSignal | undefined,
    step: Step<T> | undefined,
    fallback: T,
  ): Promise<T> {
    const entry: OpLog = { op, key, startedAt: Date.now(), abortedAt: null };
    log.push(entry);
    signal?.addEventListener('abort', () => {
      entry.abortedAt = Date.now();
    });
    if (!step || step.delayMs === null) {
      return new Promise<T>(() => {});
    }
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        if (step.error) {
          reject(new Error('r2 down'));
          return;
        }
        resolve(step.value ? step.value() : fallback);
      }, step.delayMs as number);
    });
  }
  const backend: LivePriceL2Backend = {
    get(key, signal) {
      const index = getCalls;
      getCalls += 1;
      return run('get', key, signal, script.get?.(key, index), null);
    },
    put(key, _body, signal) {
      return run('put', key, signal, script.put?.(key), undefined);
    },
    putIfAbsent(key, _body, signal) {
      return run('putIfAbsent', key, signal, script.putIfAbsent?.(key), 'created');
    },
    delete(key, signal) {
      return run('delete', key, signal, script.delete?.(key), undefined);
    },
  };
  return { backend, log };
}

function enableClock(t: TestContext): void {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: T0 });
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await new Promise<void>((r) => setImmediate(r));
  }
}

async function advance(t: TestContext, ms: number, stepMs = 10): Promise<void> {
  await flushMicrotasks();
  for (let done = 0; done < ms; done += stepMs) {
    t.mock.timers.tick(stepMs);
    await flushMicrotasks();
  }
}

function track<T>(promise: Promise<T>): { settledAt: number | null; value?: T } {
  const state: { settledAt: number | null; value?: T } = { settledAt: null };
  void promise.then((value) => {
    state.settledAt = Date.now();
    state.value = value;
  });
  return state;
}

const isLockKey = (key: string) => key.includes('/lock/');

test('T11: record GET hangs -> aborted and null at exactly 2000 ms (S1 keeps null result)', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend, log } = scriptedBackend({ get: () => ({ delayMs: null }) });
  setLivePriceL2BackendForTests(backend);
  clearLivePriceL2ObservabilityForTests();

  const read = track(readLivePriceL2Record(livePriceCacheKey('t11', occupancy)));
  await advance(t, LIVE_PRICE_L2_RECORD_READ_TIMEOUT_MS - 10);
  assert.equal(read.settledAt, null, 'must still be pending at 1990 ms');
  assert.equal(log[0]!.abortedAt, null);
  await advance(t, 10);
  assert.equal(read.settledAt, T0 + 2_000);
  assert.equal(read.value, null);
  assert.equal(log.length, 1);
  assert.equal(log[0]!.abortedAt, T0 + 2_000, 'AbortSignal fired at the deadline');
  assert.equal(getLivePriceL2ObservabilitySnapshot().STORE_ERROR, 1);
});

test('T11b: late record (2100 ms) is not used; record at 1900 ms is used', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const lateKey = livePriceCacheKey('t11-late', occupancy);
  const fastKey = livePriceCacheKey('t11-fast', occupancy);
  const recordFor = (cacheKey: string) =>
    JSON.stringify({
      schemaVersion: LIVE_PRICE_L2_SCHEMA_VERSION,
      cacheKey,
      cachedAtMs: T0,
      ttlMs: RESULTS_LIVE_PRICE_TTL_MS,
      overlay: proven,
    });
  const { backend } = scriptedBackend({
    get: (_key, index) =>
      index === 0
        ? { delayMs: 2_100, value: () => recordFor(lateKey) }
        : { delayMs: 1_900, value: () => recordFor(fastKey) },
  });
  setLivePriceL2BackendForTests(backend);

  const late = track(readLivePriceL2Record(lateKey));
  const fast = track(readLivePriceL2Record(fastKey));
  await advance(t, 2_300);
  assert.equal(fast.settledAt, T0 + 1_900);
  assert.equal(fast.value?.overlay.price, 410);
  assert.equal(late.settledAt, T0 + 2_000);
  assert.equal(late.value, null, 'answer after the 2000 ms deadline is ignored');
});

test('T12a: lock create (putIfAbsent) hangs -> claim error at 1500 ms', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend, log } = scriptedBackend({ putIfAbsent: () => ({ delayMs: null }) });
  setLivePriceL2BackendForTests(backend);

  const claim = track(tryClaimLivePriceL2Lock(livePriceCacheKey('t12a', occupancy), 'o'));
  await advance(t, LIVE_PRICE_L2_LOCK_OP_TIMEOUT_MS - 10);
  assert.equal(claim.settledAt, null);
  await advance(t, 10);
  assert.equal(claim.settledAt, T0 + 1_500);
  assert.equal(claim.value, 'error');
  assert.equal(log[0]!.abortedAt, T0 + 1_500);
});

test('T12b: lock read hangs after exists -> claim error 1500 ms after the read started', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend, log } = scriptedBackend({
    putIfAbsent: () => ({ delayMs: 10, value: () => 'exists' as const }),
    get: () => ({ delayMs: null }),
  });
  setLivePriceL2BackendForTests(backend);

  const claim = track(tryClaimLivePriceL2Lock(livePriceCacheKey('t12b', occupancy), 'o'));
  await advance(t, 1_600);
  assert.equal(claim.value, 'error');
  assert.equal(claim.settledAt, T0 + 10 + 1_500);
  const lockRead = log.find((e) => e.op === 'get')!;
  assert.ok(isLockKey(lockRead.key));
  assert.equal(lockRead.abortedAt, T0 + 10 + 1_500);
});

test('T12c: stale-lock reclaim put hangs -> claim error 1500 ms after the put started', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend, log } = scriptedBackend({
    putIfAbsent: () => ({ delayMs: 10, value: () => 'exists' as const }),
    get: () => ({
      delayMs: 10,
      value: () => JSON.stringify({ ownerId: 'old', expiresAtMs: T0 - 1 }),
    }),
    put: () => ({ delayMs: null }),
  });
  setLivePriceL2BackendForTests(backend);

  const claim = track(tryClaimLivePriceL2Lock(livePriceCacheKey('t12c', occupancy), 'o'));
  await advance(t, 1_600);
  assert.equal(claim.value, 'error');
  assert.equal(claim.settledAt, T0 + 20 + 1_500);
  assert.equal(log.find((e) => e.op === 'put')!.abortedAt, T0 + 20 + 1_500);
});

test('T12d: lock release is not awaited by the gate; release itself bounded at 2000 ms', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend, log } = scriptedBackend({
    get: () => ({ delayMs: 10, value: () => null }),
    putIfAbsent: () => ({ delayMs: 10, value: () => 'created' as const }),
    delete: () => ({ delayMs: null }),
  });
  setLivePriceL2BackendForTests(backend);
  clearLivePriceL2ObservabilityForTests();

  let providerCalls = 0;
  const gate = track(
    withLivePriceL2ProviderGate(livePriceCacheKey('t12d', occupancy), async () => {
      providerCalls += 1;
    }),
  );
  await advance(t, 50);
  assert.equal(gate.value, 'ran');
  assert.equal(gate.settledAt, T0 + 30, 'gate returns right after work, not after DELETE');
  assert.equal(providerCalls, 1);
  const del = log.find((e) => e.op === 'delete')!;
  assert.equal(del.abortedAt, null, 'DELETE still in flight when the gate returned');

  const direct = track(releaseLivePriceL2Lock(livePriceCacheKey('t12d-direct', occupancy)));
  await advance(t, LIVE_PRICE_L2_LOCK_RELEASE_TIMEOUT_MS);
  assert.equal(del.abortedAt, T0 + 30 + 2_000, 'background release aborted at 2000 ms');
  assert.equal(direct.settledAt, T0 + 50 + 2_000, 'awaited release resolves (never rejects) at 2000 ms');
});

// T12e/T12f adjusted in S2: a timed-out first read no longer leads to a lock attempt,
// so the budget cases start from a not_found first read (same budget property as S1).
test('T12e: not_found at 1500 + lock create hangs -> create capped by budget, provider once at 3000 ms without lock', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend, log } = scriptedBackend({
    get: () => ({ delayMs: 1_500, value: () => null }),
  });
  setLivePriceL2BackendForTests(backend);

  let providerCalls = 0;
  let workStartedAt = 0;
  const gate = track(
    withLivePriceL2ProviderGate(livePriceCacheKey('t12e', occupancy), async () => {
      providerCalls += 1;
      workStartedAt = Date.now();
    }),
  );
  await advance(t, 3_200);
  assert.equal(gate.value, 'ran_without_lock');
  assert.equal(providerCalls, 1, 'DEC-011: one provider call per gate call');
  assert.equal(workStartedAt - T0, LIVE_PRICE_L2_GATE_R2_BUDGET_MS);
  assert.deepEqual(
    log.map((e) => [e.op, e.startedAt - T0, e.abortedAt === null ? null : e.abortedAt - T0]),
    [
      ['get', 0, null],
      ['putIfAbsent', 1_500, 3_000],
    ],
    'lock create capped by remaining budget (1500)',
  );
});

test('T12f: claim won late -> re-read capped by remaining budget; provider at 3000 ms with lock', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend } = scriptedBackend({
    get: (_key, index) => (index === 0 ? { delayMs: 1_500, value: () => null } : { delayMs: null }),
    putIfAbsent: () => ({ delayMs: 1_000, value: () => 'created' as const }),
    delete: () => ({ delayMs: 10 }),
  });
  setLivePriceL2BackendForTests(backend);

  let providerCalls = 0;
  let workStartedAt = 0;
  const gate = track(
    withLivePriceL2ProviderGate(livePriceCacheKey('t12f', occupancy), async () => {
      providerCalls += 1;
      workStartedAt = Date.now();
    }),
  );
  await advance(t, 3_200);
  assert.equal(gate.value, 'ran');
  assert.equal(providerCalls, 1);
  assert.equal(workStartedAt - T0, 3_000);
});

test('T12g: L2 write-through put hangs -> write resolves false at 2000 ms', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend, log } = scriptedBackend({ put: () => ({ delayMs: null }) });
  setLivePriceL2BackendForTests(backend);

  const write = track(
    writeLivePriceL2Record(livePriceCacheKey('t12g', occupancy), proven, {
      ttlMs: RESULTS_LIVE_PRICE_TTL_MS,
    }),
  );
  await advance(t, LIVE_PRICE_L2_WRITE_TIMEOUT_MS);
  assert.equal(write.value, false);
  assert.equal(write.settledAt, T0 + 2_000);
  assert.equal(log[0]!.abortedAt, T0 + 2_000);
});

test('T15: lock poll total <= 2500 ms including in-flight read (each read min(2000, remaining))', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend, log } = scriptedBackend({ get: () => ({ delayMs: null }) });
  setLivePriceL2BackendForTests(backend);

  const waited = track(waitForLivePriceL2Record(livePriceCacheKey('t15', occupancy)));
  await advance(t, 2_700);
  assert.equal(waited.value, null);
  assert.equal(waited.settledAt, T0 + LIVE_PRICE_L2_LOCK_POLL_MS);
  assert.deepEqual(
    log.map((e) => [e.startedAt - T0, e.abortedAt! - T0]),
    [
      [0, 2_000],
      [2_150, 2_500],
    ],
  );
});

test('T15b: gate busy -> poll limited by remaining gate budget; provider once, <= 3000 ms', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend } = scriptedBackend({
    get: (key, index) =>
      isLockKey(key)
        ? {
            delayMs: 10,
            value: () => JSON.stringify({ ownerId: 'other', expiresAtMs: T0 + 25_000 }),
          }
        : index === 0
          ? { delayMs: 10, value: () => null }
          : { delayMs: null },
    putIfAbsent: () => ({ delayMs: 10, value: () => 'exists' as const }),
  });
  setLivePriceL2BackendForTests(backend);

  let providerCalls = 0;
  let workStartedAt = 0;
  const gate = track(
    withLivePriceL2ProviderGate(livePriceCacheKey('t15b', occupancy), async () => {
      providerCalls += 1;
      workStartedAt = Date.now();
    }),
  );
  await advance(t, 3_200);
  assert.equal(gate.value, 'ran_without_lock');
  assert.equal(providerCalls, 1);
  assert.equal(workStartedAt - T0, 30 + 2_500, 'busy at 30 ms + 2500 ms poll');
  assert.ok(workStartedAt - T0 <= LIVE_PRICE_L2_GATE_R2_BUDGET_MS);
});

test('T17: live-price L2 S3 client config: connect 1000, request 2000 + throw, maxAttempts 1', async () => {
  assert.equal(LIVE_PRICE_L2_CONNECT_TIMEOUT_MS, 1_000);
  assert.equal(LIVE_PRICE_L2_REQUEST_TIMEOUT_MS, 2_000);
  assert.equal(LIVE_PRICE_L2_MAX_ATTEMPTS, 1);
  const client = buildLivePriceL2S3Client({
    bucket: 'b',
    offersKey: 'k',
    region: 'auto',
    accessKeyId: 'id',
    secretAccessKey: 'secret',
    endpoint: 'https://example.invalid',
  });
  try {
    assert.equal(await client.config.maxAttempts(), 1);
    const handler = client.config.requestHandler as unknown as {
      configProvider: Promise<{
        connectionTimeout?: number;
        requestTimeout?: number;
        throwOnRequestTimeout?: boolean;
      }>;
    };
    const resolved = await handler.configProvider;
    assert.equal(resolved.connectionTimeout, 1_000);
    assert.equal(resolved.requestTimeout, 2_000);
    assert.equal(resolved.throwOnRequestTimeout, true);
  } finally {
    client.destroy();
  }
});

// ---------------------------------------------------------------------------
// D-v2 S2: explicit read outcomes, single-flight, R2 circuit breaker.
// ---------------------------------------------------------------------------

function validRecord(cacheKey: string): string {
  return JSON.stringify({
    schemaVersion: LIVE_PRICE_L2_SCHEMA_VERSION,
    cacheKey,
    cachedAtMs: T0,
    ttlMs: RESULTS_LIVE_PRICE_TTL_MS,
    overlay: proven,
  });
}

const recordGets = (log: OpLog[]) => log.filter((e) => e.op === 'get' && !isLockKey(e.key));
const lockOps = (log: OpLog[]) =>
  log.filter((e) => e.op === 'putIfAbsent' || e.op === 'delete' || isLockKey(e.key));

function gateWithCounter(cacheKey: string) {
  const counter = { providerCalls: 0, seeded: null as LivePriceL2Record | null };
  const gate = track(
    withLivePriceL2ProviderGate(
      cacheKey,
      async () => {
        counter.providerCalls += 1;
      },
      (record) => {
        counter.seeded = record;
      },
    ),
  );
  return { gate, counter };
}

test('T18: R2 answers at 800 ms -> found; L1 filled from R2; 0 provider calls; 1 GET', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const key = livePriceCacheKey('t18', occupancy);
  const { backend, log } = scriptedBackend({
    get: () => ({ delayMs: 800, value: () => validRecord(key) }),
  });
  setLivePriceL2BackendForTests(backend);

  const hydrate = track(hydrateResultsLivePriceOverlaysFromL2(['t18'], occupancy));
  const { gate, counter } = gateWithCounter(key);
  await advance(t, 900);
  assert.equal(hydrate.settledAt, T0 + 800);
  assert.equal(hydrate.value?.hydrated, 1);
  assert.equal(getResultsLivePriceOverlay('t18', occupancy)?.price, 410);
  assert.equal(gate.value, 'skipped_l2_hit');
  assert.equal(counter.seeded?.overlay.price, 410);
  assert.equal(counter.providerCalls, 0);
  assert.equal(recordGets(log).length, 1, 'hydrate + gate share one GET');
  assert.equal(lockOps(log).length, 0);
});

test('T19 (S2 part): caller 2 joins at 1100 ms, R2 answers at 1200 ms -> 1 GET, both found, 0 provider calls', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  clearLivePriceL2ObservabilityForTests();
  const key = livePriceCacheKey('t19', occupancy);
  const { backend, log } = scriptedBackend({
    get: () => ({ delayMs: 1_200, value: () => validRecord(key) }),
  });
  setLivePriceL2BackendForTests(backend);

  const hydrate = track(hydrateResultsLivePriceOverlaysFromL2(['t19'], occupancy));
  await advance(t, 1_100);
  assert.equal(hydrate.settledAt, null);
  const { gate, counter } = gateWithCounter(key);
  await advance(t, 200);
  assert.equal(hydrate.value?.hydrated, 1);
  assert.equal(gate.value, 'skipped_l2_hit');
  assert.equal(gate.settledAt, T0 + 1_200);
  assert.equal(counter.providerCalls, 0);
  assert.equal(recordGets(log).length, 1);
  assert.equal(getLivePriceL2ObservabilitySnapshot().L2_READ_JOIN, 1);
});

test('T20: R2 answer at 2100 ms -> timeout at 2000 ms, no lock, 1 provider call, late answer unused', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const key = livePriceCacheKey('t20', occupancy);
  const { backend, log } = scriptedBackend({
    get: () => ({ delayMs: 2_100, value: () => validRecord(key) }),
  });
  setLivePriceL2BackendForTests(backend);

  const typed = track(readLivePriceL2RecordResult(key));
  const hydrate = track(hydrateResultsLivePriceOverlaysFromL2(['t20'], occupancy));
  const { gate, counter } = gateWithCounter(key);
  await advance(t, 2_000);
  assert.deepEqual(typed.value, { status: 'timeout', record: null });
  assert.equal(typed.settledAt, T0 + 2_000);
  assert.equal(gate.value, 'ran_without_lock');
  assert.equal(counter.providerCalls, 1);
  await advance(t, 300);
  assert.equal(counter.seeded, null);
  assert.equal(hydrate.value?.hydrated, 0);
  assert.equal(hasResultsLivePriceOverlay('t20', occupancy), false, 'late answer not written to L1');
  assert.equal(lockOps(log).length, 0, 'timeout -> no lock attempt');
  assert.equal(recordGets(log).length, 1);
  assert.equal(recordGets(log)[0]!.abortedAt, T0 + 2_000);
});

test('T21: hydrate + gate + background + home on one key -> 1 shared GET; timeout -> exactly 1 provider call', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const key = livePriceCacheKey('t21', occupancy);
  const { backend, log } = scriptedBackend({ get: () => ({ delayMs: null }) });
  setLivePriceL2BackendForTests(backend);

  // Page-state hydrate, pricing gate, background matchset hydrate (page1-receipt-pricing.ts:911)
  // and home prefetch all reach L2 through readLivePriceL2Record.
  const pageHydrate = track(hydrateResultsLivePriceOverlaysFromL2(['t21'], occupancy));
  const { gate, counter } = gateWithCounter(key);
  const background = track(hydrateResultsLivePriceOverlaysFromL2(['t21'], occupancy));
  const home = track(readLivePriceL2Record(key));
  await advance(t, 2_100);
  assert.equal(recordGets(log).length, 1);
  assert.equal(pageHydrate.value?.hydrated, 0);
  assert.equal(background.value?.hydrated, 0);
  assert.equal(home.value, null);
  assert.equal(gate.value, 'ran_without_lock');
  assert.equal(counter.providerCalls, 1, 'DEC-011');
  assert.equal(lockOps(log).length, 0);
});

test('S2 outcomes: not_found -> lock path; timeout / error -> no lock; each exactly 1 provider call', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const cases = [
    { name: 'not_found', step: { delayMs: 10, value: () => null }, lock: true },
    { name: 'timeout', step: { delayMs: null }, lock: false },
    { name: 'error', step: { delayMs: 10, error: true as const }, lock: false },
  ] as const;
  for (const c of cases) {
    const key = livePriceCacheKey(`outcome-${c.name}`, occupancy);
    const { backend, log } = scriptedBackend({
      get: (k) => (isLockKey(k) ? { delayMs: 10, value: () => null } : c.step),
      putIfAbsent: () => ({ delayMs: 10, value: () => 'created' as const }),
      delete: () => ({ delayMs: 10 }),
    });
    setLivePriceL2BackendForTests(backend);
    const typed = track(readLivePriceL2RecordResult(key));
    await advance(t, 2_100);
    assert.equal(typed.value?.status, c.name, `typed status ${c.name}`);

    const { gate, counter } = gateWithCounter(key);
    await advance(t, 2_200);
    assert.equal(counter.providerCalls, 1, `${c.name}: DEC-011`);
    assert.equal(gate.value, c.lock ? 'ran' : 'ran_without_lock', c.name);
    assert.equal(
      log.some((e) => e.op === 'putIfAbsent'),
      c.lock,
      `${c.name}: lock attempt ${c.lock}`,
    );
  }
});

test('S2 single-flight: joiners share one GET; entry removed on settle; results not cached', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const key = livePriceCacheKey('sf', occupancy);
  const { backend, log } = scriptedBackend({
    get: () => ({ delayMs: 300, value: () => validRecord(key) }),
  });
  setLivePriceL2BackendForTests(backend);

  const a = track(readLivePriceL2RecordResult(key));
  const b = track(readLivePriceL2RecordResult(key));
  await flushMicrotasks();
  assert.equal(getLivePriceL2InflightReadCountForTests(), 1);
  await advance(t, 300);
  assert.equal(a.value?.status, 'found');
  assert.equal(b.value?.status, 'found');
  assert.equal(recordGets(log).length, 1);
  assert.equal(getLivePriceL2InflightReadCountForTests(), 0, 'entry deleted after settle');

  const c = track(readLivePriceL2RecordResult(key));
  await advance(t, 300);
  assert.equal(c.value?.status, 'found');
  assert.equal(recordGets(log).length, 2, 'settled result is not cached in the map');

});

test('S2 single-flight: joiner with a shorter deadline gets its own timeout, shared read continues', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const key = livePriceCacheKey('sf-short', occupancy);
  const { backend, log } = scriptedBackend({
    get: () => ({ delayMs: 1_000, value: () => validRecord(key) }),
  });
  setLivePriceL2BackendForTests(backend);

  const starter = track(readLivePriceL2RecordResult(key));
  const shortJoiner = track(readLivePriceL2RecordResult(key, { timeoutMs: 400 }));
  await advance(t, 1_000);
  assert.deepEqual(shortJoiner.value, { status: 'timeout', record: null });
  assert.equal(shortJoiner.settledAt, T0 + 400);
  assert.equal(starter.value?.status, 'found');
  assert.equal(recordGets(log).length, 1);
  assert.equal(recordGets(log)[0]!.abortedAt, null, 'shared read not aborted by the joiner');
  assert.equal(getLivePriceL2CircuitSnapshotForTests().failuresInWindow, 0);
});

test('S2 single-flight cap: above 2000 in-flight keys reads run unshared; map drains on settle', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend, log } = scriptedBackend({ get: () => ({ delayMs: null }) });
  setLivePriceL2BackendForTests(backend);

  const pending: Promise<unknown>[] = [];
  for (let i = 0; i < LIVE_PRICE_L2_INFLIGHT_READ_CAP; i += 1) {
    pending.push(readLivePriceL2RecordResult(`cap-key-${i}`));
  }
  assert.equal(getLivePriceL2InflightReadCountForTests(), 2_000);
  const over1 = readLivePriceL2RecordResult('cap-over');
  const over2 = readLivePriceL2RecordResult('cap-over');
  assert.equal(recordGets(log).length, 2_002, 'over-cap reads are not shared');
  assert.equal(getLivePriceL2InflightReadCountForTests(), 2_000);
  await advance(t, 2_000, 100);
  await Promise.all([...pending, over1, over2]);
  assert.equal(getLivePriceL2InflightReadCountForTests(), 0);
});

async function failReads(t: TestContext, count: number, spacingMs: number, prefix: string) {
  for (let i = 0; i < count; i += 1) {
    if (i > 0) {
      await advance(t, spacingMs - 10);
    }
    const r = track(readLivePriceL2RecordResult(livePriceCacheKey(`${prefix}-${i}`, occupancy)));
    await advance(t, 10);
    assert.equal(r.value?.status, 'error');
  }
}

test('S2 circuit: 4 errors in 10 s stay closed; the 5th opens; not_found never counts', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  clearLivePriceL2ObservabilityForTests();
  const { backend } = scriptedBackend({
    get: (key) =>
      key.includes(hashFor('nf')) ? { delayMs: 10, value: () => null } : { delayMs: 10, error: true },
  });
  setLivePriceL2BackendForTests(backend);

  for (let i = 0; i < 10; i += 1) {
    const nf = track(readLivePriceL2RecordResult(livePriceCacheKey('nf', occupancy)));
    await advance(t, 10);
    assert.equal(nf.value?.status, 'not_found');
  }
  assert.equal(getLivePriceL2CircuitSnapshotForTests().failuresInWindow, 0);

  await failReads(t, 4, 1_000, 'b1');
  assert.equal(getLivePriceL2CircuitSnapshotForTests().phase, 'closed');
  assert.equal(getLivePriceL2CircuitSnapshotForTests().failuresInWindow, 4);
  await failReads(t, 1, 1_000, 'b1-fifth');
  assert.equal(getLivePriceL2CircuitSnapshotForTests().phase, 'open');
  assert.equal(getLivePriceL2ObservabilitySnapshot().L2_CIRCUIT_OPEN, 1);
});

function hashFor(offerId: string): string {
  // object key contains the sha256 of the cache key; compare via livePriceL2LockObjectKey tail
  const lockKey = livePriceL2LockObjectKey(livePriceCacheKey(offerId, occupancy));
  return lockKey.slice(lockKey.lastIndexOf('/') + 1, -'.json'.length);
}

test('S2 circuit: 5 errors spread over more than 10 s do not open', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend } = scriptedBackend({ get: () => ({ delayMs: 10, error: true }) });
  setLivePriceL2BackendForTests(backend);

  await failReads(t, 5, 2_600, 'spread');
  assert.equal(getLivePriceL2CircuitSnapshotForTests().phase, 'closed');
  assert.equal(getLivePriceL2CircuitSnapshotForTests().failuresInWindow, 4);
});

test('S2 circuit open: reads skipped (0 backend calls), lock/write/release skipped, gate -> 1 provider call without lock', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  const { backend, log } = scriptedBackend({
    get: () => ({ delayMs: 10, error: true }),
    putIfAbsent: () => ({ delayMs: 10, value: () => 'created' as const }),
    put: () => ({ delayMs: 10 }),
    delete: () => ({ delayMs: 10 }),
  });
  setLivePriceL2BackendForTests(backend);
  await failReads(t, 5, 100, 'open');
  assert.equal(getLivePriceL2CircuitSnapshotForTests().phase, 'open');
  const opsBefore = log.length;

  const key = livePriceCacheKey('open-key', occupancy);
  const read = track(readLivePriceL2RecordResult(key));
  const claim = track(tryClaimLivePriceL2Lock(key, 'o'));
  const write = track(writeLivePriceL2Record(key, proven, { ttlMs: RESULTS_LIVE_PRICE_TTL_MS }));
  const release = track(releaseLivePriceL2Lock(key));
  const waited = track(waitForLivePriceL2Record(key));
  const { gate, counter } = gateWithCounter(key);
  await flushMicrotasks();
  assert.deepEqual(read.value, { status: 'skipped', record: null });
  assert.equal(claim.value, 'skipped');
  assert.equal(write.value, false);
  assert.notEqual(release.settledAt, null);
  assert.equal(waited.value, null);
  assert.equal(waited.settledAt, Date.now(), 'poll returns at once on skipped');
  assert.equal(gate.value, 'ran_without_lock');
  assert.equal(counter.providerCalls, 1);
  assert.equal(log.length, opsBefore, 'no backend call while open (skipped != not_found)');
});

test('S2 circuit half-open: one probe after 30 s; success closes, failure reopens', async (t) => {
  enableClock(t);
  setLivePriceL2EnabledForTests(true);
  let mode: 'error' | 'not_found' | 'hang' = 'error';
  const { backend, log } = scriptedBackend({
    get: () =>
      mode === 'error'
        ? { delayMs: 10, error: true }
        : mode === 'hang'
          ? { delayMs: 50, value: () => null }
          : { delayMs: 10, value: () => null },
  });
  setLivePriceL2BackendForTests(backend);
  await failReads(t, 5, 100, 'ho');
  const openedAt = getLivePriceL2CircuitSnapshotForTests().openedAtMs;
  assert.equal(getLivePriceL2CircuitSnapshotForTests().phase, 'open');

  // Just before 30 s: still skipped.
  await advance(t, LIVE_PRICE_L2_CIRCUIT_OPEN_MS - (Date.now() - openedAt) - 10);
  const early = track(readLivePriceL2RecordResult(livePriceCacheKey('ho-early', occupancy)));
  await flushMicrotasks();
  assert.equal(early.value?.status, 'skipped');

  // Probe failure reopens.
  await advance(t, 10);
  const opsBefore = log.length;
  const probe1 = track(readLivePriceL2RecordResult(livePriceCacheKey('ho-p1', occupancy)));
  const during1 = track(readLivePriceL2RecordResult(livePriceCacheKey('ho-d1', occupancy)));
  await flushMicrotasks();
  assert.equal(getLivePriceL2CircuitSnapshotForTests().phase, 'half_open');
  assert.equal(during1.value?.status, 'skipped', 'only one probe in half-open');
  await advance(t, 10);
  assert.equal(probe1.value?.status, 'error');
  assert.equal(log.length, opsBefore + 1, 'exactly one probe GET');
  assert.equal(getLivePriceL2CircuitSnapshotForTests().phase, 'open');
  const after1 = track(readLivePriceL2RecordResult(livePriceCacheKey('ho-a1', occupancy)));
  await flushMicrotasks();
  assert.equal(after1.value?.status, 'skipped');

  // Next probe after another 30 s succeeds (not_found) -> closed.
  mode = 'hang';
  await advance(t, LIVE_PRICE_L2_CIRCUIT_OPEN_MS);
  const probe2 = track(readLivePriceL2RecordResult(livePriceCacheKey('ho-p2', occupancy)));
  await advance(t, 50);
  assert.equal(probe2.value?.status, 'not_found');
  assert.equal(getLivePriceL2CircuitSnapshotForTests().phase, 'closed');
  mode = 'not_found';
  const normal = track(readLivePriceL2RecordResult(livePriceCacheKey('ho-n', occupancy)));
  await advance(t, 10);
  assert.equal(normal.value?.status, 'not_found');
});
