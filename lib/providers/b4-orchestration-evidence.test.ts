/**
 * Fase B4 — gates + orchestration evidence (keep-alive, Corendon-only C bump, circuit).
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import { clearResultsLivePriceCache } from '../search/results-live-price-cache';
import {
  LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD,
  LIVE_PRICE_CIRCUIT_OPEN_MS,
  getLivePriceCircuitSnapshotForTests,
  isLivePriceCircuitOpen,
  recordLivePriceCircuitFailure,
  recordLivePriceCircuitSuccess,
  resetLivePriceCircuitForTests,
  setLivePriceCircuitNowMsForTests,
} from './live-price-circuit';
import { CORENDON_LIVE_MATCHSET_CONCURRENCY, CORENDON_LIVE_PAGE1_CONCURRENCY } from './corendon/constants';
import { ELIZA_LIVE_PAGE1_CONCURRENCY } from './eliza/constants';
import { SUNWEB_LIVE_PAGE1_CONCURRENCY } from './sunweb/constants';
import { corendonIpv4HttpsAgent } from '../http/prefer-ipv4';
import {
  PRIJSVRIJ_RECEIPT_MATCHSET_CONCURRENCY,
  clearLivePriceInflightForTests,
  priceLiveRequiredMatchset,
} from './prijsvrij/page1-receipt-pricing';

const ROOT = join(__dirname, '../..');

afterEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
  resetLivePriceCircuitForTests();
});

function makeCorendon(id = 'corendon-9514'): TravelOffer {
  return {
    id,
    provider: 'Corendon',
    hotelName: 'Corendon Hotel',
    destinationCountry: 'Portugal',
    departureDate: '2026-08-27',
    nights: 4,
    flightIncluded: 'true',
    price: 458,
    pricePerDay: 115,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
  };
}

function okLowestBody(): string {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: '2026-08-27T00:00:00',
        trip: {
          price: 876,
          tripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
          tripUrlHash:
            '[filters]BEL/BRU.*.*.*.0|||9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU|||true',
          priceTableDate: '20260827',
          durationInDays: 5,
        },
      },
    },
  });
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function okUpsalesBody(): string {
  return JSON.stringify({
    result: {
      extendedTripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
      prices: {
        totalPrice: 1200,
        priceTableCalculatedPricePerPerson: 600,
        displayedPricePerPerson: 600,
      },
      selectedTripCudl: {
        selectedTrip: { system: { request: { departureDate: '2026-08-27' } } },
      },
    },
  });
}

test('B4 gate V1: waitUntil schedules priceLiveRequiredMatchset which writes live-price cache', () => {
  const schedule = readFileSync(join(ROOT, 'lib/search/schedule-results-matchset-live-pricing.ts'), 'utf8');
  const prepare = readFileSync(join(ROOT, 'lib/search/prepare-results-offers.ts'), 'utf8');
  const pricing = readFileSync(join(ROOT, 'lib/providers/prijsvrij/page1-receipt-pricing.ts'), 'utf8');
  assert.match(schedule, /waitUntil\(tracked\)/);
  assert.equal(schedule.includes('setResultsLivePriceOverlay'), false);
  assert.match(prepare, /scheduleResultsMatchsetLivePricing/);
  assert.match(prepare, /priceLiveRequiredMatchset/);
  assert.match(pricing, /setResultsLivePriceOverlay/);
  // Must not mutate a sent response — scheduler only tracks + waitUntil.
  assert.equal(/Response|res\.|headers\.set/.test(schedule), false);
});

test('B4 Corendon concurrency raised alone; others stay at 5', () => {
  assert.equal(CORENDON_LIVE_PAGE1_CONCURRENCY, 8);
  assert.equal(CORENDON_LIVE_MATCHSET_CONCURRENCY, 8);
  assert.equal(ELIZA_LIVE_PAGE1_CONCURRENCY, 5);
  assert.equal(SUNWEB_LIVE_PAGE1_CONCURRENCY, 5);
  assert.equal(PRIJSVRIJ_RECEIPT_MATCHSET_CONCURRENCY, 5);
});

test('B4 Corendon IPv4 path uses keep-alive agent', () => {
  assert.equal(corendonIpv4HttpsAgent.options.keepAlive, true);
  const prefer = readFileSync(join(ROOT, 'lib/http/prefer-ipv4.ts'), 'utf8');
  assert.match(prefer, /agent:\s*corendonIpv4HttpsAgent/);
  assert.match(prefer, /keepAlive:\s*true/);
});

test('circuit opens after threshold technical failures and blocks until cool-down', () => {
  setLivePriceCircuitNowMsForTests(1_000);
  for (let i = 0; i < LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD - 1; i += 1) {
    recordLivePriceCircuitFailure('corendon');
    assert.equal(isLivePriceCircuitOpen('corendon'), false);
  }
  recordLivePriceCircuitFailure('corendon');
  assert.equal(isLivePriceCircuitOpen('corendon'), true);
  assert.equal(getLivePriceCircuitSnapshotForTests('corendon').openUntilMs, 1_000 + LIVE_PRICE_CIRCUIT_OPEN_MS);

  setLivePriceCircuitNowMsForTests(1_000 + LIVE_PRICE_CIRCUIT_OPEN_MS);
  assert.equal(isLivePriceCircuitOpen('corendon'), false);
});

test('circuit success resets failure streak; business miss does not open circuit', () => {
  setLivePriceCircuitNowMsForTests(5_000);
  for (let i = 0; i < LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD - 1; i += 1) {
    recordLivePriceCircuitFailure('sunweb');
  }
  recordLivePriceCircuitSuccess('sunweb');
  assert.equal(getLivePriceCircuitSnapshotForTests('sunweb').consecutiveFailures, 0);
  assert.equal(isLivePriceCircuitOpen('sunweb'), false);

  for (let i = 0; i < LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD; i += 1) {
    // Simulate non-technical path: success recording after empty/unavailable.
    recordLivePriceCircuitSuccess('eliza');
  }
  assert.equal(isLivePriceCircuitOpen('eliza'), false);
});

test('circuits are independent per provider', () => {
  setLivePriceCircuitNowMsForTests(9_000);
  for (let i = 0; i < LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD; i += 1) {
    recordLivePriceCircuitFailure('prijsvrij');
  }
  assert.equal(isLivePriceCircuitOpen('prijsvrij'), true);
  assert.equal(isLivePriceCircuitOpen('corendon'), false);
});

test('open circuit skips Corendon HTTP; cool-down allows one probe again', async () => {
  const params = { adults: 2 };
  let lowestCalls = 0;
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url.includes('lowestpricesacco')) {
      lowestCalls += 1;
      return new Response(okLowestBody(), { status: 200 });
    }
    if (url.includes('upsales')) {
      return new Response(okUpsalesBody(), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  setLivePriceCircuitNowMsForTests(10_000);
  for (let i = 0; i < LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD; i += 1) {
    recordLivePriceCircuitFailure('corendon');
  }
  assert.equal(isLivePriceCircuitOpen('corendon'), true);

  await priceLiveRequiredMatchset([makeCorendon('corendon-9514-open')], params, { fetchImpl });
  assert.equal(lowestCalls, 0);

  setLivePriceCircuitNowMsForTests(10_000 + LIVE_PRICE_CIRCUIT_OPEN_MS);
  clearResultsLivePriceCache();
  assert.equal(isLivePriceCircuitOpen('corendon'), false);

  await priceLiveRequiredMatchset([makeCorendon('corendon-9514-probe')], params, { fetchImpl });
  assert.equal(lowestCalls, 1);
});

test('technical failures via live path open circuit; success recovers', async () => {
  const params = { adults: 2 };
  let mode: 'fail' | 'ok' = 'fail';
  let calls = 0;
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url.includes('lowestpricesacco')) {
      calls += 1;
      if (mode === 'fail') {
        return new Response('gateway', { status: 503 });
      }
      return new Response(okLowestBody(), { status: 200 });
    }
    if (url.includes('upsales')) {
      return new Response(okUpsalesBody(), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  setLivePriceCircuitNowMsForTests(20_000);
  for (let i = 0; i < LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD; i += 1) {
    await priceLiveRequiredMatchset([makeCorendon(`corendon-9514-fail-${i}`)], params, { fetchImpl });
  }
  assert.equal(isLivePriceCircuitOpen('corendon'), true);
  const callsWhenOpened = calls;

  await priceLiveRequiredMatchset([makeCorendon('corendon-9514-blocked')], params, { fetchImpl });
  assert.equal(calls, callsWhenOpened);

  setLivePriceCircuitNowMsForTests(20_000 + LIVE_PRICE_CIRCUIT_OPEN_MS);
  mode = 'ok';
  clearResultsLivePriceCache();
  assert.equal(isLivePriceCircuitOpen('corendon'), false);
  await priceLiveRequiredMatchset([makeCorendon('corendon-9514-recover')], params, { fetchImpl });
  assert.equal(isLivePriceCircuitOpen('corendon'), false);
  assert.ok(calls > callsWhenOpened);
});

test('warm process-local cache: second matchset request does zero Corendon HTTP', async () => {
  const params = { adults: 2 };
  let lowestCalls = 0;
  const fetchImpl = (async (input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url.includes('lowestpricesacco')) {
      lowestCalls += 1;
      return new Response(okLowestBody(), { status: 200 });
    }
    if (url.includes('upsales')) {
      return new Response(okUpsalesBody(), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;

  const offer = makeCorendon('corendon-9514-warm');
  await priceLiveRequiredMatchset([offer], params, { fetchImpl });
  assert.equal(lowestCalls, 1);
  // Inflight clear resets circuit too — fine here; cache must still prevent HTTP.
  clearLivePriceInflightForTests();
  await priceLiveRequiredMatchset([offer], params, { fetchImpl });
  assert.equal(lowestCalls, 1);
});
