/**
 * SF-026 regression: the Results streams end when nothing relevant is left open, not after
 * the 10 s idle timeout.
 *
 * Proven root cause (t338u, real run Portugal BE, 135 offers / 127 B): the heading tracker
 * completed (pending 135 -> 0) and the pricing orchestrator finished, but the page-1
 * pagination tracker had `pending: null` and was only complete at the 150 browse cap, so with
 * fewer than 150 presentable B the response stayed open for POOL_PROGRESS_IDLE_MS (10 s).
 * The reader's pending was also derived from a settled-count difference, which over-counted
 * overlays of offers that were never eligible.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, it } from 'node:test';
import { loadOffers } from '@/lib/offers/load-offers';
import { excludeParkedResultsProviders } from '@/lib/search/presentable-price';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import { prepareResultsOffers } from '@/lib/search/prepare-results-offers';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import {
  createPoolProgressTracker,
  POOL_PROGRESS_IDLE_MS,
} from '@/lib/search/results-pool-progress';
import { createResultsPoolReader } from '@/lib/search/results-pool-reading';
import type { SearchParams, TravelOffer } from '@/types/travel';

const NOT_LIVE_PROVIDER = 'SomeCatalogOnlyProvider' as unknown as TravelOffer['provider'];

function seed(offer: TravelOffer, params: SearchParams, kind: 'B' | 'A' | 'C'): void {
  if (kind === 'B') {
    setResultsLivePriceOverlay(offer.id, params, {
      price: offer.price,
      pricePerDay: offer.pricePerDay,
      livePriceStatus: 'proven',
      livePriceSource: offer.provider === 'Corendon' ? 'upsales' : 'getPromotedPrice',
      liveTotalPrice: offer.price * 2,
      liveTotalPriceField:
        offer.provider === 'Corendon' ? 'upsales.totalPrice' : 'getPromotedPrice.totalPrice',
    });
    return;
  }
  setResultsLivePriceOverlay(offer.id, params, {
    price: 999,
    pricePerDay: 125,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: kind === 'A' ? 'http_204' : 'stale_context',
  });
}

async function realMatchset(): Promise<{ search: SearchParams; matchset: TravelOffer[] }> {
  const catalog = excludeParkedResultsProviders(await loadOffers());
  const search = parseSearchParams({ country: 'Griekenland', city: 'Agia Marina', adults: '2', dob: ',' });
  const matchset = await (await prepareResultsOffers(catalog, search)).exactOffers;
  assert.ok(matchset.length >= 10, `Agia Marina matchset: ${matchset.length}`);
  return { search, matchset: [...matchset] };
}

beforeEach(() => {
  clearResultsLivePriceCache();
});

describe('SF-026 reader: pending = eligible offers that still have no overlay', () => {
  it('mixed B / A / C outcomes all settle an attempt: pending reaches 0 and only B is counted', async () => {
    const { search, matchset } = await realMatchset();
    clearResultsLivePriceCache();
    const reader = createResultsPoolReader(matchset, search, { reuseMs: 0 });
    const start = reader();
    assert.ok((start.pending ?? 0) > 0);
    assert.equal(start.complete, false);
    let b = 0;
    matchset.forEach((offer, i) => {
      const kind = i % 3 === 0 ? 'A' : i % 3 === 1 ? 'C' : 'B';
      if (kind === 'B') b += 1;
      seed(offer, search, kind);
    });
    const end = reader();
    assert.equal(end.pending, 0);
    assert.equal(end.complete, true);
    assert.equal(end.count, b, 'A and C never count');
  });

  it('an overlay on an offer that was never eligible does not lower pending (no premature completion)', async () => {
    const { search, matchset } = await realMatchset();
    clearResultsLivePriceCache();
    const notLive = { ...matchset[0]!, id: 'sf026-not-live', provider: NOT_LIVE_PROVIDER } as TravelOffer;
    const ranked = [...matchset, notLive];
    const reader = createResultsPoolReader(ranked, search, { reuseMs: 0 });
    const start = reader();
    assert.equal(start.pending, matchset.length, 'the non-live offer is not eligible');
    seed(notLive, search, 'A'); // overlay for an offer that never needed pricing
    seed(matchset[0]!, search, 'B');
    const after = reader();
    assert.equal(after.pending, matchset.length - 1, 'only the eligible offer settled');
    assert.equal(after.complete, false);
  });

  it('eligible offers without an overlay (still in flight / never attempted) keep the pool open', async () => {
    const { search, matchset } = await realMatchset();
    clearResultsLivePriceCache();
    const reader = createResultsPoolReader(matchset, search, { reuseMs: 0 });
    reader();
    for (let i = 0; i < matchset.length - 2; i += 1) seed(matchset[i]!, search, 'B');
    const open = reader();
    assert.equal(open.pending, 2);
    assert.equal(open.complete, false);
    seed(matchset[matchset.length - 2]!, search, 'A');
    seed(matchset[matchset.length - 1]!, search, 'C');
    assert.equal(reader().pending, 0);
  });
});

describe('SF-026 tracker: end of work ends the stream, late pricing is not cut', () => {
  it('pagination-style read with pending -> 0 below the browse cap ends at once (no 10 s idle tail)', async () => {
    let clock = 0;
    let pending = 6;
    const tracker = createPoolProgressTracker({
      read: () => ({ count: 127, pending, complete: pending === 0 }),
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
        pending = Math.max(0, pending - 1);
      },
    });
    let step = await tracker.next();
    for (let i = 0; i < 100 && !step.final; i += 1) step = await tracker.next();
    assert.equal(step.final, true);
    assert.equal(step.complete, true);
    assert.ok(clock < POOL_PROGRESS_IDLE_MS, `ended after ${clock} ms, not after the idle timeout`);
  });

  it('old behaviour (pending null, below cap) needs the idle timeout - documents the SF-026 tail', async () => {
    let clock = 0;
    const tracker = createPoolProgressTracker({
      read: () => ({ count: 127, pending: null, complete: false }),
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });
    let step = await tracker.next();
    for (let i = 0; i < 1000 && !step.final; i += 1) step = await tracker.next();
    assert.equal(step.final, true);
    assert.ok(clock >= POOL_PROGRESS_IDLE_MS);
  });

  it('a stalled pool (pending stays > 0, nothing changes) still ends via the idle timeout, never earlier', async () => {
    let clock = 0;
    const tracker = createPoolProgressTracker({
      read: () => ({ count: 40, pending: 3, complete: false }),
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
      },
    });
    let step = await tracker.next();
    for (let i = 0; i < 1000 && !step.final; i += 1) step = await tracker.next();
    assert.equal(step.final, true);
    assert.ok(clock >= POOL_PROGRESS_IDLE_MS);
  });

  it('late pricing inside the idle window keeps the stream open and is counted', async () => {
    let clock = 0;
    let count = 40;
    let pending = 3;
    const tracker = createPoolProgressTracker({
      read: () => ({ count, pending, complete: pending === 0 }),
      now: () => clock,
      sleep: async (ms) => {
        clock += ms;
        if (clock >= 8000 && pending === 3) {
          count = 43;
          pending = 0;
        }
      },
    });
    let step = await tracker.next();
    for (let i = 0; i < 1000 && !step.final; i += 1) step = await tracker.next();
    assert.equal(step.final, true);
    assert.equal(step.count, 43, 'the late B is in the final count');
    assert.equal(step.complete, true);
  });
});

describe('SF-026 source guards: wiring only; Page 1 freeze / S6 / admission untouched', () => {
  it('pagination stream completes on pending === 0 and keeps the 150 cap', () => {
    const stream = readFileSync('components/results/page1-receipt-stream.tsx', 'utf8');
    assert.match(stream, /readPoolPending\s*\?\s*readPoolPending\(\)\s*:\s*null/);
    assert.match(stream, /count >= RESULTS_USER_PAGINATION_CAP \|\| pending === 0/);
    assert.match(stream, /<SyncPage1IdsToUrl/);
    assert.match(stream, /page1Ids=\{output\.page1Ids\}/);
    const section = readFileSync('components/results/catalog-live-section.tsx', 'utf8');
    assert.match(section, /getSharedResultsPoolReader\(filtered, filteringParams\)/);
    assert.match(section, /readPoolPending=\{\(\) => poolReader\(\)\.pending\}/);
  });

  it('S6, P2, rolling pricing and admission do not reference the pool reader', () => {
    for (const file of [
      'lib/search/s6-dynamic-refill.ts',
      'lib/search/p2-background-warm.ts',
      'lib/search/rolling-exact-pricing.ts',
      'lib/search/live-pricing-admission.ts',
      'lib/search/schedule-capped-matchset-live-after-page.ts',
    ]) {
      assert.doesNotMatch(readFileSync(file, 'utf8'), /results-pool-reading|readPoolPending/, file);
    }
  });
});