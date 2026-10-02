/**
 * T341 C1: a clean not_found from the hydrate read is handed once to the provider gate
 * for the same key, so the gate does not repeat the identical GET. The post-claim re-read
 * stays authoritative. No network: counting memory backend.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  clearResultsLivePriceCache,
  hydrateResultsLivePriceOverlaysFromL2,
  livePriceCacheKey,
} from '@/lib/search/results-live-price-cache';
import {
  getLivePriceL2MemoryBackendForTests,
  resetLivePriceL2CircuitForTests,
  setLivePriceL2BackendForTests,
  setLivePriceL2EnabledForTests,
  withLivePriceL2ProviderGate,
  writeLivePriceL2Record,
  type LivePriceL2Backend,
} from '@/lib/search/live-price-l2-store';

const params = { adults: 2 } as const;

afterEach(() => {
  clearResultsLivePriceCache();
  setLivePriceL2EnabledForTests(null);
  setLivePriceL2BackendForTests(null);
  resetLivePriceL2CircuitForTests();
});

function countingBackend(onGet?: (n: number) => Promise<void> | void): {
  backend: LivePriceL2Backend;
  gets: () => number;
} {
  const inner = getLivePriceL2MemoryBackendForTests();
  let gets = 0;
  const backend: LivePriceL2Backend = {
    async get(key, signal) {
      gets += 1;
      await onGet?.(gets);
      return inner.get(key, signal);
    },
    put: (key, body, signal) => inner.put(key, body, signal),
    putIfAbsent: (key, body, signal) => inner.putIfAbsent(key, body, signal),
    delete: (key, signal) => inner.delete(key, signal),
  };
  return { backend, gets: () => gets };
}

test('T341-C1: gate reuses the hydrate not_found (no identical second GET before the claim)', async () => {
  const { backend, gets } = countingBackend();
  setLivePriceL2EnabledForTests(true);
  setLivePriceL2BackendForTests(backend);
  const offerId = 't341-miss-1';
  await hydrateResultsLivePriceOverlaysFromL2([offerId], params);
  assert.equal(gets(), 1, 'hydrate: one GET for the bare key');
  let ran = 0;
  const outcome = await withLivePriceL2ProviderGate(livePriceCacheKey(offerId, params), async () => {
    ran += 1;
  });
  assert.equal(outcome, 'ran');
  assert.equal(ran, 1, 'provider work runs exactly once');
  assert.equal(gets(), 2, 'gate: only the authoritative post-claim re-read (was 2 GETs before C1)');
});

test('T341-C1: the handed-over miss is one-shot (a second gate call reads again)', async () => {
  const { backend, gets } = countingBackend();
  setLivePriceL2EnabledForTests(true);
  setLivePriceL2BackendForTests(backend);
  const offerId = 't341-miss-2';
  const key = livePriceCacheKey(offerId, params);
  await hydrateResultsLivePriceOverlaysFromL2([offerId], params);
  await withLivePriceL2ProviderGate(key, async () => {});
  assert.equal(gets(), 2);
  await withLivePriceL2ProviderGate(key, async () => {});
  assert.equal(gets(), 4, 'second gate: first read + post-claim re-read');
});

test('T341-C1: a record that lands after the hydrate miss is still honoured by the post-claim re-read', async () => {
  const offerId = 't341-miss-3';
  const key = livePriceCacheKey(offerId, params);
  const { backend, gets } = countingBackend(async (n) => {
    if (n === 2) {
      await writeLivePriceL2Record(
        key,
        { price: 410, pricePerDay: 51, livePriceStatus: 'proven', livePriceSource: 'getPromotedPrice' } as never,
        { ttlMs: 60_000 },
      );
    }
  });
  setLivePriceL2EnabledForTests(true);
  setLivePriceL2BackendForTests(backend);
  await hydrateResultsLivePriceOverlaysFromL2([offerId], params);
  let ran = 0;
  let hit = 0;
  const outcome = await withLivePriceL2ProviderGate(
    key,
    async () => {
      ran += 1;
    },
    () => {
      hit += 1;
    },
  );
  assert.equal(outcome, 'skipped_l2_hit');
  assert.equal(ran, 0, 'no provider call when the record appeared');
  assert.equal(hit, 1);
  assert.equal(gets(), 2);
});