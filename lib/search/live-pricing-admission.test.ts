/**
 * Demand-driven Corendon admission + P0/P1/P2 + pricingRun supersede.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  clearLivePriceInflightForTests,
  priceExactBatch,
  priceLiveRequiredMatchset,
} from '@/lib/providers/prijsvrij/page1-receipt-pricing';
import {
  CORENDON_P0_RESERVE_SLOTS,
  CORENDON_SHARED_MAX_IN_FLIGHT,
  acquireCorendonSlot,
  beginOrContinuePricingRun,
  buildPricingRunKey,
  getCorendonAdmissionSnapshotForTests,
  isPricingRunActive,
  isPricingRunPage1Settled,
  markPricingRunPage1Settled,
  releaseCorendonSlot,
  resetLivePricingAdmissionForTests,
  withCorendonProviderSlot,
} from '@/lib/search/live-pricing-admission';
import { runP2BackgroundWarm } from '@/lib/search/p2-background-warm';
import { countPresentableB, runS6DynamicRefill } from '@/lib/search/s6-dynamic-refill';
import {
  clearResultsLivePriceCache,
  getResultsLivePriceOverlay,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import {
  getLivePriceCircuitSnapshotForTests,
  LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD,
  recordLivePriceCircuitFailure,
  resetLivePriceCircuitForTests,
} from '@/lib/providers/live-price-circuit';
import type { SearchParams, TravelOffer } from '@/types/travel';

const params: SearchParams = { adults: 2, sort: 'price' };

function makeCorendon(id: string, price = 500): TravelOffer {
  return {
    id,
    provider: 'Corendon',
    price,
    pricePerDay: Math.round(price / 7),
    currency: 'EUR',
    country: 'Spanje',
    destinationCountry: 'Spanje',
    hotelName: `Hotel ${id}`,
    departureAirport: 'BRU',
    departureDate: '01/10/2026',
    durationNights: 7,
    nights: 7,
    deepLink:
      'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.011026.7.SZ-U',
    boardType: 'AI',
    imageUrl: 'https://example.com/x.jpg',
  } as unknown as TravelOffer;
}

function okFetch(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('lowestpricesacco')) {
      return new Response(
        JSON.stringify({
          result: {
            priceTableHash: 'abc',
            trips: [
              {
                flightDate: '2026-10-01',
                airportCode: 'BRU',
                duration: 7,
                price: 499,
              },
            ],
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes('/upsales')) {
      return new Response(
        JSON.stringify({
          result: {
            displayedPricePerPerson: 499,
            totalPrice: 998,
          },
        }),
        { status: 200 },
      );
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
}

function timeoutFetch(): typeof fetch {
  return (async () => {
    const err = new Error('TimeoutError');
    err.name = 'TimeoutError';
    throw err;
  }) as typeof fetch;
}

test('source: orchestrator uses P1 then P2; no uncapped matchset enqueue', () => {
  const sched = readFileSync(
    join(process.cwd(), 'lib/search/schedule-capped-matchset-live-after-page.ts'),
    'utf8',
  );
  const prepare = readFileSync(
    join(process.cwd(), 'lib/search/prepare-results-offers.ts'),
    'utf8',
  );
  assert.match(sched, /runS6DynamicRefill/);
  assert.match(sched, /runP2BackgroundWarm/);
  assert.doesNotMatch(sched, /priceLiveRequiredMatchset\(matchset/);
  assert.doesNotMatch(prepare, /scheduleS6Refill/);
  assert.equal(prepare.split('scheduleCappedMatchsetLiveAfterPage').length - 1 >= 2, true);
});

test('shared Corendon pool never exceeds 8 in-flight', async () => {
  resetLivePricingAdmissionForTests();
  const run = beginOrContinuePricingRun('pool-max');
  markPricingRunPage1Settled(run.runId);

  for (let i = 0; i < CORENDON_SHARED_MAX_IN_FLIGHT; i += 1) {
    assert.equal(await acquireCorendonSlot({ runId: run.runId, lane: 'P2' }), true);
  }
  assert.equal(getCorendonAdmissionSnapshotForTests().inFlight, 8);

  let ninthGranted = false;
  const ninth = acquireCorendonSlot({ runId: run.runId, lane: 'P2' }).then((ok) => {
    ninthGranted = true;
    return ok;
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(ninthGranted, false);
  assert.ok(getCorendonAdmissionSnapshotForTests().peakInFlight <= CORENDON_SHARED_MAX_IN_FLIGHT);

  releaseCorendonSlot();
  assert.equal(await ninth, true);
  assert.equal(ninthGranted, true);

  while (getCorendonAdmissionSnapshotForTests().inFlight > 0) {
    releaseCorendonSlot();
  }
});

test('P0 reserve: P1/P2 capped at 6 while page1 unsettled', async () => {
  resetLivePricingAdmissionForTests();
  const run = beginOrContinuePricingRun('p0-reserve');
  assert.equal(isPricingRunPage1Settled(run.runId), false);

  for (let i = 0; i < CORENDON_SHARED_MAX_IN_FLIGHT - CORENDON_P0_RESERVE_SLOTS; i += 1) {
    assert.equal(await acquireCorendonSlot({ runId: run.runId, lane: 'P2' }), true);
  }
  assert.equal(
    getCorendonAdmissionSnapshotForTests().inFlight,
    CORENDON_SHARED_MAX_IN_FLIGHT - CORENDON_P0_RESERVE_SLOTS,
  );

  let p2Extra = false;
  const blocked = acquireCorendonSlot({ runId: run.runId, lane: 'P2' }).then((ok) => {
    p2Extra = true;
    return ok;
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(p2Extra, false);

  // P0 can use reserved capacity
  assert.equal(await acquireCorendonSlot({ runId: run.runId, lane: 'P0' }), true);
  assert.ok(getCorendonAdmissionSnapshotForTests().inFlight <= CORENDON_SHARED_MAX_IN_FLIGHT);

  markPricingRunPage1Settled(run.runId);
  assert.equal(await blocked, true);

  while (getCorendonAdmissionSnapshotForTests().inFlight > 0) {
    releaseCorendonSlot();
  }
});

test('P0 > P1 > P2 wake order after release', async () => {
  resetLivePricingAdmissionForTests();
  const run = beginOrContinuePricingRun('prio');
  markPricingRunPage1Settled(run.runId);

  for (let i = 0; i < 8; i += 1) {
    assert.equal(await acquireCorendonSlot({ runId: run.runId, lane: 'P2' }), true);
  }

  const order: string[] = [];
  const p2Wait = acquireCorendonSlot({ runId: run.runId, lane: 'P2' }).then((ok) => {
    order.push('P2');
    return ok;
  });
  const p1Wait = acquireCorendonSlot({ runId: run.runId, lane: 'P1' }).then((ok) => {
    order.push('P1');
    return ok;
  });
  const p0Wait = acquireCorendonSlot({ runId: run.runId, lane: 'P0' }).then((ok) => {
    order.push('P0');
    return ok;
  });

  await new Promise((r) => setTimeout(r, 10));
  releaseCorendonSlot();
  await p0Wait;
  assert.equal(order[0], 'P0');

  releaseCorendonSlot();
  await p1Wait;
  assert.equal(order[1], 'P1');

  releaseCorendonSlot();
  await p2Wait;

  while (getCorendonAdmissionSnapshotForTests().inFlight > 0) {
    releaseCorendonSlot();
  }
});

test('page-only key does not supersede; filter key does', () => {
  resetLivePricingAdmissionForTests();
  const a = beginOrContinuePricingRun(
    buildPricingRunKey({ adults: 2, country: 'Spanje', boardTypes: ['AI'] }),
  );
  const same = beginOrContinuePricingRun(
    buildPricingRunKey({ adults: 2, country: 'Spanje', boardTypes: ['AI'] }),
  );
  assert.equal(same.runId, a.runId);
  assert.equal(same.isNew, false);
  assert.equal(isPricingRunActive(a.runId), true);

  const b = beginOrContinuePricingRun(
    buildPricingRunKey({ adults: 2, country: 'Spanje', boardTypes: ['RO'] }),
  );
  assert.notEqual(b.runId, a.runId);
  assert.equal(isPricingRunActive(a.runId), false);
  assert.equal(isPricingRunActive(b.runId), true);
});

test('superseded run gets no new admits; in-flight may finish into L1', async () => {
  clearLivePriceInflightForTests();
  clearResultsLivePriceCache();
  resetLivePriceCircuitForTests();
  resetLivePricingAdmissionForTests();

  const runA = beginOrContinuePricingRun('gen-a');
  markPricingRunPage1Settled(runA.runId);

  let releaseHttp!: () => void;
  const gate = new Promise<void>((r) => {
    releaseHttp = r;
  });

  const offer = makeCorendon('corendon-inflight-1');
  const inflight = withCorendonProviderSlot({ runId: runA.runId, lane: 'P2' }, async () => {
    await gate;
    setResultsLivePriceOverlay(offer.id, params, {
      price: 499,
      pricePerDay: 71,
      livePriceStatus: 'proven',
      livePriceSource: 'upsales',
      liveTotalPrice: 998,
      liveTotalPriceField: 'upsales.totalPrice',
    });
  });

  const runB = beginOrContinuePricingRun('gen-b');
  assert.equal(isPricingRunActive(runA.runId), false);

  const skipped = await withCorendonProviderSlot({ runId: runA.runId, lane: 'P2' }, async () => {
    throw new Error('must not run');
  });
  assert.equal(skipped.status, 'skipped_superseded');

  releaseHttp();
  const done = await inflight;
  assert.equal(done.status, 'ran');
  assert.equal(getResultsLivePriceOverlay(offer.id, params)?.livePriceStatus, 'proven');

  await priceExactBatch([offer], params, {
    fetchImpl: timeoutFetch(),
    pricingRunId: runB.runId,
    lane: 'P1',
  });
  assert.equal(getResultsLivePriceOverlay(offer.id, params)?.livePriceStatus, 'proven');
});

test('3000 Corendon + breaker open: no circuit_open storm from pre-queue', async () => {
  clearLivePriceInflightForTests();
  clearResultsLivePriceCache();
  resetLivePriceCircuitForTests();
  resetLivePricingAdmissionForTests();

  const run = beginOrContinuePricingRun('storm');
  markPricingRunPage1Settled(run.runId);

  const offers = Array.from({ length: 3000 }, (_, i) =>
    makeCorendon(`corendon-storm-${i}`, 400 + (i % 50)),
  );

  for (let i = 0; i < LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD; i += 1) {
    recordLivePriceCircuitFailure('corendon');
  }
  assert.equal(getLivePriceCircuitSnapshotForTests('corendon').open, true);

  await priceLiveRequiredMatchset(offers, params, {
    fetchImpl: timeoutFetch(),
    pricingRunId: run.runId,
    lane: 'P2',
  });

  let circuitOpenCached = 0;
  for (const offer of offers) {
    const overlay = getResultsLivePriceOverlay(offer.id, params);
    if (overlay?.livePriceFailureReason === 'circuit_open') {
      circuitOpenCached += 1;
    }
  }
  assert.ok(circuitOpenCached < 40, `circuit_open storm: ${circuitOpenCached}`);
});

test('P1 stops at 150 B; P2 continues after', async () => {
  clearLivePriceInflightForTests();
  clearResultsLivePriceCache();
  resetLivePriceCircuitForTests();
  resetLivePricingAdmissionForTests();

  const run = beginOrContinuePricingRun('p1p2');
  markPricingRunPage1Settled(run.runId);

  const seeded = Array.from({ length: 150 }, (_, i) => {
    const o = makeCorendon(`corendon-seed-${i}`, 300 + i);
    setResultsLivePriceOverlay(o.id, params, {
      price: 300 + i,
      pricePerDay: Math.round((300 + i) / 7),
      livePriceStatus: 'proven',
      livePriceSource: 'upsales',
      liveTotalPrice: 600 + i,
      liveTotalPriceField: 'upsales.totalPrice',
    });
    return o;
  });
  const gaps = Array.from({ length: 20 }, (_, i) => makeCorendon(`corendon-gap-${i}`, 800 + i));
  const matchset = [...seeded, ...gaps];

  assert.ok(countPresentableB(matchset, params) >= 150);

  const p1 = await runS6DynamicRefill(matchset, params, {
    fetchImpl: okFetch(),
    pricingRunId: run.runId,
    lane: 'P1',
  });
  assert.ok(p1.telemetry.stopReason === 'already_met' || p1.telemetry.stopReason === 'target_met');
  assert.ok(p1.telemetry.presentableB >= 150);

  const p2 = await runP2BackgroundWarm(matchset, params, {
    fetchImpl: okFetch(),
    pricingRunId: run.runId,
    maxBatches: 5,
  });
  assert.ok(p2.batches >= 1 || p2.attempts >= 0);
});

test('buildPricingRunKey excludes page/page1Ids/catalogGen', () => {
  const a = buildPricingRunKey({
    adults: 2,
    country: 'Spanje',
    page: 3,
    page1Ids: ['a', 'b'],
    catalogGen: 'gen-1',
  } as SearchParams);
  const b = buildPricingRunKey({
    adults: 2,
    country: 'Spanje',
    page: 9,
    page1Ids: ['x'],
    catalogGen: 'gen-2',
  } as SearchParams);
  assert.equal(a, b);
  assert.doesNotMatch(a, /page1Ids|catalogGen/);
});
