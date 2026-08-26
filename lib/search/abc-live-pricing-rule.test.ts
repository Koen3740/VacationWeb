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
 * Evidence for A/B/C Results live-pricing:
 * attempt 1 → attempt 2 → C (~2 min cache) → listable=false.
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
      lowestCalls += 1;
      if (url.includes('lowestpricesacco') || url.includes('Lowest')) {
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
  assert.ok(lowestCalls >= 1, `no live HTTP; status=${settled.livePriceStatus} reason=${settled.livePriceFailureReason}`);
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

test('C: attempt1 → attempt2 on timeout → listable=false + ~2min cache', async () => {
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

  assert.equal(lowestCalls, 2, 'evidence: attempt 1 then attempt 2');
  assert.equal(settled.livePriceStatus, 'unavailable');
  assert.equal(settled.livePriceFailureReason, 'timeout');
  assert.equal(hasValidPresentablePrice(settled), false);
  assert.equal(isResultsListableOffer(settled), false);
  assert.equal(cardHtml(settled), '');
  assert.equal(hasResultsLivePriceOverlay(offer.id, { adults: 2 }), true);

  setResultsLivePriceNowMsForTests(t0 + RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS + 1);
  assert.equal(hasResultsLivePriceOverlay(offer.id, { adults: 2 }), false);
});

test('C: stale_context airport mismatch retries once then not listable', async () => {
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
  assert.equal(lowestCalls, 2, 'evidence: attempt 1 then attempt 2 for stale_context');
  assert.equal(settled.livePriceFailureReason, 'stale_context');
  assert.equal(isResultsListableOffer(settled), false);
  assert.equal(cardHtml(settled), '');
});

test('Rosa-shaped C airport mismatch → hidden (no catalog € fallback)', async () => {
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
  assert.equal(lowestCalls, 2);
  assert.equal(settled.livePriceFailureReason, 'stale_context');
  assert.equal(hasValidPresentablePrice(settled), false);
  assert.equal(isResultsListableOffer(settled), false);
  assert.equal(cardHtml(settled), '');
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
