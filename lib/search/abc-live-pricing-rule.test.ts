import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { TravelCard } from '@/components/results/travel-card';
import { CORENDON_FE_HOST } from '@/lib/providers/corendon/constants';
import {
  clearLivePriceInflightForTests,
  startCatalogPageLiveOverlays,
} from '@/lib/providers/prijsvrij';
import {
  hasValidPresentablePrice,
  isResultsListableOffer,
} from '@/lib/search/presentable-price';
import {
  clearResultsLivePriceCache,
  hasResultsLivePriceOverlay,
  RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS,
  setResultsLivePriceNowMsForTests,
} from '@/lib/search/results-live-price-cache';
import type { TravelOffer } from '@/types/travel';

/**
 * Evidence for A/B/C Results live-pricing (DEC-011):
 * one attempt per pricing-run; C (~2 min cache) stays listable (no fake €).
 * Later user action may retry after C-TTL. Only A leaves bookable presentation.
 */

const CORENDON_FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
const TRIP_OK = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU';
const TRIP_AIRPORT_MISMATCH = '9514.COSPY.EINCFU.270826.3-4-3.SZ-U.EINCFU4C.CFU';

function makeCorendon(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    // id must encode accommodation id 9514 to match CORENDON_FRAGMENT.
    id: overrides.id ?? 'corendon-9514',
    provider: 'Corendon',
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    departureDate: '2026-08-27',
    nights: 8,
    flightIncluded: 'true',
    price: 458,
    pricePerDay: 57,
    imageUrl: '/images/results-card-placeholder.png',
    deepLink: `https://www.corendon.be/vakantie#${CORENDON_FRAGMENT}`,
    listingHost: CORENDON_FE_HOST,
    ...overrides,
  };
}

function okLowestBody(tripCode = TRIP_OK, price = 669): string {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: '2026-08-27T00:00:00',
        trip: {
          price,
          tripCode,
          tripUrlHash: `[filters]BEL/BRU.*.*.*.0|||${tripCode}|||true`,
          priceTableDate: '20260827',
          durationInDays: 5,
        },
      },
    },
  });
}

function okUpsalesBody(total = 1338, pp = 669): string {
  return JSON.stringify({
    result: {
      extendedTripCode: TRIP_OK,
      prices: {
        totalPrice: total,
        displayedPricePerPerson: pp,
      },
      selectedTripCudl: {
        selectedTrip: {
          system: { request: { departureDate: '2026-08-27' } },
        },
      },
    },
  });
}

function cardHtml(offer: TravelOffer, provisional = false): string {
  return renderToStaticMarkup(createElement(TravelCard, { offer, provisional }));
}

beforeEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
  setResultsLivePriceNowMsForTests(null);
});

test('B: proven live price → listable with amount', async () => {
  const offer = makeCorendon({ id: 'corendon-9514-b' });
  let lowestCalls = 0;
  const overlays = startCatalogPageLiveOverlays([offer], { adults: 2 }, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco') || url.includes('Lowest')) {
        lowestCalls += 1;
        return new Response(okLowestBody(), { status: 200 });
      }
      if (url.includes('/upsales') || url.includes('Upsales')) {
        return new Response(okUpsalesBody(), { status: 200 });
      }
      return new Response(`unexpected ${url}`, { status: 500 });
    },
  });
  assert.equal(overlays[0]!.pending, true, `pending=false status=${offer.livePriceStatus}`);
  const settled = await overlays[0]!.live;
  assert.equal(lowestCalls, 1, 'DEC-011: B succeeds on attempt 1 — no retry');
  assert.equal(hasValidPresentablePrice(settled), true);
  assert.equal(isResultsListableOffer(settled), true);
  assert.match(cardHtml(settled), /€/);
});

test('A: provider 204 → one attempt, not listable', async () => {
  const offer = makeCorendon({ id: 'corendon-9514-a' });
  let lowestCalls = 0;
  const overlays = startCatalogPageLiveOverlays([offer], { adults: 2 }, {
    fetchImpl: async (input) => {
      if (String(input).includes('lowestpricesacco')) {
        lowestCalls += 1;
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 404 });
    },
  });
  const settled = await overlays[0]!.live;
  assert.equal(lowestCalls, 1, 'A is not retried');
  assert.equal(isResultsListableOffer(settled), false);
  assert.equal(cardHtml(settled), '');
});

test('C: DEC-011 one attempt on timeout → listable + visible card + ~2min cache', async () => {
  const offer = makeCorendon({ id: 'corendon-9514-c-timeout' });
  let lowestCalls = 0;
  const t0 = 7_000_000;
  setResultsLivePriceNowMsForTests(t0);

  const overlays = startCatalogPageLiveOverlays([offer], { adults: 2 }, {
    fetchImpl: async (input) => {
      if (String(input).includes('lowestpricesacco')) {
        lowestCalls += 1;
        const error = new Error('TimeoutError');
        error.name = 'TimeoutError';
        throw error;
      }
      return new Response(null, { status: 404 });
    },
  });

  assert.equal(overlays[0]!.pending, true);
  assert.equal(isResultsListableOffer(overlays[0]!.catalog), true);

  const settled = await overlays[0]!.live;

  assert.equal(lowestCalls, 1, 'DEC-011: no same-run attempt 2');
  assert.equal(settled.livePriceStatus, 'unavailable');
  assert.equal(settled.livePriceFailureReason, 'timeout');
  assert.equal(hasValidPresentablePrice(settled), false);
  assert.equal(isResultsListableOffer(settled), true);
  assert.match(cardHtml(settled), /Test Hotel/);
  assert.doesNotMatch(cardHtml(settled), />€\s*\d/);
  assert.equal(hasResultsLivePriceOverlay(offer.id, { adults: 2 }), true);

  setResultsLivePriceNowMsForTests(t0 + RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS + 1);
  assert.equal(hasResultsLivePriceOverlay(offer.id, { adults: 2 }), false);
});

test('C: stale_context airport mismatch → one attempt then stays listable (DEC-011)', async () => {
  const offer = makeCorendon({ id: 'corendon-9514-c-stale-airport' });
  let lowestCalls = 0;
  const overlays = startCatalogPageLiveOverlays([offer], { adults: 2 }, {
    fetchImpl: async (input) => {
      if (String(input).includes('lowestpricesacco')) {
        lowestCalls += 1;
        // Rosa-equivalent: requested BRUCFU context, provider returns EINCFU.
        return new Response(okLowestBody(TRIP_AIRPORT_MISMATCH), { status: 200 });
      }
      return new Response(null, { status: 404 });
    },
  });
  const settled = await overlays[0]!.live;
  assert.equal(lowestCalls, 1, 'DEC-011: stale_context is not same-run-retried');
  assert.equal(settled.livePriceFailureReason, 'stale_context');
  assert.equal(isResultsListableOffer(settled), true);
  assert.match(cardHtml(settled), /Test Hotel/);
  assert.doesNotMatch(cardHtml(settled), />€\s*\d/);
});

test('Rosa-shaped C airport mismatch → listable card, no catalog € fallback', async () => {
  const offer = makeCorendon({
    id: 'corendon-9514-rosa-260926',
    hotelName: 'Rosa Nautica',
  });
  let lowestCalls = 0;
  const overlays = startCatalogPageLiveOverlays([offer], { adults: 2 }, {
    fetchImpl: async (input) => {
      if (String(input).includes('lowestpricesacco')) {
        lowestCalls += 1;
        return new Response(okLowestBody(TRIP_AIRPORT_MISMATCH), { status: 200 });
      }
      return new Response(null, { status: 404 });
    },
  });
  const settled = await overlays[0]!.live;
  assert.equal(lowestCalls, 1, 'DEC-011: one attempt');
  assert.equal(settled.livePriceFailureReason, 'stale_context');
  assert.equal(hasValidPresentablePrice(settled), false);
  assert.equal(isResultsListableOffer(settled), true);
  assert.match(cardHtml(settled), /Rosa Nautica/);
  assert.doesNotMatch(cardHtml(settled), />€\s*\d/);
});

test('matching live price → presentable and listable (Rosa 28/09 success path)', async () => {
  const offer = makeCorendon({
    id: 'corendon-9514-rosa-280926',
    hotelName: 'Rosa Nautica',
  });
  const overlays = startCatalogPageLiveOverlays([offer], { adults: 2 }, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(okLowestBody(TRIP_OK, 527), { status: 200 });
      }
      if (url.includes('/upsales')) {
        return new Response(okUpsalesBody(1054, 527), { status: 200 });
      }
      return new Response(null, { status: 404 });
    },
  });
  const settled = await overlays[0]!.live;
  assert.equal(hasValidPresentablePrice(settled), true);
  assert.equal(isResultsListableOffer(settled), true);
  assert.match(cardHtml(settled), /527|1.?054/);
});

test('DEC-011: C within TTL blocks later pricing-run HTTP; after TTL allows one new attempt', async () => {
  const offer = makeCorendon({ id: 'corendon-9514-c-later' });
  let lowestCalls = 0;
  const t0 = 9_000_000;
  setResultsLivePriceNowMsForTests(t0);
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).includes('lowestpricesacco')) {
      lowestCalls += 1;
      const error = new Error('TimeoutError');
      error.name = 'TimeoutError';
      throw error;
    }
    return new Response(null, { status: 404 });
  };

  const first = startCatalogPageLiveOverlays([offer], { adults: 2 }, { fetchImpl });
  await first[0]!.live;
  assert.equal(lowestCalls, 1);

  clearLivePriceInflightForTests();
  const withinTtl = startCatalogPageLiveOverlays([offer], { adults: 2 }, { fetchImpl });
  await withinTtl[0]!.live;
  assert.equal(lowestCalls, 1, 'within soft C-TTL (~2 min): no new HTTP');

  setResultsLivePriceNowMsForTests(t0 + RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS + 1);
  clearLivePriceInflightForTests();
  const afterTtl = startCatalogPageLiveOverlays([offer], { adults: 2 }, { fetchImpl });
  await afterTtl[0]!.live;
  assert.equal(lowestCalls, 2, 'after C-TTL: new pricing-run may attempt once');
});

test('DEC-011: concurrent identical overlays share one in-flight attempt', async () => {
  const offer = makeCorendon({ id: 'corendon-9514-c-inflight' });
  let lowestCalls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).includes('lowestpricesacco')) {
      lowestCalls += 1;
      await gate;
      const error = new Error('TimeoutError');
      error.name = 'TimeoutError';
      throw error;
    }
    return new Response(null, { status: 404 });
  };

  const a = startCatalogPageLiveOverlays([offer], { adults: 2 }, { fetchImpl });
  const b = startCatalogPageLiveOverlays([offer], { adults: 2 }, { fetchImpl });
  assert.equal(a[0]!.pending, true);
  assert.equal(b[0]!.pending, true);
  // Yield so both runners can enter limter/inflight before HTTP resolves.
  await Promise.resolve();
  release();
  await Promise.all([a[0]!.live, b[0]!.live]);
  assert.equal(lowestCalls, 1, 'in-flight reuse preserved under DEC-011');
});
