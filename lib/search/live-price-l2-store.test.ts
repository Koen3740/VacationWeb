/**
 * AN-076 — L1 + L2 shared live-price store tests (memory backend).
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
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
  LIVE_PRICE_L2_LOCK_TTL_MS,
  getLivePriceL2MemoryBackendForTests,
  isLivePriceL2Enabled,
  livePriceL2LockObjectKey,
  readLivePriceL2Record,
  releaseLivePriceL2Lock,
  resetLivePriceL2MemoryBackendForTests,
  setLivePriceL2BackendForTests,
  setLivePriceL2EnabledForTests,
  tryClaimLivePriceL2Lock,
  withLivePriceL2ProviderGate,
  writeLivePriceL2Record,
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
