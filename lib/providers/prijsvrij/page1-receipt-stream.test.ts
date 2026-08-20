import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import {
  PRIJSVRIJ_PROVIDER_NAME,
  PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP,
} from './constants';
import {
  PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY,
  pricePage1WithPrijsvrijReceipts,
  resolveResultsPageSlice,
  startPage1ReceiptStream,
  clearLivePriceInflightForTests,
  type Page1ReceiptPricingStats,
  type Page1StreamSlot,
} from './page1-receipt-pricing';
import { paginateResults, buildResultsPageHref } from '../../search/pagination';
import { clearPrijsvrijReceiptTokenCache } from './receipt-auth';
import { clearResultsLivePriceCache } from '../../search/results-live-price-cache';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  clearPrijsvrijReceiptTokenCache();
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
});

function okReceiptBody(total = 800): string {
  return JSON.stringify({
    Receipt: {
      Package: {
        PriceInfo: { TotalInclLocal: { Value: total } },
        PaxDetails: { Adults: 2, Children: 0 },
      },
    },
  });
}

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    departureDate: '2026-09-30',
    nights: 8,
    flightIncluded: 'true',
    price: 472,
    pricePerDay: 59,
    imageUrl: 'https://example.com/a.jpg',
    deepLink:
      'https://www.prijsvrij.be/vakantie/?r=https%3A%2F%2Fwww.prijsvrij.be%2Fvakanties%2Fspanje%2Fmallorca%2Fporto-cristo%2Fportodrach%3Fvertrekdatum%3D2026-09-30%26reisduurdagen%3D8%26transport%3Dvl',
    ...overrides,
  };
}

function makeStaggeredFetch(options: {
  latencyByHotelId?: Record<string, number>;
  failHotelIds?: Set<string>;
  onReceipt?: (hotelId: string) => void;
}): typeof fetch {
  const fail = options.failHotelIds ?? new Set<string>();
  const latencyByHotelId = options.latencyByHotelId ?? {};
  return async (input) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 's'.repeat(40) }), { status: 200 });
    }
    const hotelMatch = /\/(\d+)\/receipt\//.exec(url);
    const hotelId = hotelMatch?.[1] ?? '';
    options.onReceipt?.(hotelId);
    const latency = latencyByHotelId[hotelId] ?? 0;
    if (latency > 0) {
      await delay(latency);
    }
    if (fail.has(hotelId)) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(okReceiptBody(), { status: 200 });
  };
}

function mixedPage1Offers(): TravelOffer[] {
  return [
    makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME, hotelName: 'PV One' }),
    makeOffer({ id: 'corendon-a', provider: 'Corendon', hotelName: 'Cor A' }),
    makeOffer({ id: 'prijsvrij-200-x', provider: PRIJSVRIJ_PROVIDER_NAME, hotelName: 'PV Two' }),
    makeOffer({ id: 'sunweb-a', provider: 'Sunweb', hotelName: 'Sun A' }),
    makeOffer({ id: 'corendon-b', provider: 'Corendon', hotelName: 'Cor B' }),
    makeOffer({ id: 'prijsvrij-300-x', provider: PRIJSVRIJ_PROVIDER_NAME, hotelName: 'PV Three' }),
    makeOffer({ id: 'sunweb-b', provider: 'Sunweb', hotelName: 'Sun B' }),
    makeOffer({ id: 'corendon-c', provider: 'Corendon', hotelName: 'Cor C' }),
    makeOffer({ id: 'sunweb-c', provider: 'Sunweb', hotelName: 'Sun C' }),
    makeOffer({ id: 'corendon-d', provider: 'Corendon', hotelName: 'Cor D' }),
    makeOffer({ id: 'prijsvrij-400-x', provider: PRIJSVRIJ_PROVIDER_NAME, hotelName: 'PV Reserve' }),
    makeOffer({ id: 'corendon-e', provider: 'Corendon', hotelName: 'Cor E' }),
  ];
}

function pendingSlots(slots: Page1StreamSlot[]) {
  return slots.filter((slot) => slot.kind === 'pending');
}

function immediateSlots(slots: Page1StreamSlot[]) {
  return slots.filter((slot) => slot.kind === 'immediate');
}

test('stream: non-Receipt cards are available before any Receipt resolves', async () => {
  clearPrijsvrijReceiptTokenCache();
  const offers = mixedPage1Offers();
  const stream = startPage1ReceiptStream(offers, { adults: 2 }, {
    fetchImpl: makeStaggeredFetch({ latencyByHotelId: { '100': 250, '200': 250, '300': 250 } }),
  });

  const immediate = immediateSlots(stream.slots);
  assert.ok(pendingSlots(stream.slots).length >= 3);
  assert.ok(immediate.every((slot) => slot.offer.provider !== 'Sunweb'));

  let presentedDone = false;
  void stream.presented.then(() => {
    presentedDone = true;
  });
  await delay(20);
  assert.equal(presentedDone, false);
  await stream.presented;
});

test('stream: Receipt slot appears after its own resolve', async () => {
  clearPrijsvrijReceiptTokenCache();
  const offers = mixedPage1Offers();
  const stream = startPage1ReceiptStream(offers, { adults: 2 }, {
    fetchImpl: makeStaggeredFetch({ latencyByHotelId: { '100': 40, '200': 40, '300': 40 } }),
  });

  const firstPending = pendingSlots(stream.slots)[0];
  assert.equal(firstPending.kind, 'pending');
  const priced = await firstPending.offer;
  assert.ok(priced);
  assert.equal(priced.provider, PRIJSVRIJ_PROVIDER_NAME);
  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.livePriceSource, 'receipt');
});

test('stream: different Receipt slots may resolve independently', async () => {
  clearPrijsvrijReceiptTokenCache();
  const offers = mixedPage1Offers();
  const stream = startPage1ReceiptStream(offers, { adults: 2 }, {
    fetchImpl: makeStaggeredFetch({
      latencyByHotelId: { '100': 40, '200': 280, '300': 280 },
    }),
  });

  const pending = pendingSlots(stream.slots);
  assert.ok(pending.length >= 3);

  const fast = pending.find((slot) => slot.kind === 'pending');
  const slow = pending.find((slot) => slot.selectedIndex === 2);
  assert.ok(fast && slow && fast.kind === 'pending' && slow.kind === 'pending');

  let presentedDone = false;
  void stream.presented.then(() => {
    presentedDone = true;
  });

  const fastOffer = await fast.offer;
  assert.ok(fastOffer);
  assert.equal(fastOffer.id, 'prijsvrij-100-x');
  assert.equal(presentedDone, false);

  let slowDone = false;
  void slow.offer.then(() => {
    slowDone = true;
  });
  await delay(20);
  assert.equal(slowDone, false);

  await stream.presented;
  assert.equal(presentedDone, true);
  assert.ok(await slow.offer);
});

test('stream: ranking/position stays in selected candidate order', async () => {
  clearPrijsvrijReceiptTokenCache();
  const offers = mixedPage1Offers();
  const stream = startPage1ReceiptStream(offers, { adults: 2 }, {
    fetchImpl: makeStaggeredFetch({ latencyByHotelId: { '100': 5, '200': 5, '300': 5 } }),
  });

  assert.ok(stream.slots.length > 0);
  for (let i = 0; i < stream.slots.length; i += 1) {
    assert.equal(stream.slots[i].selectedIndex, i);
  }
  const presented = await stream.presented;
  assert.ok(presented.page1.every((offer) => offer.livePriceStatus === 'proven'));
  assert.equal(presented.page1.some((offer) => offer.provider === 'Sunweb'), false);
});

test('stream: page1Ids are only available after full presentation', async () => {
  clearPrijsvrijReceiptTokenCache();
  const offers = mixedPage1Offers();
  const stream = startPage1ReceiptStream(offers, { adults: 2 }, {
    fetchImpl: makeStaggeredFetch({
      latencyByHotelId: { '100': 30, '200': 200, '300': 200 },
    }),
  });

  let presented: Awaited<typeof stream.presented> | undefined;
  void stream.presented.then((value) => {
    presented = value;
  });

  await pendingSlots(stream.slots)[0].offer;
  assert.equal(presented, undefined);

  const done = await stream.presented;
  assert.equal(done.page1Ids.length, done.page1.length);
  assert.deepEqual(
    done.page1Ids,
    done.page1.map((offer) => offer.id),
  );
});

test('stream: reserve/backfill still fills a failed primary slot', async () => {
  clearPrijsvrijReceiptTokenCache();
  const offers = mixedPage1Offers();
  const stream = startPage1ReceiptStream(offers, { adults: 2 }, {
    fetchImpl: makeStaggeredFetch({
      failHotelIds: new Set(['100']),
      latencyByHotelId: { '100': 20, '200': 20, '300': 20, '400': 20 },
    }),
  });

  const presented = await stream.presented;
  assert.ok(!presented.page1.some((offer) => offer.id === 'prijsvrij-100-x'));
  assert.ok(presented.page1.some((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME && offer.livePriceSource === 'receipt'));
});

test('stream: Receipt failure does not use feed/Search/Matrix price', async () => {
  clearPrijsvrijReceiptTokenCache();
  const offers = [
    makeOffer({ id: 'corendon-a', provider: 'Corendon', price: 400 }),
    makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 999 }),
    makeOffer({ id: 'sunweb-a', provider: 'Sunweb', price: 350 }),
  ];
  const stream = startPage1ReceiptStream(offers, { adults: 2 }, {
    fetchImpl: makeStaggeredFetch({ failHotelIds: new Set(['100']) }),
  });
  const pvSlot = pendingSlots(stream.slots)[0];
  assert.equal(await pvSlot.offer, null);
  const presented = await stream.presented;
  assert.ok(!presented.page1.some((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME));
  assert.ok(presented.page1.every((offer) => offer.livePriceSource !== 'search'));
});

test('stream: presented page1 matches awaited pipeline; no page1/page2 duplicates', async () => {
  clearPrijsvrijReceiptTokenCache();
  const offers = mixedPage1Offers();
  const fetchImpl = makeStaggeredFetch({
    latencyByHotelId: { '100': 10, '200': 10, '300': 10 },
  });
  const stream = startPage1ReceiptStream(offers, { adults: 2 }, { fetchImpl, pageSize: 10 });
  const awaited = await pricePage1WithPrijsvrijReceipts(offers, { adults: 2 }, {
    fetchImpl: makeStaggeredFetch({ latencyByHotelId: { '100': 0, '200': 0, '300': 0 } }),
    pageSize: 10,
  });
  const presented = await stream.presented;
  assert.deepEqual(
    presented.page1.map((offer) => offer.id),
    awaited.map((offer) => offer.id),
  );
  const overlap = presented.page1.filter((offer) =>
    presented.remaining.some((rest) => rest.id === offer.id),
  );
  assert.equal(overlap.length, 0);
  const page2 = paginateResults(presented.remaining, 1, 10);
  const page1Set = new Set(presented.page1Ids);
  assert.ok(page2.every((offer) => !page1Set.has(offer.id)));
});

test('stream: page 2+ with page1Ids does 0 Receipt calls; later pages keep ids', async () => {
  clearPrijsvrijReceiptTokenCache();
  const offers = mixedPage1Offers();
  const stats1: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };
  const page1 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1 },
    { fetchImpl: makeStaggeredFetch({}), stats: stats1, pageSize: 10 },
  );
  assert.ok(stats1.receiptCalls > 0);
  assert.ok((page1.page1Ids?.length ?? 0) === page1.visibleOffers.length);
  assert.ok(page1.visibleOffers.every((offer) => offer.livePriceStatus !== 'unavailable'));

  const stats2: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };
  const page2 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 2, page1Ids: page1.page1Ids },
    { fetchImpl: makeStaggeredFetch({}), stats: stats2, pageSize: 10 },
  );
  assert.equal(stats2.receiptCalls, 0);
  assert.deepEqual(page2.page1Ids, page1.page1Ids);

  const page3 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 3, page1Ids: page1.page1Ids },
    { fetchImpl: makeStaggeredFetch({}), pageSize: 10 },
  );
  const page4 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 4, page1Ids: page1.page1Ids },
    { fetchImpl: makeStaggeredFetch({}), pageSize: 10 },
  );
  assert.deepEqual(page3.page1Ids, page1.page1Ids);
  assert.deepEqual(page4.page1Ids, page1.page1Ids);
  const href = buildResultsPageHref(
    { adults: 2, pageSize: 10, page1Ids: page1.page1Ids },
    3,
  );
  assert.ok(href.includes('page1Ids='));
});

test('stream: max 3 Prijsvrij, cap ≤10, C=5 still hold', async () => {
  clearPrijsvrijReceiptTokenCache();
  let maxInFlight = 0;
  let inFlight = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 'c'.repeat(40) }), { status: 200 });
    }
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await delay(30);
    inFlight -= 1;
    return new Response(okReceiptBody(), { status: 200 });
  };

  const offers = [
    ...Array.from({ length: 3 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${1000 + i}-x`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
    ...Array.from({ length: 12 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${2000 + i}-x`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
  ];
  const stats: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };
  const presented = await startPage1ReceiptStream(offers, { adults: 2 }, {
    fetchImpl,
    stats,
    pageSize: 10,
  }).presented;

  assert.ok(presented.page1.length <= 10);
  assert.ok(presented.page1.every((o) => o.livePriceStatus !== 'unavailable'));
  assert.ok(presented.page1.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length <= 3);
  assert.ok(stats.receiptCalls <= PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP);
  assert.ok(maxInFlight <= PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY);
  assert.equal(PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY, 5);
});

test('stream: time-to-first-usable-results is before total Receipt wall time', async () => {
  clearPrijsvrijReceiptTokenCache();
  const offers = mixedPage1Offers();
  const t0 = Date.now();
  const stream = startPage1ReceiptStream(offers, { adults: 2 }, {
    fetchImpl: makeStaggeredFetch({
      latencyByHotelId: { '100': 180, '200': 180, '300': 180 },
    }),
  });
  const ttfur = Date.now() - t0;
  assert.ok(pendingSlots(stream.slots).length >= 3);
  assert.ok(ttfur < 200, `expected stream slots in <200ms, got ${ttfur}ms`);

  const presented = await stream.presented;
  const wall = Date.now() - t0;
  assert.ok(wall >= 150, `expected Receipt wall time, got ${wall}ms`);
  assert.ok(ttfur < wall);
  assert.ok(presented.page1.length <= 10);
  assert.ok(presented.page1.every((offer) => offer.livePriceStatus !== 'unavailable'));
});
