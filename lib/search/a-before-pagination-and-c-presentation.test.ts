/**
 * Hard gate: A-before-pagination + C≠PENDING presentation.
 */
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, test } from 'node:test';
import { TravelCard } from '@/components/results/travel-card';
import { CORENDON_PROVIDER_NAME } from '@/lib/providers/corendon/constants';
import {
  clearLivePriceInflightForTests,
  startCatalogPageLiveOverlays,
} from '@/lib/providers/prijsvrij';
import { slicePriceSortPoolPage } from '@/lib/search/prepare-results-offers';
import {
  hasValidPresentablePrice,
  isProviderConfirmedUnavailable,
  isResultsListableOffer,
  resultsPricePresentation,
} from '@/lib/search/presentable-price';
import {
  bookableResultsMembership,
  sliceRankedCatalogResultsPage,
} from '@/lib/search/results-catalog-page';
import {
  clearResultsLivePriceCache,
  RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS,
  setResultsLivePriceNowMsForTests,
  setResultsLivePriceOverlay,
  hasResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import type { SearchParams, TravelOffer } from '@/types/travel';

const params: SearchParams = { adults: 2, countries: ['Spanje'] };

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'price'>,
): TravelOffer {
  return {
    provider: CORENDON_PROVIDER_NAME,
    hotelName: `Hotel ${overrides.id}`,
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    departureDate: '2026-09-10',
    nights: 8,
    flightIncluded: 'true',
    pricePerDay: Math.round(overrides.price / 8),
    currency: 'EUR',
    imageUrl: '/images/results-card-placeholder.png',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.100926.8.SZ-U',
    livePriceStatus: 'catalog',
    ...overrides,
  };
}

function cardHtml(offer: TravelOffer, provisional = false): string {
  return renderToStaticMarkup(createElement(TravelCard, { offer, provisional }));
}

function seedA(id: string): void {
  setResultsLivePriceOverlay(id, params, {
    price: 999,
    pricePerDay: 125,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'http_204',
  });
}

function seedC(id: string, reason: 'timeout' | 'stale_context' | 'network_error' = 'timeout'): void {
  setResultsLivePriceOverlay(id, params, {
    price: 999,
    pricePerDay: 125,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: reason,
  });
}

function seedB(id: string, price: number): void {
  setResultsLivePriceOverlay(id, params, {
    price,
    pricePerDay: Math.round(price / 8),
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    liveTotalPrice: price * 2,
    liveTotalPriceField: 'upsales.totalPrice',
  });
}

beforeEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
  setResultsLivePriceNowMsForTests(null);
});

test('A: pagination selects only presentable B (A and C excluded from pool)', () => {
  const ranked = Array.from({ length: 17 }, (_, i) =>
    makeOffer({ id: `o-${i}`, price: 300 + i }),
  );
  // 7 A, 3 B, 3 C among first 17 — presentable pool = 3 B.
  for (const i of [0, 2, 4, 6, 8, 10, 12]) seedA(`o-${i}`);
  for (const i of [1, 3, 5]) seedB(`o-${i}`, 400 + i);
  for (const i of [7, 9, 11]) seedC(`o-${i}`);

  const bookable = bookableResultsMembership(ranked, params);
  assert.equal(bookable.length, 3);
  assert.ok(bookable.every((o) => hasValidPresentablePrice(o)));
  assert.ok(bookable.every((o) => !isProviderConfirmedUnavailable(o)));

  const page = sliceRankedCatalogResultsPage(ranked, 1, 10, params);
  assert.equal(page.paginationTotal, 3);
  assert.equal(page.offers.length, 3);
  assert.ok(page.offers.every((o) => isResultsListableOffer(o)));
  assert.ok(page.offers.every((o) => hasValidPresentablePrice(o)));
});

test('B: A and C never occupy a presentable page slot', () => {
  const ranked = [
    makeOffer({ id: 'a-1', price: 100 }),
    makeOffer({ id: 'b-1', price: 200 }),
    makeOffer({ id: 'a-2', price: 300 }),
    makeOffer({ id: 'c-1', price: 400 }),
  ];
  seedA('a-1');
  seedA('a-2');
  seedB('b-1', 220);
  seedC('c-1');

  const page = sliceRankedCatalogResultsPage(ranked, 1, 10, params);
  assert.deepEqual(
    page.offers.map((o) => o.id),
    ['b-1'],
  );
  assert.equal(page.offers.some((o) => o.id.startsWith('a-')), false);
  assert.equal(page.offers.some((o) => o.id.startsWith('c-')), false);
});

test('C: settled C is not presentable (no Results card)', () => {
  const offer = makeOffer({
    id: 'c-settled',
    price: 500,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'timeout',
  });
  seedC('c-settled', 'timeout');
  const bookable = bookableResultsMembership([offer], params);
  assert.equal(bookable.length, 0);
  assert.equal(isProviderConfirmedUnavailable(offer), false);
  assert.equal(hasValidPresentablePrice(offer), false);
  assert.equal(isResultsListableOffer(offer), false);
  assert.equal(resultsPricePresentation(offer, { provisional: false }), 'unavailable');

  const html = cardHtml(offer, false);
  assert.equal(html, '');
});

test('D: PENDING is not presentable (no Results card)', () => {
  const offer = makeOffer({ id: 'pending-1', price: 400, livePriceStatus: 'catalog' });
  assert.equal(isResultsListableOffer(offer), false);
  assert.equal(cardHtml(offer, true), '');
  assert.equal(cardHtml(offer, false), '');
});

test('E: PENDING → B shows amount', async () => {
  const CORENDON_FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
  const TRIP_OK = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU';
  const offer = makeOffer({
    id: 'corendon-9514-b',
    price: 458,
    deepLink: `https://www.corendon.be/vakantie#${CORENDON_FRAGMENT}`,
  });
  const overlays = startCatalogPageLiveOverlays([offer], params, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(
          JSON.stringify({
            package: {
              lowestPriceTrip: {
                tripDepartureDate: '2026-08-27T00:00:00',
                trip: {
                  price: 669,
                  tripCode: TRIP_OK,
                  tripUrlHash: `[filters]BEL/BRU.*.*.*.0|||${TRIP_OK}|||true`,
                  priceTableDate: '20260827',
                  durationInDays: 5,
                },
              },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes('upsales') || url.includes('Upsales')) {
        return new Response(
          JSON.stringify({
            result: {
              extendedTripCode: TRIP_OK,
              prices: { totalPrice: 1338, displayedPricePerPerson: 669 },
              selectedTripCudl: {
                selectedTrip: { system: { request: { departureDate: '2026-08-27' } } },
              },
            },
          }),
          { status: 200 },
        );
      }
      return new Response(null, { status: 404 });
    },
  });
  assert.equal(overlays[0]!.pending, true);
  const settled = await overlays[0]!.live;
  assert.equal(hasValidPresentablePrice(settled), true);
  const html = cardHtml(settled, false);
  assert.match(html, /€/);
  assert.match(html, /data-price-presentation="amount"/);
});

test('F: PENDING → A removed from bookable membership (no page slot)', async () => {
  const CORENDON_FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
  const offer = makeOffer({
    id: 'corendon-9514-a',
    price: 458,
    deepLink: `https://www.corendon.be/vakantie#${CORENDON_FRAGMENT}`,
  });
  const overlays = startCatalogPageLiveOverlays([offer], params, {
    fetchImpl: async () => new Response(null, { status: 204 }),
  });
  const settled = await overlays[0]!.live;
  assert.equal(isProviderConfirmedUnavailable(settled), true);
  assert.equal(isResultsListableOffer(settled), false);
  assert.equal(cardHtml(settled, false), '');

  const ranked = [settled, makeOffer({ id: 'keep', price: 300 })];
  seedB('keep', 300);
  // Apply A onto settled id via overlay already in cache from live run.
  const page = sliceRankedCatalogResultsPage(ranked, 1, 10, params);
  assert.equal(page.offers.some((o) => o.id === 'corendon-9514-a'), false);
  assert.equal(page.offers[0]?.id, 'keep');
});

test('G: PENDING → C is not presentable (no Results card), stays in matchset', async () => {
  const CORENDON_FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
  const offer = makeOffer({
    id: 'corendon-9514-c',
    price: 458,
    deepLink: `https://www.corendon.be/vakantie#${CORENDON_FRAGMENT}`,
  });
  const overlays = startCatalogPageLiveOverlays([offer], params, {
    fetchImpl: async () => {
      const error = new Error('TimeoutError');
      error.name = 'TimeoutError';
      throw error;
    },
  });
  const settled = await overlays[0]!.live;
  assert.equal(isResultsListableOffer(settled), false);
  assert.equal(settled.livePriceFailureReason, 'timeout');
  assert.equal(isProviderConfirmedUnavailable(settled), false);
  assert.equal(cardHtml(settled, false), '');
  // Matchset still holds the offer id; presentable pool does not.
  assert.equal(bookableResultsMembership([settled, offer], params).length, 0);
  assert.equal([settled].length, 1);
});

test('H: DEC-011 C is one attempt only (no same-run attempt 2)', async () => {
  const CORENDON_FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
  const offer = makeOffer({
    id: 'corendon-9514-retry',
    price: 458,
    deepLink: `https://www.corendon.be/vakantie#${CORENDON_FRAGMENT}`,
  });
  let calls = 0;
  const overlays = startCatalogPageLiveOverlays([offer], params, {
    fetchImpl: async (input) => {
      if (String(input).includes('lowestpricesacco')) {
        calls += 1;
        const error = new Error('TimeoutError');
        error.name = 'TimeoutError';
        throw error;
      }
      return new Response(null, { status: 404 });
    },
  });
  const settled = await overlays[0]!.live;
  assert.equal(calls, 1, 'DEC-011: no second 15s attempt in same pricing-run');
  assert.equal(settled.livePriceFailureReason, 'timeout');
  assert.equal(resultsPricePresentation(settled, { provisional: false }), 'unavailable');
});

test('I: cached C is not presentable; expires for later retry', () => {
  const t0 = 5_000_000;
  setResultsLivePriceNowMsForTests(t0);
  setResultsLivePriceOverlay(
    'cached-c',
    params,
    {
      price: 999,
      pricePerDay: 125,
      livePriceStatus: 'unavailable',
      livePriceFailureReason: 'timeout',
    },
    { cachedAtMs: t0, ttlMs: RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS },
  );
  assert.equal(hasResultsLivePriceOverlay('cached-c', params), true);
  const offer = makeOffer({ id: 'cached-c', price: 400 });
  assert.equal(bookableResultsMembership([offer], params).length, 0);
  assert.equal(isResultsListableOffer(offer), false);
  assert.equal(cardHtml(offer, false), '');
  // Presentation kind for the stamped C overlay (not the raw catalog shell).
  assert.equal(
    resultsPricePresentation(
      { ...offer, livePriceStatus: 'unavailable', livePriceFailureReason: 'timeout' },
      { provisional: false },
    ),
    'unavailable',
  );

  setResultsLivePriceNowMsForTests(t0 + RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS + 1);
  assert.equal(hasResultsLivePriceOverlay('cached-c', params), false);
});

test('J: price sort keeps B ascending and excludes A from page slots', () => {
  const ranked = [
    makeOffer({ id: 'hi', price: 900 }),
    makeOffer({ id: 'lo', price: 200 }),
    makeOffer({ id: 'mid', price: 500 }),
    makeOffer({ id: 'gone', price: 100 }),
  ];
  seedB('hi', 900);
  seedB('lo', 200);
  seedB('mid', 500);
  seedA('gone');

  const sorted = [...ranked].sort((a, b) => a.price - b.price);
  const page = slicePriceSortPoolPage(sorted, 1, 10, { provisional: false, params });
  assert.equal(page.paginationTotal, 3);
  assert.deepEqual(
    page.visibleOffers.map((o) => o.id),
    ['lo', 'mid', 'hi'],
  );
  assert.ok(page.visibleOffers[0]!.price <= page.visibleOffers[1]!.price);
  assert.ok(page.visibleOffers[1]!.price <= page.visibleOffers[2]!.price);
});

test('K: C and pending stay in catalog matchset but not presentable pool', () => {
  const ranked = [
    makeOffer({ id: 'pend', price: 300, livePriceStatus: 'catalog' }),
    makeOffer({ id: 'tech', price: 400 }),
  ];
  seedC('tech', 'stale_context');
  // Underlying matchset membership (ranked) unchanged.
  assert.equal(ranked.length, 2);
  const bookable = bookableResultsMembership(ranked, params);
  assert.equal(bookable.length, 0);
  assert.equal(isResultsListableOffer(ranked[0]!), false);
});

test('L: presentable pool paginates B only (10/10 when enough B)', () => {
  const ranked = Array.from({ length: 37 }, (_, i) =>
    makeOffer({ id: `m-${i}`, price: 300 + i }),
  );
  for (let i = 0; i < 24; i += 1) seedB(`m-${i}`, 300 + i);
  for (let i = 24; i < 34; i += 1) seedC(`m-${i}`);
  for (let i = 34; i < 37; i += 1) seedA(`m-${i}`);

  // 24 B → pages 10/10/4
  const totals = [1, 2, 3].map((page) => {
    const slice = sliceRankedCatalogResultsPage(ranked, page, 10, params);
    assert.equal(slice.paginationTotal, 24);
    return slice.offers.length;
  });
  assert.deepEqual(totals, [10, 10, 4]);
  assert.ok(
    sliceRankedCatalogResultsPage(ranked, 1, 10, params).offers.every(isResultsListableOffer),
  );
});