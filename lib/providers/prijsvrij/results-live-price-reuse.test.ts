import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import { rankResultsOffers } from '../../search/rank-results-offers';
import {
  RESULTS_LIVE_PRICE_TTL_MS,
  clearResultsLivePriceCache,
  setResultsLivePriceNowMsForTests,
  setResultsLivePriceOverlay,
} from '../../search/results-live-price-cache';
import { PRIJSVRIJ_PAGE1_MAX_SLOTS, PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP } from './constants';
import {
  startPage1ReceiptStream,
  type Page1ReceiptPricingStats,
} from './page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from './receipt-auth';

afterEach(() => {
  clearResultsLivePriceCache();
  clearPrijsvrijReceiptTokenCache();
  setResultsLivePriceNowMsForTests(null);
});

function emptyStats(): Page1ReceiptPricingStats {
  return {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };
}

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

function makePv(overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id'>): TravelOffer {
  return {
    provider: 'Prijsvrij',
    hotelName: 'PV Hotel',
    destinationCountry: 'Portugal',
    destinationRegion: 'Algarve',
    departureDate: '2026-08-20',
    nights: 8,
    flightIncluded: 'true',
    price: 900,
    pricePerDay: 112,
    boardType: 'Logies',
    imageUrl: 'https://example.com/a.jpg',
    deepLink:
      'https://www.prijsvrij.be/vakantie/?r=https%3A%2F%2Fwww.prijsvrij.be%2Fvakanties%2Fportugal%3Fvertrekdatum%3D2026-08-20%26reisduurdagen%3D8%26transport%3Dvl',
    ...overrides,
  };
}

function makeSunweb(overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id'>): TravelOffer {
  return {
    provider: 'Sunweb',
    hotelName: 'Sun Hotel',
    destinationCountry: 'Portugal',
    departureDate: '2026-08-20',
    nights: 8,
    price: 350,
    pricePerDay: 44,
    boardType: 'All Inclusive',
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://example.com',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    ...overrides,
  };
}

function makeReceiptFetch(counter: { posts: number; urls: string[] }): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 'r'.repeat(40) }), { status: 200 });
    }
    counter.posts += 1;
    counter.urls.push(url);
    const hotelMatch = /\/(\d+)\/receipt\//.exec(url);
    const hotelId = Number(hotelMatch?.[1] ?? '0');
    return new Response(okReceiptBody(200 + hotelId), { status: 200 });
  };
}

function hotelIdsFromReceiptUrls(urls: string[]): string[] {
  return urls
    .map((url) => /\/(\d+)\/receipt\//.exec(url)?.[1])
    .filter((id): id is string => Boolean(id));
}

function build921(): TravelOffer[] {
  const pv: TravelOffer[] = [];
  for (let index = 0; index < 859; index += 1) {
    const allInclusive = index >= 859 - 22;
    pv.push(
      makePv({
        id: `prijsvrij-${1000 + index}-2026-08-20-8-900-${allInclusive ? 'AI' : 'LG'}`,
        boardType: allInclusive ? 'All Inclusive' : 'Logies',
        price: 5000 + index,
        pricePerDay: 625,
      }),
    );
  }
  const sunweb: TravelOffer[] = [];
  for (let index = 0; index < 62; index += 1) {
    sunweb.push(
      makeSunweb({
        id: `sunweb-${index}`,
        boardType: index < 8 ? 'All Inclusive' : 'Logies',
        price: 300 + index,
      }),
    );
  }
  return [...pv, ...sunweb];
}

test('1. first request with no cache performs Receipt HTTP', async () => {
  const offers = [
    makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG' }),
    makeSunweb({ id: 'sunweb-a' }),
  ];
  const http = { posts: 0, urls: [] as string[] };
  await startPage1ReceiptStream(offers, { adults: 2 }, { fetchImpl: makeReceiptFetch(http) }).presented;
  assert.ok(http.posts >= 1);
});

test('2. same offer + same context immediately afterward is a cache hit', async () => {
  const offers = [
    makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG' }),
    makeSunweb({ id: 'sunweb-a' }),
  ];
  const first = { posts: 0, urls: [] as string[] };
  await startPage1ReceiptStream(offers, { adults: 2 }, { fetchImpl: makeReceiptFetch(first) }).presented;
  assert.ok(first.posts >= 1);

  const second = { posts: 0, urls: [] as string[] };
  await startPage1ReceiptStream(offers, { adults: 2 }, { fetchImpl: makeReceiptFetch(second) }).presented;
  assert.equal(second.posts, 0);
});

test('3-8. cached page-1 live prices are reused across All Inclusive and price sorts', async () => {
  const catalog = build921();
  const http1 = { posts: 0, urls: [] as string[] };
  const ranked = rankResultsOffers(catalog, { adults: 2, sort: 'price-desc' });
  const first = await startPage1ReceiptStream(ranked, { adults: 2, sort: 'price-desc' }, {
    fetchImpl: makeReceiptFetch(http1),
  }).presented;
  assert.ok(http1.posts > 0, 'initial search must call Receipt');
  const pricedHotelIds = new Set(hotelIdsFromReceiptUrls(http1.urls));
  assert.ok(pricedHotelIds.size > 0);

  const aiParams = { adults: 2, boardTypes: ['All Inclusive'], sort: 'price' as const };
  const aiRanked = rankResultsOffers(catalog, aiParams);
  assert.equal(aiRanked.filter((offer) => offer.boardType === 'All Inclusive').length, aiRanked.length);
  assert.ok(aiRanked.some((offer) => offer.provider === 'Prijsvrij' && offer.livePriceStatus === 'proven'));

  const httpAi = { posts: 0, urls: [] as string[] };
  await startPage1ReceiptStream(aiRanked, aiParams, {
    fetchImpl: makeReceiptFetch(httpAi),
  }).presented;
  const aiHotels = hotelIdsFromReceiptUrls(httpAi.urls);
  assert.ok(
    aiHotels.every((id) => !pricedHotelIds.has(id)),
    'All Inclusive must not Receipt already-priced offers',
  );

  for (const sort of ['price', 'price-desc', 'price-per-day'] as const) {
    const sorted = rankResultsOffers(catalog, { ...aiParams, sort });
    const livePv = sorted.filter((offer) => offer.provider === 'Prijsvrij' && offer.livePriceStatus === 'proven');
    assert.ok(livePv.length >= 1);
    if (sort === 'price') {
      for (let i = 1; i < sorted.length; i += 1) {
        assert.ok(sorted[i - 1].price <= sorted[i].price);
      }
    }
    if (sort === 'price-desc') {
      for (let i = 1; i < sorted.length; i += 1) {
        assert.ok(sorted[i - 1].price >= sorted[i].price);
      }
    }
    if (sort === 'price-per-day') {
      for (let i = 1; i < sorted.length; i += 1) {
        assert.ok(sorted[i - 1].pricePerDay <= sorted[i].pricePerDay);
      }
    }
  }

  const httpStars = { posts: 0, urls: [] as string[] };
  await startPage1ReceiptStream(ranked, { adults: 2, sort: 'stars' }, {
    fetchImpl: makeReceiptFetch(httpStars),
  }).presented;
  assert.ok(
    hotelIdsFromReceiptUrls(httpStars.urls).every((id) => !pricedHotelIds.has(id)),
    'stars sort must not re-request cached live prices',
  );
  void first;
});

test('9. different occupancy is a cache miss and does not reuse the 2A price', async () => {
  const offer = makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG' });
  const http1 = { posts: 0, urls: [] as string[] };
  const first = await startPage1ReceiptStream([offer, makeSunweb({ id: 'sun-1' })], { adults: 2 }, {
    fetchImpl: makeReceiptFetch(http1),
  }).presented;
  assert.ok(http1.posts >= 1);
  assert.ok(first.page1.some((item) => item.id === offer.id && item.livePriceStatus === 'proven'));

  const http2 = { posts: 0, urls: [] as string[] };
  const second = await startPage1ReceiptStream([offer, makeSunweb({ id: 'sun-1' })], { adults: 2, rooms: 2 }, {
    fetchImpl: makeReceiptFetch(http2),
  }).presented;
  assert.equal(http2.posts, 0, 'Package-1 does not Receipt non-2A occupancy');
  assert.ok(!second.page1.some((item) => item.id === offer.id && item.livePriceStatus === 'proven'));
});

test('10. different offer is a cache miss and performs Receipt', async () => {
  const first = makePv({ id: 'prijsvrij-100-2026-08-20-8-900-LG' });
  const second = makePv({ id: 'prijsvrij-200-2026-08-20-8-900-LG' });
  const sun = makeSunweb({ id: 'sun-1' });
  const http1 = { posts: 0, urls: [] as string[] };
  await startPage1ReceiptStream([first, sun], { adults: 2 }, { fetchImpl: makeReceiptFetch(http1) }).presented;

  const http2 = { posts: 0, urls: [] as string[] };
  await startPage1ReceiptStream([second, sun], { adults: 2 }, { fetchImpl: makeReceiptFetch(http2) }).presented;
  assert.ok(http2.posts >= 1);
  assert.ok(http2.urls.some((url) => url.includes('/200/receipt/')));
});

test('11. expired live price is a cache miss', async () => {
  const t0 = 5_000_000;
  setResultsLivePriceNowMsForTests(t0);
  const offer = makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG' });
  const sun = makeSunweb({ id: 'sun-1' });
  const http1 = { posts: 0, urls: [] as string[] };
  await startPage1ReceiptStream([offer, sun], { adults: 2 }, { fetchImpl: makeReceiptFetch(http1) }).presented;
  assert.ok(http1.posts >= 1);

  setResultsLivePriceNowMsForTests(t0 + RESULTS_LIVE_PRICE_TTL_MS + 1);
  const http2 = { posts: 0, urls: [] as string[] };
  await startPage1ReceiptStream([offer, sun], { adults: 2 }, { fetchImpl: makeReceiptFetch(http2) }).presented;
  assert.ok(http2.posts >= 1, 'expired overlay must Receipt again');
});

test('12. cached unavailable stays fail-closed and does not HTTP again', async () => {
  const offer = makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG', price: 900 });
  setResultsLivePriceOverlay(offer.id, { adults: 2 }, {
    price: 900,
    pricePerDay: 112,
    livePriceStatus: 'unavailable',
    livePriceSource: undefined,
  });
  const http = { posts: 0, urls: [] as string[] };
  const presented = await startPage1ReceiptStream(
    [offer, makeSunweb({ id: 'sun-ok', price: 350 })],
    { adults: 2 },
    { fetchImpl: makeReceiptFetch(http) },
  ).presented;
  assert.equal(http.posts, 0);
  assert.ok(!presented.page1.some((item) => item.id === offer.id && item.livePriceStatus === 'proven'));
});

test('13-14. page-1 max-3 and Receipt safety cap still apply on a cold cache', async () => {
  const offers = [
    ...Array.from({ length: 20 }, (_, index) =>
      makePv({ id: `prijsvrij-${2000 + index}-2026-08-20-8-900-LG`, price: 800 }),
    ),
    ...Array.from({ length: 8 }, (_, index) => makeSunweb({ id: `sunweb-c-${index}` })),
  ];
  const stats = emptyStats();
  const http = { posts: 0, urls: [] as string[] };
  const presented = await startPage1ReceiptStream(offers, { adults: 2 }, {
    fetchImpl: makeReceiptFetch(http),
    stats,
  }).presented;
  assert.ok(
    presented.page1.filter((offer) => offer.provider === 'Prijsvrij').length <= PRIJSVRIJ_PAGE1_MAX_SLOTS,
  );
  assert.ok(stats.receiptCalls <= PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP);
});

test('WITHOUT cache a repeat search Receipts; WITH cache it does not', async () => {
  const offers = [
    makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG' }),
    makeSunweb({ id: 'sunweb-a' }),
  ];
  const cold = { posts: 0, urls: [] as string[] };
  await startPage1ReceiptStream(offers, { adults: 2 }, { fetchImpl: makeReceiptFetch(cold) }).presented;
  assert.ok(cold.posts > 0);

  const warm = { posts: 0, urls: [] as string[] };
  await startPage1ReceiptStream(offers, { adults: 2 }, { fetchImpl: makeReceiptFetch(warm) }).presented;
  assert.equal(warm.posts, 0);
});
