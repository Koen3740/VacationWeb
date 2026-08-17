import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import { rankResultsOffers } from '../../search/rank-results-offers';
import { limitRankedResultsForPagination } from '../../search/pagination';
import {
  RESULTS_LIVE_PRICE_TTL_MS,
  clearResultsLivePriceCache,
  hasResultsLivePriceOverlay,
  setResultsLivePriceNowMsForTests,
  setResultsLivePriceOverlay,
} from '../../search/results-live-price-cache';
import { PRIJSVRIJ_PAGE1_MAX_SLOTS, PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP } from './constants';
import {
  PRIJSVRIJ_RECEIPT_MATCHSET_CONCURRENCY,
  PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY,
  clearLivePriceInflightForTests,
  priceLiveRequiredMatchset,
  startPage1ReceiptStream,
  type Page1ReceiptPricingStats,
} from './page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from './receipt-auth';

const ROOT = join(__dirname, '../../..');

afterEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
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

function build921(): TravelOffer[] {
  const pv: TravelOffer[] = [];
  for (let index = 0; index < 859; index += 1) {
    const allInclusive = index < 22;
    pv.push(
      makePv({
        id: `prijsvrij-${1000 + index}-2026-08-20-8-900-${allInclusive ? 'AI' : 'LG'}`,
        boardType: allInclusive ? 'All Inclusive' : 'Logies',
        price: allInclusive && index < 3 ? 80 + index : 5000 + index,
        pricePerDay: allInclusive && index < 3 ? 10 : 625,
      }),
    );
  }
  const sunweb: TravelOffer[] = [];
  for (let index = 0; index < 58; index += 1) {
    sunweb.push(
      makeSunweb({
        id: `sunweb-${index}`,
        boardType: index < 8 ? 'All Inclusive' : 'Logies',
        price: 300 + index,
      }),
    );
  }
  const eliza: TravelOffer[] = Array.from({ length: 4 }, (_, index) => ({
    ...makeSunweb({ id: `eliza-${index}` }),
    provider: 'Eliza was here',
    boardType: 'Logies',
    price: 400,
  }));
  return [...pv, ...sunweb, ...eliza];
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

function makeCorendon(id: string): TravelOffer {
  return {
    provider: 'Corendon',
    hotelName: 'Corendon Hotel',
    destinationCountry: 'Portugal',
    departureDate: '2026-08-27',
    nights: 4,
    flightIncluded: 'true',
    price: 458,
    pricePerDay: 115,
    boardType: 'Logies',
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U',
    id,
  };
}

function makeEliza(id: string): TravelOffer {
  const landing =
    'https://www.elizawashere.be/spanje/andalusie/ronda/casita-paradise-island' +
    '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
    '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-11-19' +
    '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30';
  return {
    provider: 'Eliza was here',
    hotelName: 'Casita Paradise Island',
    destinationCountry: 'Spanje',
    departureDate: '2026-11-19',
    nights: 7,
    flightIncluded: 'true',
    price: 599,
    pricePerDay: 86,
    boardType: 'Logies',
    imageUrl: 'https://example.com/a.jpg',
    deepLink: `https://www.elizawashere.be/reizen?tt=1327_2084000_511747_&r=${encodeURIComponent(landing)}`,
    id,
  };
}

function makeCoverageFetch(counter: { posts: number; urls: string[]; sunweb: number }): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('sunweb')) {
      counter.sunweb += 1;
    }
    if (url.includes('lowestpricesacco')) {
      counter.posts += 1;
      counter.urls.push(url);
      return new Response(
        JSON.stringify({
          package: {
            lowestPriceTrip: {
              tripDepartureDate: '2026-08-27T00:00:00',
              trip: {
                price: 876,
                tripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
              },
            },
          },
        }),
        { status: 200 },
      );
    }
    if (url.includes('GetPromotedPriceApi')) {
      counter.posts += 1;
      counter.urls.push(url);
      return new Response(
        JSON.stringify({
          accommodationId: 6270665,
          duration: 8,
          price: { totalPrice: 1304, averagePrice: 652, value: 652, legend: 'Vanafprijs p.p.' },
          departureDate: { raw: '2026-11-19' },
          acmInformation: { mealplanCode: 'LG' },
        }),
        { status: 200 },
      );
    }
    if (url.includes('elizawashere.be') && !url.includes('/api/')) {
      return new Response(
        '{"template":"AccommodationPage","contextItemId":"29c6d01a-70c6-4297-9422-1c3dab8c94ad"}' +
          '"PDP.promotedPriceId":"C6E4E13C-D74A-4A4D-BC6B-C151B6FF1E42"',
        { status: 200 },
      );
    }
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

test('A/L. 921-match page-1 resolves while full matchset is still pending', async () => {
  const catalog = build921();
  const ranked = rankResultsOffers(catalog, { adults: 2, sort: 'value' });
  assert.equal(ranked.length, 921);

  const page1Http = { posts: 0, urls: [] as string[] };
  const stats = emptyStats();
  const stream = startPage1ReceiptStream(ranked, { adults: 2 }, {
    fetchImpl: makeReceiptFetch(page1Http),
    paginationPool: limitRankedResultsForPagination(ranked),
    stats,
  });

  const presented = await stream.presented;
  assert.ok(presented.page1.length > 0);
  assert.ok(
    presented.page1.filter((offer) => offer.provider === 'Prijsvrij').length <= PRIJSVRIJ_PAGE1_MAX_SLOTS,
  );
  assert.ok(stats.receiptCalls <= PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP);
  assert.ok((stats.maxInFlightReceiptCalls ?? 0) <= PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY);
  assert.equal(stats.matchsetReceiptCalls ?? 0, 0);
  assert.ok(page1Http.posts > 0);
  assert.ok(page1Http.posts <= PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP);

  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let gated = false;
  const matchsetPromise = priceLiveRequiredMatchset(ranked, { adults: 2 }, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('/token') && !url.includes('receipt')) {
        return new Response(JSON.stringify({ token: 'r'.repeat(40) }), { status: 200 });
      }
      if (!gated) {
        gated = true;
        await gate;
      }
      return makeReceiptFetch({ posts: 0, urls: [] })(input);
    },
  });

  let matchsetDone = false;
  void matchsetPromise.then(() => {
    matchsetDone = true;
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));

  assert.equal(matchsetDone, false, 'full matchset must still be pending after page-1 presented');
  release();
  await matchsetPromise;
  assert.equal(matchsetDone, true);
});

test('B. after awaiting matchset, eligible PV/Corendon/Eliza are cached; Sunweb is not fetched', async () => {
  const catalog = [
    ...build921(),
    makeCorendon('corendon-9514'),
    makeEliza('eliza-6270665'),
  ];
  const ranked = rankResultsOffers(catalog, { adults: 2 });
  const http = { posts: 0, urls: [] as string[], sunweb: 0 };
  await priceLiveRequiredMatchset(ranked, { adults: 2 }, { fetchImpl: makeCoverageFetch(http) });

  const params = { adults: 2 };
  for (const offer of ranked.filter((item) => item.provider === 'Prijsvrij')) {
    assert.ok(hasResultsLivePriceOverlay(offer.id, params), offer.id);
  }
  assert.ok(hasResultsLivePriceOverlay('corendon-9514', params));
  assert.ok(hasResultsLivePriceOverlay('eliza-6270665', params));
  assert.equal(http.sunweb, 0);
  assert.ok(!http.urls.some((url) => url.includes('sunweb')));
});

test('C-G. cached matchset prices are reused for filter and price sorts', async () => {
  const catalog = build921();
  const ranked = rankResultsOffers(catalog, { adults: 2, sort: 'value' });
  const seed = { posts: 0, urls: [] as string[] };
  const stream = startPage1ReceiptStream(ranked, { adults: 2 }, {
    fetchImpl: makeReceiptFetch(seed),
    paginationPool: limitRankedResultsForPagination(ranked),
  });
  await stream.presented;
  await priceLiveRequiredMatchset(ranked, { adults: 2 }, { fetchImpl: makeReceiptFetch(seed) });
  assert.ok(seed.posts >= 22, 'full matchset must price all eligible Prijsvrij');

  const aiParams = { adults: 2, boardTypes: ['All Inclusive'], sort: 'price' as const };
  const aiRanked = rankResultsOffers(catalog, aiParams);
  assert.equal(aiRanked.length, 30);
  assert.equal(aiRanked.filter((offer) => offer.provider === 'Prijsvrij').length, 22);
  assert.ok(aiRanked.every((offer) => offer.boardType === 'All Inclusive'));
  assert.ok(
    aiRanked.some((offer) => offer.provider === 'Prijsvrij' && offer.price < 5000),
    'price sort must use cached live price, not catalog 5000+',
  );

  const httpAi = { posts: 0, urls: [] as string[] };
  const stats = emptyStats();
  await startPage1ReceiptStream(aiRanked, aiParams, {
    fetchImpl: makeReceiptFetch(httpAi),
    paginationPool: limitRankedResultsForPagination(aiRanked),
    stats,
  }).presented;
  await priceLiveRequiredMatchset(aiRanked, aiParams, {
    fetchImpl: makeReceiptFetch(httpAi),
    stats,
  });
  assert.equal(httpAi.posts, 0, 'All Inclusive must not Receipt already-priced offers');
  assert.equal(stats.receiptCalls, 0);
  assert.equal(stats.matchsetReceiptCalls ?? 0, 0);

  for (const sort of ['price', 'price-desc', 'price-per-day'] as const) {
    const sorted = rankResultsOffers(catalog, { ...aiParams, sort });
    assert.equal(sorted.length, 30);
    const livePv = sorted.filter((offer) => offer.provider === 'Prijsvrij' && offer.livePriceStatus === 'proven');
    assert.equal(livePv.length, 22);
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
    const sortHttp = { posts: 0, urls: [] as string[] };
    await startPage1ReceiptStream(sorted, { ...aiParams, sort }, {
      fetchImpl: makeReceiptFetch(sortHttp),
      paginationPool: limitRankedResultsForPagination(sorted),
    }).presented;
    await priceLiveRequiredMatchset(sorted, { ...aiParams, sort }, {
      fetchImpl: makeReceiptFetch(sortHttp),
    });
    assert.equal(sortHttp.posts, 0, `${sort} must not re-request cached live prices`);
  }

  const httpStars = { posts: 0, urls: [] as string[] };
  const starsRanked = rankResultsOffers(catalog, { adults: 2, sort: 'stars' });
  await startPage1ReceiptStream(starsRanked, { adults: 2, sort: 'stars' }, {
    fetchImpl: makeReceiptFetch(httpStars),
    paginationPool: limitRankedResultsForPagination(starsRanked),
  }).presented;
  await priceLiveRequiredMatchset(starsRanked, { adults: 2, sort: 'stars' }, {
    fetchImpl: makeReceiptFetch(httpStars),
  });
  assert.equal(httpStars.posts, 0, 'stars sort must not re-request cached live prices');
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
  assert.ok(!presented.page1.some((item) => item.id === offer.id));
  assert.ok(presented.page1.every((item) => item.livePriceStatus !== 'unavailable' || item.provider !== 'Prijsvrij'));
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
  assert.ok(http.posts >= stats.receiptCalls);
});

test('WITHOUT cache a filter action Receipts; WITH cache it does not', async () => {
  const catalog = build921();
  const aiParams = { adults: 2, boardTypes: ['All Inclusive'] as string[], sort: 'price' as const };

  const cold = { posts: 0, urls: [] as string[] };
  const coldRanked = rankResultsOffers(catalog, aiParams);
  await startPage1ReceiptStream(coldRanked, aiParams, {
    fetchImpl: makeReceiptFetch(cold),
    paginationPool: limitRankedResultsForPagination(coldRanked),
  }).presented;
  assert.ok(cold.posts > 0);

  clearResultsLivePriceCache();
  const seed = { posts: 0, urls: [] as string[] };
  const fullRanked = rankResultsOffers(catalog, { adults: 2 });
  await startPage1ReceiptStream(fullRanked, { adults: 2 }, {
    fetchImpl: makeReceiptFetch(seed),
    paginationPool: limitRankedResultsForPagination(fullRanked),
  }).presented;
  await priceLiveRequiredMatchset(fullRanked, { adults: 2 }, { fetchImpl: makeReceiptFetch(seed) });
  assert.ok(seed.posts > 0);

  const warm = { posts: 0, urls: [] as string[] };
  const warmRanked = rankResultsOffers(catalog, aiParams);
  await startPage1ReceiptStream(warmRanked, aiParams, {
    fetchImpl: makeReceiptFetch(warm),
    paginationPool: limitRankedResultsForPagination(warmRanked),
  }).presented;
  await priceLiveRequiredMatchset(warmRanked, aiParams, { fetchImpl: makeReceiptFetch(warm) });
  assert.equal(warm.posts, 0);
  assert.ok(
    warmRanked.filter((offer) => offer.provider === 'Prijsvrij').every((offer) => offer.livePriceStatus === 'proven'),
  );
});

test('K. page-1 safety constants stay Package-1 / 2A values', () => {
  assert.equal(PRIJSVRIJ_PAGE1_MAX_SLOTS, 3);
  assert.equal(PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP, 10);
  assert.equal(PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY, 5);
  assert.equal(PRIJSVRIJ_RECEIPT_MATCHSET_CONCURRENCY, 5);
  assert.equal(RESULTS_LIVE_PRICE_TTL_MS, 8 * 60 * 60 * 1000);
});

test('M. page-1 and matchset overlap does not duplicate Receipt HTTP after cache/inflight', async () => {
  const offer = makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG' });
  const sun = makeSunweb({ id: 'sun-1' });
  const http = { posts: 0, urls: [] as string[] };
  const fetchImpl = makeReceiptFetch(http);
  const stream = startPage1ReceiptStream([offer, sun], { adults: 2 }, { fetchImpl });
  const matchset = priceLiveRequiredMatchset([offer, sun], { adults: 2 }, { fetchImpl });
  await Promise.all([stream.presented, matchset]);
  assert.equal(http.posts, 1);
});

test('source: Results page and presented() do not await the matchset', () => {
  const page = readFileSync(join(ROOT, 'app/results/page.tsx'), 'utf8');
  const pricing = readFileSync(join(ROOT, 'lib/providers/prijsvrij/page1-receipt-pricing.ts'), 'utf8');
  assert.ok(page.includes('prepareResultsOffers'));
  assert.ok(!/await\s+priceLiveRequiredMatchset/.test(page));
  assert.ok(!/await\s+priceLiveRequiredMatchset/.test(pricing));
  assert.ok(pricing.includes('PRIJSVRIJ_RECEIPT_MATCHSET_CONCURRENCY'));
});
