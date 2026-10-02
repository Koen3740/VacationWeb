import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { clearLivePriceInflightForTests } from '@/lib/providers/prijsvrij/page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from '@/lib/providers/prijsvrij/receipt-auth';
import { clearResultsLivePriceCache } from '@/lib/search/results-live-price-cache';
import { clearLivePriceObservabilityForTests } from '@/lib/search/live-price-observability';
import { resetLivePriceCircuitForTests } from '@/lib/providers/live-price-circuit';
import { LIVE_PRICE_EXACT_BATCH_MAX, beginOrContinuePricingRun } from '@/lib/search/live-pricing-admission';
import { runS6DynamicRefill } from '@/lib/search/s6-dynamic-refill';
import { runP2BackgroundWarm } from '@/lib/search/p2-background-warm';

afterEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
  clearPrijsvrijReceiptTokenCache();
  clearLivePriceObservabilityForTests();
  resetLivePriceCircuitForTests();
});

function makePv(n: number): TravelOffer {
  return {
    id: `prijsvrij-${n}-2026-08-20-8-900-LG`,
    provider: 'Prijsvrij',
    hotelName: 'PV Hotel',
    destinationCountry: 'Portugal',
    destinationRegion: 'Algarve',
    departureDate: '2026-08-20',
    nights: 8,
    flightIncluded: 'true',
    price: 100 + n,
    pricePerDay: 20,
    boardType: 'Logies',
    imageUrl: 'https://example.com/a.jpg',
    deepLink:
      'https://www.prijsvrij.be/vakantie/?r=https%3A%2F%2Fwww.prijsvrij.be%2Fvakanties%2Fportugal%3Fvertrekdatum%3D2026-08-20%26reisduurdagen%3D8%26transport%3Dvl',
  };
}

const receiptBody = (n: number) =>
  JSON.stringify({
    Receipt: {
      Package: {
        PriceInfo: { TotalInclLocal: { Value: 200 + n } },
        PaxDetails: { Adults: 2, Children: 0 },
      },
    },
  });

/** Receipt fetch with per-hotel latency; records peak in-flight and start order. */
function makeTimedFetch(slowHotel: string | null, slowMs: number) {
  const stat = { started: [] as string[], inFlight: 0, peak: 0, startedWhileSlowPending: 0, slowPending: false };
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 'r'.repeat(40) }), { status: 200 });
    }
    const hotelId = /\/(\d+)\/receipt\//.exec(url)?.[1] ?? '';
    stat.started.push(hotelId);
    if (stat.slowPending) stat.startedWhileSlowPending += 1;
    const slow = hotelId === slowHotel;
    if (slow) stat.slowPending = true;
    stat.inFlight += 1;
    stat.peak = Math.max(stat.peak, stat.inFlight);
    await new Promise((r) => setTimeout(r, slow ? slowMs : 15));
    stat.inFlight -= 1;
    if (slow) stat.slowPending = false;
    return new Response(receiptBody(Number(hotelId || '0')), { status: 200 });
  };
  return { stat, fetchImpl };
}

const params: SearchParams = { adults: 2, sort: 'price' };

test('t337u rolling S6: slow offer does not gate the window; ceilings hold; one attempt per offer', async () => {
  const catalog = Array.from({ length: 40 }, (_, i) => makePv(5000 + i));
  const { stat, fetchImpl } = makeTimedFetch('5000', 400);
  const result = await runS6DynamicRefill(catalog, params, { fetchImpl, maxNewAttempts: 40, maxEmptyBatches: 100 });
  assert.equal(result.telemetry.attempts, 40);
  assert.equal(new Set(stat.started).size, stat.started.length, 'one HTTP attempt per offer');
  assert.equal(stat.started.length, 40);
  assert.ok(stat.peak <= 5, `PV cap 5 not exceeded (peak ${stat.peak})`);
  assert.ok(stat.peak <= LIVE_PRICE_EXACT_BATCH_MAX);
  // A batch barrier admits at most 8 offers while the first one is slow; a rolling window keeps going.
  assert.ok(
    stat.startedWhileSlowPending > LIVE_PRICE_EXACT_BATCH_MAX,
    `rolling: ${stat.startedWhileSlowPending} offers started while the slow one was pending`,
  );
});

test('t337u rolling S6: demand-driven cap (maxNewAttempts) is exact, never pre-queues the matchset', async () => {
  const catalog = Array.from({ length: 60 }, (_, i) => makePv(5100 + i));
  const { stat, fetchImpl } = makeTimedFetch(null, 0);
  const result = await runS6DynamicRefill(catalog, params, { fetchImpl, maxNewAttempts: 13, maxEmptyBatches: 100 });
  assert.equal(result.telemetry.attempts, 13);
  assert.equal(stat.started.length, 13);
  assert.equal(result.telemetry.stopReason, 'max_attempts');
});

test('t337u rolling P2: walks every eligible offer once, within per-provider cap', async () => {
  const catalog = Array.from({ length: 30 }, (_, i) => makePv(5200 + i));
  const run = beginOrContinuePricingRun(`t337u-p2-all-${Date.now()}`);
  const { stat, fetchImpl } = makeTimedFetch('5200', 200);
  const result = await runP2BackgroundWarm(catalog, params, { fetchImpl, pricingRunId: run.runId });
  assert.equal(result.stopReason, 'exhausted');
  assert.equal(result.attempts, 30);
  assert.equal(new Set(stat.started).size, 30);
  assert.ok(stat.peak <= 5, `peak ${stat.peak}`);
  assert.ok(stat.startedWhileSlowPending > LIVE_PRICE_EXACT_BATCH_MAX);
});

test('t337u rolling P2: supersession stops new admits and drains in-flight offers', async () => {
  const catalog = Array.from({ length: 200 }, (_, i) => makePv(5300 + i));
  const run = beginOrContinuePricingRun(`t337u-p2-sup-a-${Date.now()}`);
  const { stat, fetchImpl } = makeTimedFetch(null, 0);
  const promise = runP2BackgroundWarm(catalog, params, { fetchImpl, pricingRunId: run.runId });
  await new Promise((r) => setTimeout(r, 60));
  beginOrContinuePricingRun(`t337u-p2-sup-b-${Date.now()}`); // supersedes run A
  const result = await promise;
  assert.equal(result.stopReason, 'superseded');
  assert.ok(result.attempts < 200, `attempts ${result.attempts}`);
  assert.ok(stat.started.length <= result.attempts + 1);
  assert.equal(stat.inFlight, 0, 'nothing left in flight after return');
});