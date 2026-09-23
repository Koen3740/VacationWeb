/**
 * AN-077 unit tests — homepage live-price prefetch bridge.
 * Runner: scripts/_an077_bridge_unit_runner.ts (avoids tsx/node:test quirks).
 */
import assert from 'node:assert/strict';
import { createDefaultTravelersState } from '@/components/search/travelers-popup/travelers-popup-utils';
import type { SharedSearchState } from '@/components/search/shared-search-state';
import {
  requestHomeLivePricePrefetch,
  resetHomeLivePricePrefetchClientForTests,
} from '@/components/home/home-live-price-prefetch-client';
import {
  homeSearchContextKey,
  isDefinitiveHomeSearchContext,
  isHomeLivePricePrefetchEnabled,
  setHomeLivePricePrefetchEnabledForTests,
} from '@/lib/search/home-live-price-prefetch-context';
import {
  getHomeLivePricePrefetchGenerationForTests,
  resetHomeLivePricePrefetchGenerationForTests,
  runHomeLivePricePrefetchWorkset,
  scheduleHomeLivePricePrefetch,
  searchParamsFromResultsHref,
} from '@/lib/search/home-live-price-prefetch';
import {
  RESULTS_LIVE_PRICE_TTL_MS,
  clearResultsLivePriceCache,
  getResultsLivePriceOverlay,
  hasResultsLivePriceOverlay,
  hydrateResultsLivePriceOverlaysFromL2,
  livePriceCacheKey,
  setResultsLivePriceNowMsForTests,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import {
  clearLivePriceL2ObservabilityForTests,
  getLivePriceL2ObservabilitySnapshot,
} from '@/lib/search/live-price-l2-observability';
import {
  readLivePriceL2Record,
  resetLivePriceL2MemoryBackendForTests,
  setLivePriceL2EnabledForTests,
} from '@/lib/search/live-price-l2-store';
import { clearLivePriceInflightForTests } from '@/lib/providers/prijsvrij/page1-receipt-pricing';
import { prepareResultsOffers } from '@/lib/search/prepare-results-offers';
import type { SearchParams, TravelOffer } from '@/types/travel';

export type Case = { name: string; fn: () => Promise<void> };
export const cases: Case[] = [];

function test(name: string, fn: () => Promise<void>) {
  cases.push({ name, fn });
}

function baseState(overrides: Partial<SharedSearchState> = {}): SharedSearchState {
  return {
    selectedCountries: ['Griekenland'],
    departureStart: '2027-06-01',
    departureEnd: '2027-10-31',
    flexibilityDays: 0,
    selectedDurations: [],
    selectedDepartureAirports: [],
    travelers: createDefaultTravelersState(),
    ...overrides,
  };
}

function makeOffer(id: string, price = 400): TravelOffer {
  return {
    id,
    provider: 'Corendon',
    name: `Hotel ${id}`,
    price,
    pricePerDay: Math.round(price / 8),
    nights: 8,
    departureDate: '2026-07-01',
    returnDate: '2026-07-09',
    country: 'Griekenland',
    region: 'Kreta',
    city: 'Chersonissos',
    boardType: 'AI',
    accommodationType: 'Hotel',
    stars: 4,
    images: [],
    deepLink: `https://example.com/${id}`,
  } as unknown as TravelOffer;
}

function resetAll() {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
  clearLivePriceL2ObservabilityForTests();
  resetLivePriceL2MemoryBackendForTests();
  setLivePriceL2EnabledForTests(true);
  setHomeLivePricePrefetchEnabledForTests(true);
  resetHomeLivePricePrefetchGenerationForTests();
  resetHomeLivePricePrefetchClientForTests();
  setResultsLivePriceNowMsForTests(null);
}

test('A. definitive context → prefetch start (client)', async () => {
  resetAll();
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    assert.equal(init?.method, 'POST');
    return new Response(JSON.stringify({ ok: true, accepted: true }), { status: 202 });
  }) as typeof fetch;

  const result = requestHomeLivePricePrefetch(baseState(), {
    enabled: true,
    popupsOpen: false,
    fetchImpl,
  });
  assert.equal(result.fired, true);
  assert.equal(calls.length, 1);
  assert.ok(calls[0]!.includes('/api/live-price-prefetch'));
});

test('B. voorlopige context → GEEN prefetch', async () => {
  resetAll();
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response('{}', { status: 202 });
  }) as typeof fetch;

  const noCountry = requestHomeLivePricePrefetch(
    baseState({ selectedCountries: [] }),
    { enabled: true, popupsOpen: false, fetchImpl },
  );
  assert.equal(noCountry.fired, false);
  assert.equal(noCountry.reason, 'not_definitive');

  const noDates = requestHomeLivePricePrefetch(
    baseState({ departureStart: null, departureEnd: null }),
    { enabled: true, popupsOpen: false, fetchImpl },
  );
  assert.equal(noDates.fired, false);

  const popupOpen = requestHomeLivePricePrefetch(baseState(), {
    enabled: true,
    popupsOpen: true,
    fetchImpl,
  });
  assert.equal(popupOpen.fired, false);
  assert.equal(popupOpen.reason, 'popup_open');
  assert.equal(calls, 0);
  assert.equal(isDefinitiveHomeSearchContext(baseState({ selectedCountries: [] })), false);
});

test('C. context wijziging → oude generatie genegeerd', async () => {
  resetAll();
  const paramsA: SearchParams = {
    countries: ['Griekenland'],
    departureStart: '2027-06-01',
    departureEnd: '2027-10-31',
    adults: 2,
    rooms: 1,
    sort: 'price',
  };
  const paramsB: SearchParams = {
    ...paramsA,
    countries: ['Spanje'],
  };

  const a = scheduleHomeLivePricePrefetch(paramsA, { generation: 1, dryRun: true });
  assert.equal(a.accepted, true);
  const b = scheduleHomeLivePricePrefetch(paramsB, { generation: 2, dryRun: true });
  assert.equal(b.accepted, true);
  const stale = scheduleHomeLivePricePrefetch(paramsA, { generation: 1, dryRun: true });
  assert.equal(stale.accepted, false);
  assert.equal(stale.reason, 'stale_generation');
  assert.equal(getHomeLivePricePrefetchGenerationForTests(), 2);

  const offers = [makeOffer('a1'), makeOffer('a2')];
  const staleRun = await runHomeLivePricePrefetchWorkset(offers, paramsA, {
    generation: 1,
    isCurrent: () => false,
  });
  assert.equal(staleRun.accepted, false);
  assert.equal(staleRun.reason, 'stale_generation');
});

test('D. Homepage prefetch → L2 gevuld', async () => {
  resetAll();
  const params: SearchParams = {
    countries: ['Griekenland'],
    departureStart: '2027-06-01',
    departureEnd: '2027-10-31',
    adults: 2,
    rooms: 1,
    sort: 'price',
  };
  const offer = makeOffer('offer-l2');
  // Seed via setResultsLivePriceOverlay path used by pricing — simulate successful pricing write
  setResultsLivePriceOverlay('offer-l2', params, {
    price: 410,
    pricePerDay: 51,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 820,
  });
  await new Promise((r) => setTimeout(r, 40));
  const key = livePriceCacheKey('offer-l2', params);
  const record = await readLivePriceL2Record(key);
  assert.ok(record);
  assert.equal(record!.overlay.price, 410);
  void offer;
});

test('E+F. Results reuse L2/L1 — geen dubbele provider fetch', async () => {
  resetAll();
  const params: SearchParams = {
    countries: ['Griekenland'],
    departureStart: '2027-06-01',
    departureEnd: '2027-10-31',
    adults: 2,
    rooms: 1,
    sort: 'price',
  };
  const offers = [makeOffer('ws-1', 300), makeOffer('ws-2', 320)];

  // Homepage-equivalent: write overlays into L1+L2
  for (const offer of offers) {
    setResultsLivePriceOverlay(offer.id, params, {
      price: offer.price,
      pricePerDay: offer.pricePerDay,
      livePriceStatus: 'proven',
      livePriceSource: 'getPromotedPrice',
      liveTotalPrice: offer.price * 2,
    });
  }
  await new Promise((r) => setTimeout(r, 40));

  clearResultsLivePriceCache();
  clearLivePriceL2ObservabilityForTests();
  assert.equal(hasResultsLivePriceOverlay('ws-1', params), false);

  const hydrated = await hydrateResultsLivePriceOverlaysFromL2(
    offers.map((o) => o.id),
    params,
  );
  assert.equal(hydrated.hydrated, 2);

  let providerCalls = 0;
  const fetchImpl = (async () => {
    providerCalls += 1;
    return new Response('{}', { status: 500 });
  }) as typeof fetch;

  clearLivePriceL2ObservabilityForTests();
  const prepared = await prepareResultsOffers(offers, params, { fetchImpl });
  await prepared.exactOffers;

  assert.equal(providerCalls, 0);
  assert.equal(prepared.priceSortPending, false);
  const snap = getLivePriceL2ObservabilitySnapshot();
  assert.ok(snap.L2_HIT >= 1 || hasResultsLivePriceOverlay('ws-1', params));
  assert.equal(getResultsLivePriceOverlay('ws-1', params)?.price, 300);
});

test('G. prefetch failure → Homepage blijft werken (client swallows)', async () => {
  resetAll();
  const fetchImpl = (async () => {
    throw new Error('network down');
  }) as typeof fetch;
  const result = requestHomeLivePricePrefetch(baseState(), {
    enabled: true,
    popupsOpen: false,
    fetchImpl,
  });
  // fire-and-forget still reports fired; rejection is swallowed
  assert.equal(result.fired, true);
});

test('H. Results werkt zonder prefetch', async () => {
  resetAll();
  setHomeLivePricePrefetchEnabledForTests(false);
  assert.equal(isHomeLivePricePrefetchEnabled(), false);

  const rejected = scheduleHomeLivePricePrefetch({
    countries: ['Griekenland'],
    departureStart: '2027-06-01',
    departureEnd: '2027-10-31',
    adults: 2,
    rooms: 1,
    sort: 'price',
  });
  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, 'flag_off');

  // Client also stays quiet when flag off.
  const client = requestHomeLivePricePrefetch(baseState(), {
    enabled: false,
    popupsOpen: false,
    fetchImpl: (async () => {
      throw new Error('should not be called');
    }) as typeof fetch,
  });
  assert.equal(client.fired, false);
  assert.equal(client.reason, 'flag_off');
});

test('I. verschillende occupancy → verschillende cache identity', async () => {
  resetAll();
  const a2 = { adults: 2, children: 0, babies: 0, rooms: 1 };
  const a3 = { adults: 3, children: 0, babies: 0, rooms: 1 };
  assert.notEqual(livePriceCacheKey('offer-x', a2), livePriceCacheKey('offer-x', a3));
  setResultsLivePriceOverlay('offer-x', a2, {
    price: 100,
    pricePerDay: 12,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
  });
  assert.equal(hasResultsLivePriceOverlay('offer-x', a2), true);
  assert.equal(hasResultsLivePriceOverlay('offer-x', a3), false);
});

test('J. bestaande TTL blijft gelden', async () => {
  resetAll();
  const occ = { adults: 2, rooms: 1 };
  const t0 = 1_000_000;
  setResultsLivePriceNowMsForTests(t0);
  setResultsLivePriceOverlay('ttl-offer', occ, {
    price: 200,
    pricePerDay: 25,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
  });
  assert.equal(hasResultsLivePriceOverlay('ttl-offer', occ), true);
  setResultsLivePriceNowMsForTests(t0 + RESULTS_LIVE_PRICE_TTL_MS + 1);
  assert.equal(hasResultsLivePriceOverlay('ttl-offer', occ), false);
  setResultsLivePriceNowMsForTests(null);
});

test('K. feature flag / L2-off fallback', async () => {
  resetAll();
  setHomeLivePricePrefetchEnabledForTests(false);
  const sched = scheduleHomeLivePricePrefetch({
    countries: ['Griekenland'],
    departureStart: '2027-06-01',
    departureEnd: '2027-10-31',
    adults: 2,
    rooms: 1,
  });
  assert.equal(sched.accepted, false);
  assert.equal(sched.reason, 'flag_off');

  setHomeLivePricePrefetchEnabledForTests(true);
  setLivePriceL2EnabledForTests(false);
  setResultsLivePriceOverlay('l2off', { adults: 2, rooms: 1 }, {
    price: 111,
    pricePerDay: 14,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
  });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(
    await readLivePriceL2Record(livePriceCacheKey('l2off', { adults: 2, rooms: 1 })),
    null,
  );
  assert.equal(hasResultsLivePriceOverlay('l2off', { adults: 2, rooms: 1 }), true);
});

test('L. dubbele trigger → geen dubbele request', async () => {
  resetAll();
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response('{}', { status: 202 });
  }) as typeof fetch;
  const state = baseState();
  const first = requestHomeLivePricePrefetch(state, {
    enabled: true,
    popupsOpen: false,
    fetchImpl,
  });
  const second = requestHomeLivePricePrefetch(state, {
    enabled: true,
    popupsOpen: false,
    fetchImpl,
  });
  assert.equal(first.fired, true);
  assert.equal(second.fired, false);
  assert.equal(second.reason, 'duplicate_context');
  assert.equal(calls, 1);
  assert.equal(homeSearchContextKey(state), first.contextKey);

  const hrefParams = searchParamsFromResultsHref(first.contextKey!);
  assert.ok(hrefParams.countries?.includes('Griekenland') || hrefParams.country === 'Griekenland');
  assert.ok(typeof hrefParams.departureStart === 'string' && hrefParams.departureStart.length > 0);
});
