import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { SearchParams, TravelOffer } from '@/types/travel';
import {
  clearLivePriceInflightForTests,
  priceLiveRequiredMatchset,
} from '@/lib/providers/prijsvrij/page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from '@/lib/providers/prijsvrij/receipt-auth';
import {
  clearResultsLivePriceCache,
  hasResultsLivePriceOverlay,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import { clearLivePriceObservabilityForTests } from '@/lib/search/live-price-observability';
import {
  LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD,
  recordLivePriceCircuitFailure,
  resetLivePriceCircuitForTests,
} from '@/lib/providers/live-price-circuit';
import {
  S6_TARGET_PRESENTABLE_B,
  countPresentableB,
  runS6DynamicRefill,
  selectS6RefillBatch,
} from '@/lib/search/s6-dynamic-refill';
import { prepareResultsOffers, rankCatalogOffers } from '@/lib/search/prepare-results-offers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

afterEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
  clearPrijsvrijReceiptTokenCache();
  clearLivePriceObservabilityForTests();
  resetLivePriceCircuitForTests();
});

function okReceiptBody(total: number): string {
  return JSON.stringify({
    Receipt: {
      Package: {
        PriceInfo: { TotalInclLocal: { Value: total } },
        PaxDetails: { Adults: 2, Children: 0 },
      },
    },
  });
}

function makePv(id: string, price: number): TravelOffer {
  return {
    id,
    provider: 'Prijsvrij',
    hotelName: 'PV Hotel',
    destinationCountry: 'Portugal',
    destinationRegion: 'Algarve',
    departureDate: '2026-08-20',
    nights: 8,
    flightIncluded: 'true',
    price,
    pricePerDay: Math.round(price / 8),
    boardType: 'Logies',
    imageUrl: 'https://example.com/a.jpg',
    deepLink:
      'https://www.prijsvrij.be/vakantie/?r=https%3A%2F%2Fwww.prijsvrij.be%2Fvakanties%2Fportugal%3Fvertrekdatum%3D2026-08-20%26reisduurdagen%3D8%26transport%3Dvl',
  };
}

function makeSunwebBroken(id: string, price: number): TravelOffer {
  return {
    id,
    provider: 'Sunweb',
    hotelName: 'Sun',
    destinationCountry: 'Portugal',
    departureDate: '2026-08-20',
    nights: 8,
    flightIncluded: 'true',
    departureAirport: 'BRU',
    price,
    pricePerDay: 44,
    boardType: 'All Inclusive',
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=https%3A%2F%2Fwww.sunweb.be%2Fx',
  };
}

function makeCorendon(id: string, hotelId: string, price: number): TravelOffer {
  return {
    id,
    provider: 'Corendon',
    hotelName: 'Cor',
    destinationCountry: 'Spanje',
    departureDate: '2026-08-27',
    departureAirport: 'BRU',
    nights: 4,
    flightIncluded: 'true',
    price,
    pricePerDay: Math.round(price / 4),
    imageUrl: 'https://example.com/a.jpg',
    feedSourceId: 'corendon-benl',
    listingHost: 'www.corendon.be',
    deepLink: `https://www.corendon.be/vakantie#${hotelId}.COSPY.BRUCFU.270826.3-4-3.SZ-U`,
  };
}

function makeEliza(id: string, price: number): TravelOffer {
  return {
    id,
    provider: 'Eliza was here',
    hotelName: 'Eliza Hotel',
    destinationCountry: 'Spanje',
    departureDate: '2026-08-20',
    departureAirport: 'BRU',
    nights: 8,
    flightIncluded: 'true',
    price,
    pricePerDay: Math.round(price / 8),
    boardType: 'All Inclusive',
    imageUrl: 'https://example.com/a.jpg',
    deepLink: `https://www.elizawashere.nl/reis/${id}`,
  };
}

function seedPresentableB(offer: TravelOffer, params: SearchParams, total: number): void {
  setResultsLivePriceOverlay(offer.id, params, {
    price: offer.price,
    pricePerDay: offer.pricePerDay,
    livePriceStatus: 'proven',
    livePriceSource: 'receipt',
    liveTotalPrice: total,
    liveTotalPriceField: 'receipt.TotalInclLocal',
  });
}

/** Card-presentable B overlay (Eliza / Sunweb — not parked). */
function seedCardPresentableB(offer: TravelOffer, params: SearchParams, total: number): void {
  setResultsLivePriceOverlay(offer.id, params, {
    price: offer.price,
    pricePerDay: offer.pricePerDay,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: total,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
}

function makeReceiptFetch(counter: { posts: number; urls: string[] }, failIds?: Set<string>) {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 'r'.repeat(40) }), { status: 200 });
    }
    const hotelId = /\/(\d+)\/receipt\//.exec(url)?.[1] ?? '';
    counter.posts += 1;
    counter.urls.push(url);
    if (failIds?.has(hotelId)) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(okReceiptBody(200 + Number(hotelId || '0')), { status: 200 });
  };
}

const params: SearchParams = { adults: 2, sort: 'price' };

test('S6 product target is 150 B not 10/20', () => {
  assert.equal(S6_TARGET_PRESENTABLE_B, 150);
});

test('Scenario A — enough card B: stop at target without extra HTTP', async () => {
  const catalog = Array.from({ length: 160 }, (_, i) => makeEliza(`eliza-${1000 + i}`, 100 + i));
  for (const offer of catalog.slice(0, 150)) {
    seedCardPresentableB(offer, params, 800);
  }
  assert.equal(countPresentableB(catalog, params), 150);
  const http = { posts: 0, urls: [] as string[] };
  const result = await runS6DynamicRefill(catalog, params, {
    fetchImpl: makeReceiptFetch(http),
    targetB: 150,
  });
  assert.equal(result.telemetry.stopReason, 'already_met');
  assert.equal(result.telemetry.attempts, 0);
  assert.equal(http.posts, 0);
  assert.equal(result.telemetry.presentableB, 150);
});

test('parked Prijsvrij never counts toward S6 target', () => {
  const catalog = Array.from({ length: 20 }, (_, i) =>
    makePv(`prijsvrij-${1100 + i}-2026-08-20-8-900-LG`, 100 + i),
  );
  for (const offer of catalog) {
    seedPresentableB(offer, params, 800);
  }
  assert.equal(countPresentableB(catalog, params), 0);
});

test('Scenario B — A/C do not stop: continue until target or exhausted', async () => {
  // Mix: 10 PV failures (parked, never cards) + 10 card-presentable Eliza already B.
  // Target 5 card B → already met from Eliza; no need to wait on parked PV.
  const pv = Array.from({ length: 10 }, (_, i) =>
    makePv(`prijsvrij-${2000 + i}-2026-08-20-8-900-LG`, 100 + i),
  );
  const eliza = Array.from({ length: 10 }, (_, i) => makeEliza(`eliza-b-${2000 + i}`, 200 + i));
  for (const offer of eliza.slice(0, 5)) {
    seedCardPresentableB(offer, params, 900);
  }
  const catalog = [...pv, ...eliza];
  assert.equal(countPresentableB(catalog, params), 5);
  const failIds = new Set(Array.from({ length: 10 }, (_, i) => String(2000 + i)));
  const http = { posts: 0, urls: [] as string[] };
  const result = await runS6DynamicRefill(catalog, params, {
    fetchImpl: makeReceiptFetch(http, failIds),
    targetB: 5,
    maxNewAttempts: 40,
  });
  assert.ok(result.telemetry.presentableB >= 5, `B=${result.telemetry.presentableB}`);
  assert.equal(result.telemetry.stopReason, 'already_met');
  assert.equal(result.telemetry.attempts, 0);
});

test('Scenario B2 — pricing continues past failures; parked success still does not meet target', async () => {
  // Only Prijsvrij: receipts may succeed, but parked B never reaches the card target.
  const catalog = Array.from({ length: 20 }, (_, i) =>
    makePv(`prijsvrij-${2100 + i}-2026-08-20-8-900-LG`, 100 + i),
  );
  const failIds = new Set(Array.from({ length: 10 }, (_, i) => String(2100 + i)));
  const http = { posts: 0, urls: [] as string[] };
  const result = await runS6DynamicRefill(catalog, params, {
    fetchImpl: makeReceiptFetch(http, failIds),
    targetB: 5,
    maxNewAttempts: 40,
  });
  assert.equal(result.telemetry.presentableB, 0);
  assert.ok(result.telemetry.attempts > 5, 'must price past A/empty even when parked');
  assert.ok(
    result.telemetry.stopReason === 'matchset_exhausted' ||
      result.telemetry.stopReason === 'no_eligible_candidates' ||
      result.telemetry.stopReason === 'no_progress' ||
      result.telemetry.stopReason === 'max_attempts',
  );
});

test('Scenario C — cached card B counts; no HTTP for that offer', async () => {
  const cached = makeEliza('eliza-3001', 100);
  const next = makeEliza('eliza-3002', 110);
  seedCardPresentableB(cached, params, 900);
  seedCardPresentableB(next, params, 910);
  const http = { posts: 0, urls: [] as string[] };
  const result = await runS6DynamicRefill([cached, next], params, {
    fetchImpl: makeReceiptFetch(http),
    targetB: 2,
  });
  assert.ok(hasResultsLivePriceOverlay(cached.id, params));
  assert.equal(http.posts, 0);
  assert.ok(result.telemetry.presentableB >= 2);
  assert.equal(result.telemetry.stopReason, 'already_met');
});

test('Scenario D — missing context skipped; cursor continues', () => {
  const broken = makeSunwebBroken('sun-feed-1', 50);
  const ok = makePv('prijsvrij-4001-2026-08-20-8-900-LG', 120);
  const selected = selectS6RefillBatch([broken, ok], params, 0, 5);
  assert.equal(selected.batch.length, 1);
  assert.equal(selected.batch[0]?.id, ok.id);
  assert.ok(selected.skippedMissingContext >= 1);
});

test('Scenario E — circuit open skipped; healthy provider batched', () => {
  for (let i = 0; i < LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD; i += 1) {
    recordLivePriceCircuitFailure('sunweb');
  }
  const sun = makeCorendon('corendon-ignore', '9514', 80);
  // Valid sunweb with context would be skipped when circuit open — use sunweb id with context
  const landing =
    'https://www.sunweb.be/nl/x?Accommodation=55&DepartureDate=2026-08-27&Duration=8&DepartureAirport=BRU&Mealplan=AI&TransportType=Flight&Participants[0][0]=1990-01-01&Participants[0][1]=1990-01-02';
  const sunweb: TravelOffer = {
    id: 'sunweb-55',
    provider: 'Sunweb',
    hotelName: 'Sun',
    destinationCountry: 'Spanje',
    departureDate: '2026-08-27',
    departureAirport: 'BRU',
    nights: 8,
    flightIncluded: 'true',
    price: 80,
    pricePerDay: 10,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: `https://tc.tradetracker.net/?c=1&r=${encodeURIComponent(landing)}`,
  };
  const pv = makePv('prijsvrij-5001-2026-08-20-8-900-LG', 90);
  const selected = selectS6RefillBatch([sunweb, pv], params, 0, 2);
  assert.ok(selected.batch.every((o) => o.provider === 'Prijsvrij'));
  assert.ok(selected.skippedCircuitOpen >= 1);
  void sun;
});

test('Scenario F — small matchset: stop without endless loop', async () => {
  const catalog = Array.from({ length: 8 }, (_, i) =>
    makePv(`prijsvrij-${6000 + i}-2026-08-20-8-900-LG`, 100 + i),
  );
  const http = { posts: 0, urls: [] as string[] };
  const result = await runS6DynamicRefill(catalog, params, {
    fetchImpl: makeReceiptFetch(http),
    targetB: 150,
  });
  assert.ok(result.telemetry.presentableB < 150);
  assert.ok(
    result.telemetry.stopReason === 'matchset_exhausted' ||
      result.telemetry.stopReason === 'no_eligible_candidates' ||
      result.telemetry.stopReason === 'no_progress',
  );
  assert.ok(result.telemetry.eligibleCandidateCount <= 8);
  assert.ok(result.telemetry.attempts <= 8);
});

test('Scenario G — active price sort: catalog order drives candidate cursor', () => {
  const expensive = makePv('prijsvrij-7002-2026-08-20-8-900-LG', 500);
  const cheap = makePv('prijsvrij-7001-2026-08-20-8-900-LG', 100);
  const ranked = rankCatalogOffers([expensive, cheap], params);
  assert.equal(ranked[0]?.id, cheap.id);
  const selected = selectS6RefillBatch(ranked, params, 0, 1);
  assert.equal(selected.batch[0]?.id, cheap.id);
});

test('Scenario H — DEC-011: one attempt per offer; C not re-queued same run', async () => {
  const offer = makePv('prijsvrij-8001-2026-08-20-8-900-LG', 100);
  const http = { posts: 0, urls: [] as string[] };
  // First: force failure
  await priceLiveRequiredMatchset([offer], params, {
    fetchImpl: makeReceiptFetch(http, new Set(['8001'])),
  });
  assert.ok(hasResultsLivePriceOverlay(offer.id, params));
  const postsAfterFirst = http.posts;
  const result = await runS6DynamicRefill([offer], params, {
    fetchImpl: makeReceiptFetch(http, new Set(['8001'])),
    targetB: 150,
  });
  assert.equal(http.posts, postsAfterFirst, 'settled C must not be re-HTTP in same S6 run');
  assert.ok(result.telemetry.attempts === 0);
});

test('prepareResultsOffers schedules S6 (not blind windowRemainder string)', () => {
  const prepare = readFileSync(
    join(__dirname, 'prepare-results-offers.ts'),
    'utf8',
  );
  assert.ok(prepare.includes('runS6DynamicRefill') || prepare.includes('scheduleS6Refill'));
  assert.ok(prepare.includes('s6-dynamic-refill'));
  assert.ok(!prepare.includes('priceLiveRequiredMatchset(windowRemainder'));
});

test('prepareResultsOffers price-sort still awaits workset only for exactOffers', async () => {
  const catalog = Array.from({ length: 30 }, (_, i) =>
    makePv(`prijsvrij-${9000 + i}-2026-08-20-8-900-LG`, 100 + i),
  );
  const http = { posts: 0, urls: [] as string[] };
  const prepared = await prepareResultsOffers(catalog, params, {
    fetchImpl: makeReceiptFetch(http),
  });
  assert.equal(prepared.priceSortPending, true);
  const exact = await prepared.exactOffers;
  assert.equal(exact.length, catalog.length);
  // Workset ≤50; S6 may still be in flight — exact must resolve without waiting for 150 B.
  assert.ok(http.posts > 0);
});
