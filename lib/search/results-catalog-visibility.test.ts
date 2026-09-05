import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import React, { createElement } from 'react';
import { TravelCard } from '@/components/results/travel-card';
import {
  clearLivePriceInflightForTests,
  RESULTS_PRODUCT_PAGE_SIZE,
  startCatalogPageLiveOverlays,
} from '@/lib/providers/prijsvrij';
import {
  CORENDON_FE_HOST,
  CORENDON_LIVE_PAGE1_CONCURRENCY,
} from '@/lib/providers/corendon/constants';
import { clearResultsLivePriceCache } from '@/lib/search/results-live-price-cache';
import {
  measureResultsPipelineCounts,
  orderCatalogPageCandidates,
  sliceRankedCatalogResultsPage,
} from '@/lib/search/results-catalog-page';
import {
  hasProvenLiveTotalPrice,
  hasValidPresentablePrice,
  isResultsListableOffer,
  isResultsVisibleOffer,
  RESULTS_PRICE_COPY,
  resultsPricePresentation,
} from '@/lib/search/presentable-price';
import type { TravelOffer } from '@/types/travel';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const CORENDON_FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  return {
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

function makeCorendon(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return makeOffer({
    id: overrides.id ?? 'corendon-9514',
    provider: 'Corendon',
    ...overrides,
  });
}

function okLowestBody(price = 669): string {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: '2026-08-27T00:00:00',
        trip: {
          price,
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

function okUpsalesBody(total = 1338, pp = 669): string {
  return JSON.stringify({
    result: {
      extendedTripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
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

function cardHtml(
  offer: TravelOffer,
  provisional = false,
  searchParams?: { departureStart?: string; departureEnd?: string; adults?: number },
): string {
  return renderToStaticMarkup(
    createElement(TravelCard, { offer, provisional, searchParams }),
  );
}

beforeEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
});

test('TEST 1: catalog offer without proven live price still renders a Result card', () => {
  const offer = makeCorendon({ livePriceStatus: 'catalog', livePriceSource: 'feed' });
  assert.equal(hasValidPresentablePrice(offer), false);
  assert.equal(isResultsListableOffer(offer), true);
  // Pending/missing live € must not hide a valid match (provisional or settled stream).
  for (const provisional of [true, false]) {
    const html = cardHtml(offer, provisional);
    assert.match(html, /Test Hotel/, `provisional=${provisional}`);
    assert.match(html, new RegExp(RESULTS_PRICE_COPY.pending), `provisional=${provisional}`);
    assert.doesNotMatch(html, />€/, `provisional=${provisional}`);
  }
});

test('flexible search window does not replace concrete offer departure on the card', () => {
  const offer = makeCorendon({
    departureDate: '2026-08-29',
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    liveTotalPrice: 1200,
    liveTotalPriceField: 'upsales.totalPrice',
    price: 600,
  });
  assert.equal(isResultsListableOffer(offer), true);
  const html = cardHtml(offer, false, {
    departureStart: '2026-08-26',
    departureEnd: '2026-09-02',
    adults: 2,
  });
  assert.match(html, /29\/08\/2026 – 05\/09\/2026/);
  assert.match(html, /2 personen/);
  assert.doesNotMatch(html, /Vertrek op/);
  assert.doesNotMatch(html, /Vertrek tussen/);
  assert.match(html, /€/);
});

test('Sunweb unavailable_trip catalog offer is not a Results card', () => {
  const ushuaia = makeOffer({
    id: 'sunweb-6222186-2026-08-27-8-CRL-Logies',
    provider: 'Sunweb',
    hotelName: 'Ushuaïa Ibiza Beach Hotel - adults only',
    departureDate: '2026-08-27',
    departureAirport: 'CRL',
    boardType: 'Logies',
    price: 2608,
    livePriceStatus: 'unavailable',
    livePriceSource: undefined,
    livePriceFailureReason: 'unavailable_trip',
  });
  assert.equal(isResultsListableOffer(ushuaia), false);
  assert.equal(hasValidPresentablePrice(ushuaia), false);
  const html = cardHtml(ushuaia, false, {
    departureStart: '2026-08-26',
    departureEnd: '2026-09-02',
  });
  assert.equal(html, '');
});

test('TEST 2: live-price timeout (C) stays a Results card after settle (no fake €)', async () => {
  const offer = makeCorendon();
  const overlays = startCatalogPageLiveOverlays([offer], { adults: 2 }, {
    fetchImpl: async () => {
      const error = new Error('TimeoutError');
      error.name = 'TimeoutError';
      throw error;
    },
  });
  assert.equal(overlays[0].pending, true);
  assert.equal(isResultsListableOffer(overlays[0].catalog), true);
  const settled = await overlays[0].live;
  assert.equal(isResultsListableOffer(settled), true);
  assert.equal(hasValidPresentablePrice(settled), false);
  const html = cardHtml(settled, false);
  assert.match(html, /Test Hotel/);
  assert.match(html, new RegExp(RESULTS_PRICE_COPY.unavailable + '|' + RESULTS_PRICE_COPY.pending));
  assert.doesNotMatch(html, />€\s*\d/);
});

test('TEST 3: HTTP 204 provider-unavailable is not a Results card', async () => {
  const offer = makeCorendon();
  const overlays = startCatalogPageLiveOverlays([offer], { adults: 2 }, {
    fetchImpl: async () => new Response(null, { status: 204 }),
  });
  const settled = await overlays[0].live;
  assert.equal(isResultsListableOffer(settled), false);
  assert.equal(hasValidPresentablePrice(settled), false);
  assert.equal(cardHtml(settled), '');
});

test('TEST 4: invalid live price is provider-unavailable, not a Results card', async () => {
  const offer = makeCorendon();
  const overlays = startCatalogPageLiveOverlays([offer], { adults: 2 }, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(okLowestBody(), { status: 200 });
      }
      return new Response(JSON.stringify({ prices: { priceTableCalculatedPricePerPerson: 807 } }), {
        status: 200,
      });
    },
  });
  const settled = await overlays[0].live;
  assert.equal(isResultsListableOffer(settled), false);
  assert.equal(hasValidPresentablePrice(settled), false);
  assert.equal(cardHtml(settled), '');
});

test('TEST 5: proven live price is shown on the Result card', async () => {
  const offer = makeCorendon();
  const overlays = startCatalogPageLiveOverlays([offer], { adults: 2 }, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(okLowestBody(), { status: 200 });
      }
      if (url.includes('/upsales')) {
        return new Response(okUpsalesBody(), { status: 200 });
      }
      return new Response(null, { status: 404 });
    },
  });
  const settled = await overlays[0].live;
  assert.equal(hasValidPresentablePrice(settled), true);
  assert.equal(isResultsVisibleOffer(settled), true);
  const html = cardHtml(settled);
  assert.match(html, /€/);
  assert.match(html, /669/);
});

test('TEST 6: proven live total stays on the existing upsales total mapping', async () => {
  const offer = makeCorendon();
  const overlays = startCatalogPageLiveOverlays([offer], { adults: 2 }, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(okLowestBody(), { status: 200 });
      }
      return new Response(okUpsalesBody(1338, 669), { status: 200 });
    },
  });
  const settled = await overlays[0].live;
  assert.equal(hasProvenLiveTotalPrice(settled), true);
  assert.equal(settled.liveTotalPrice, 1338);
  assert.equal(settled.liveTotalPriceField, 'upsales.totalPrice');
  assert.equal(settled.livePriceSource, 'upsales');
});

test('TEST 7: catalog feed € is never shown as proven; pending card stays visible', () => {
  const offer = makeCorendon({
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    price: 458,
  });
  assert.equal(resultsPricePresentation(offer), 'pending');
  assert.equal(hasValidPresentablePrice(offer), false);
  assert.equal(isResultsListableOffer(offer), true);
  // Missing live price ≠ remove match: both provisional and settled streams keep the card.
  assert.match(cardHtml(offer, true), new RegExp(RESULTS_PRICE_COPY.pending));
  assert.match(cardHtml(offer, false), new RegExp(RESULTS_PRICE_COPY.pending));
  assert.doesNotMatch(cardHtml(offer, false), />€/);
});

test('TEST 8: pp × pax is not a live total — listable without inventing €', () => {
  const derived = makeCorendon({
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    price: 669,
    liveTotalPrice: 669 * 2,
    liveTotalPriceField: undefined,
  });
  assert.equal(hasProvenLiveTotalPrice(derived), false);
  assert.equal(hasValidPresentablePrice(derived), false);
  assert.equal(isResultsListableOffer(derived), true);
  const html = cardHtml(derived, false);
  assert.match(html, /./);
  assert.doesNotMatch(html, />€\s*669/);
});

test('TEST 9: first page uses the normal catalog page-size', () => {
  const ranked = Array.from({ length: 249 }, (_, index) =>
    makeCorendon({ id: `offer-${index + 1}`, hotelName: `Hotel ${index + 1}` }),
  );
  const page = sliceRankedCatalogResultsPage(ranked, 1, RESULTS_PRODUCT_PAGE_SIZE);
  assert.equal(RESULTS_PRODUCT_PAGE_SIZE, 10);
  assert.equal(page.offers.length, 10);
  assert.equal(page.paginationTotal, 249);
  assert.equal(page.offers[0].id, 'offer-1');
  assert.equal(page.offers[9].id, 'offer-10');
});

test('TEST 10: pending live pricing does not block catalog presented/document rendering', () => {
  const ranked = Array.from({ length: 10 }, (_, index) =>
    makeCorendon({ id: `offer-${index + 1}` }),
  );
  const started = Date.now();
  const overlays = startCatalogPageLiveOverlays(ranked, { adults: 2 }, {
    fetchImpl: () =>
      new Promise((resolve) => {
        setTimeout(() => resolve(new Response(null, { status: 204 })), 200);
      }),
  });
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 50, `overlay start waited ${elapsed}ms`);
  assert.equal(overlays.length, 10);
  assert.equal(overlays.every((overlay) => overlay.pending), true);
  const pageSource = readFileSync(join(ROOT, 'app/results/page.tsx'), 'utf8');
  assert.match(pageSource, /startCatalogPageLiveOverlays/);
  assert.doesNotMatch(pageSource, /startPage1ReceiptStream/);
  assert.doesNotMatch(pageSource, /\.presented/);
});

test('TEST 11: a 15s Corendon call does not block the catalog Results page', () => {
  const offer = makeCorendon();
  const started = Date.now();
  const overlays = startCatalogPageLiveOverlays([offer], { adults: 2 }, {
    fetchImpl: () =>
      new Promise((resolve) => {
        setTimeout(() => resolve(new Response(null, { status: 204 })), 15_000);
      }),
  });
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 100, `page construction waited ${elapsed}ms`);
  assert.equal(isResultsListableOffer(overlays[0].catalog), true);
  assert.match(cardHtml(overlays[0].catalog, true), /Test Hotel/);
});

test('TEST 12: image loading failure does not block Result-card rendering', () => {
  const offer = makeCorendon({ imageUrl: '' });
  assert.equal(isResultsListableOffer(offer), true);
  const html = cardHtml(offer, true);
  assert.match(html, /Test Hotel/);
});

test('TEST 13: catalog Corendon overlays keep existing page-1 concurrency of 5', async () => {
  const ranked = Array.from({ length: 10 }, (_, index) => {
    const accommodationId = 9514 + index;
    return makeCorendon({
      id: `corendon-${accommodationId}`,
      deepLink: `https://www.corendon.be/vakantie#${accommodationId}.COSPY.BRUCFU.270826.3-4-3.SZ-U`,
    });
  });
  let inFlight = 0;
  let maxInFlight = 0;
  const overlays = startCatalogPageLiveOverlays(ranked, { adults: 2 }, {
    fetchImpl: async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return new Response(null, { status: 204 });
    },
  });
  assert.equal(overlays.every((overlay) => overlay.pending), true);
  await Promise.all(overlays.map((overlay) => overlay.live));
  assert.ok(
    maxInFlight <= CORENDON_LIVE_PAGE1_CONCURRENCY,
    `Corendon catalog overlay concurrency was ${maxInFlight}`,
  );
  assert.ok(maxInFlight >= 2, `expected parallel Corendon work, got ${maxInFlight}`);
});

test('presentable offers are prioritized for paint; page slice keeps sort order', () => {
  const provenFields = {
    livePriceStatus: 'proven' as const,
    livePriceSource: 'upsales' as const,
    liveTotalPrice: 1078,
    liveTotalPriceField: 'upsales.totalPrice' as const,
    price: 539,
  };
  const ranked = [
    makeCorendon({ id: 'catalog-a', livePriceStatus: 'catalog', price: 400 }),
    makeCorendon({ id: 'catalog-b', livePriceStatus: 'catalog', price: 410 }),
    makeCorendon({ id: 'proven-z', ...provenFields }),
    makeCorendon({ id: 'catalog-c', livePriceStatus: 'catalog', price: 420 }),
  ];
  const ordered = orderCatalogPageCandidates(ranked, { adults: 2 });
  assert.equal(ordered[0].id, 'proven-z');
  // Pagination follows ranked sort order — not live-presentable-first —
  // so price sorts keep their ordering while membership stays intact.
  const page = sliceRankedCatalogResultsPage(ranked, 1, 3, { adults: 2 });
  assert.deepEqual(
    page.offers.map((offer) => offer.id),
    ['catalog-a', 'catalog-b', 'proven-z'],
  );
});

test('settled unavailable offers remain in matchset membership and pagination', () => {
  const ranked = [
    makeCorendon({ id: 'visible', livePriceStatus: 'catalog' }),
    makeCorendon({
      id: 'hidden',
      livePriceStatus: 'unavailable',
      livePriceFailureReason: 'http_204',
    }),
  ];
  const ordered = orderCatalogPageCandidates(ranked, { adults: 2 });
  assert.equal(ordered.length, 2);
  assert.deepEqual(
    ordered.map((offer) => offer.id).sort(),
    ['hidden', 'visible'],
  );
  const page = sliceRankedCatalogResultsPage(ranked, 1, 10, { adults: 2 });
  assert.equal(page.paginationTotal, 2);
  assert.deepEqual(
    page.offers.map((offer) => offer.id),
    ['visible', 'hidden'],
  );
});

test('pipeline counts distinguish catalog, listable, and presentable stages', () => {
  const provenFields = {
    livePriceStatus: 'proven' as const,
    livePriceSource: 'upsales' as const,
    liveTotalPrice: 1078,
    liveTotalPriceField: 'upsales.totalPrice' as const,
    price: 539,
  };
  const ranked = Array.from({ length: 12 }, (_, index) => {
    if (index === 11) {
      return makeCorendon({ id: `offer-${index + 1}`, ...provenFields });
    }
    return makeCorendon({ id: `offer-${index + 1}`, livePriceStatus: 'catalog' });
  });
  ranked.push(
    makeCorendon({
      id: 'settled-unavailable',
      livePriceStatus: 'unavailable',
      livePriceFailureReason: 'http_204',
    }),
  );

  const counts = measureResultsPipelineCounts(ranked, { adults: 2 }, 1, 10);
  assert.equal(counts.afterCatalogFilter, 13);
  assert.equal(counts.afterListabilityFilter, 12);
  assert.equal(counts.afterPresentableFilter, 1);
  // Pagination membership equals the ranked filter matchset (includes settled).
  assert.equal(counts.afterPaginationOrder, 13);
  assert.equal(counts.pageSliceSize, 10);
});
