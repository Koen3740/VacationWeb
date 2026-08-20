import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import {
  PRIJSVRIJ_PROVIDER_NAME,
  PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP,
} from './constants';
import {
  buildRemainingFromPresentedPage1,
  getResultsPageOffers,
  mapWithConcurrency,
  markPrijsvrijLivePriceUnavailable,
  PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY,
  priceLiveRequiredMatchset,
  pricePage1AndBuildRemaining,
  pricePage1WithPrijsvrijReceipts,
  resolveResultsPageSlice,
  selectPage1Candidates,
  splitPage1AndRemaining,
  isUsablePage1IdsParam,
  clearLivePriceInflightForTests,
  type Page1ReceiptPricingStats,
} from './page1-receipt-pricing';
import { paginateResults, buildResultsPageHref } from '../../search/pagination';
import { filterToPresentableOffers, hasValidPresentablePrice } from '../../search/presentable-price';
import { clearPrijsvrijReceiptTokenCache } from './receipt-auth';
import { clearResultsLivePriceCache } from '../../search/results-live-price-cache';
import { buildPrijsvrijReceiptFilters, fetchPrijsvrijReceiptPrice } from './receipt-client';
import {
  buildPrijsvrijReceiptContext,
  resolvePrijsvrijReceiptOccupancy,
} from './receipt-context';
import { computePrijsvrijReceiptPricePerPerson } from './receipt-price';

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

function makeTokenAndReceiptFetch(options: {
  latencyMs?: number;
  failHotelIds?: Set<string>;
  onReceiptStart?: () => void;
  onReceiptEnd?: () => void;
}): typeof fetch {
  const fail = options.failHotelIds ?? new Set<string>();
  const latencyMs = options.latencyMs ?? 0;
  return async (input) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 'z'.repeat(40) }), { status: 200 });
    }
    options.onReceiptStart?.();
    try {
      if (latencyMs > 0) {
        await delay(latencyMs);
      }
      const hotelMatch = /\/(\d+)\/receipt\//.exec(url);
      const hotelId = hotelMatch?.[1] ?? '';
      if (fail.has(hotelId)) {
        return new Response(JSON.stringify({}), { status: 200 });
      }
      return new Response(okReceiptBody(), { status: 200 });
    } finally {
      options.onReceiptEnd?.();
    }
  };
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

test('receipt pp: TotalInclLocal ceil / (Adults+Children); infants excluded', () => {
  const price = computePrijsvrijReceiptPricePerPerson({
    PriceInfo: { TotalInclLocal: { Value: 952.99 } },
    PaxDetails: { Adults: 2, Children: 0, Infants: 1 },
  });
  assert.ok(price);
  assert.equal(price.pricePerPerson, 477);
  assert.equal(price.infants, 1);
});

test('receipt pp: children in denominator', () => {
  const price = computePrijsvrijReceiptPricePerPerson({
    PriceInfo: { TotalInclLocal: { Value: 1000 } },
    PaxDetails: { Adults: 2, Children: 2, Infants: 1 },
  });
  assert.ok(price);
  assert.equal(price.pricePerPerson, 250);
});

test('receipt pp: missing Package / invalid TIL → null', () => {
  assert.equal(computePrijsvrijReceiptPricePerPerson(null), null);
  assert.equal(
    computePrijsvrijReceiptPricePerPerson({
      PriceInfo: { TotalInclLocal: { Value: 0 } },
      PaxDetails: { Adults: 2, Children: 0 },
    }),
    null,
  );
  assert.equal(
    computePrijsvrijReceiptPricePerPerson({
      PriceInfo: {},
      PaxDetails: { Adults: 2, Children: 0 },
    }),
    null,
  );
});

test('occupancy: default 2A ok; children/babies/rooms without ages → invalid', () => {
  assert.equal(resolvePrijsvrijReceiptOccupancy({}).ok, true);
  assert.equal(resolvePrijsvrijReceiptOccupancy({ adults: 2 }).ok, true);
  assert.equal(resolvePrijsvrijReceiptOccupancy({ adults: 2, children: 1 }).ok, false);
  assert.equal(resolvePrijsvrijReceiptOccupancy({ adults: 2, babies: 1 }).ok, false);
  assert.equal(resolvePrijsvrijReceiptOccupancy({ adults: 2, rooms: 2 }).ok, false);
  assert.equal(resolvePrijsvrijReceiptOccupancy({ adults: 3 }).ok, false);
});

test('build receipt context: 2A success path; child search → null context', () => {
  const offer = makeOffer({ id: 'prijsvrij-356519-2026-09-30-8-472-LG', provider: PRIJSVRIJ_PROVIDER_NAME });
  const ok = buildPrijsvrijReceiptContext(offer, { adults: 2 });
  assert.ok(ok);
  assert.equal(ok.hotelId, '356519');
  assert.equal(ok.departureYmd, '20260930');
  assert.equal(ok.durationDays, 8);
  assert.ok(ok.filters.some((f) => f.UrlName === 'transport' && f.Value === 'FL'));

  const child = buildPrijsvrijReceiptContext(offer, { adults: 2, children: 1 });
  assert.equal(child, null);
});

test('buildPrijsvrijReceiptFilters: includes reisduur 6_10 for 8 days; airport when known', () => {
  const filters = buildPrijsvrijReceiptFilters({
    departureYmd: '20260930',
    durationDays: 8,
    transport: 'FL',
    airportCode: 'DE-CGN',
  });
  assert.ok(filters.some((f) => f.UrlName === 'reisduur' && f.Value === '6_10'));
  assert.ok(filters.some((f) => f.UrlName === 'luchthaven' && f.Value === 'DE-CGN'));
});

test('selectPage1Candidates: max 3 Prijsvrij when alternatives exist; page size 10', () => {
  const offers: TravelOffer[] = [];
  for (let i = 0; i < 5; i += 1) {
    offers.push(makeOffer({ id: `prijsvrij-${i}`, provider: PRIJSVRIJ_PROVIDER_NAME }));
  }
  for (let i = 0; i < 12; i += 1) {
    offers.push(makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }));
  }
  const { selected } = selectPage1Candidates(offers, 10, 3);
  assert.equal(selected.length, 10);
  assert.equal(selected.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 3);
  assert.ok(selected.filter((o) => o.provider === 'Corendon').length >= 7);
});

test('selectPage1Candidates: may fill with Prijsvrij when alternatives insufficient', () => {
  const offers = [
    makeOffer({ id: 'corendon-1', provider: 'Corendon' }),
    ...Array.from({ length: 15 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${i}`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
  ];
  const { selected } = selectPage1Candidates(offers, 10, 3);
  assert.equal(selected.length, 10);
  assert.equal(selected.filter((o) => o.provider === 'Corendon').length, 1);
  assert.equal(selected.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 9);
});

test('fetchPrijsvrijReceiptPrice: empty / missing package / invalid TIL / 401 refresh', async () => {
  clearPrijsvrijReceiptTokenCache();
  let tokenCalls = 0;
  let receiptCalls = 0;

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      tokenCalls += 1;
      return new Response(JSON.stringify({ token: 'a'.repeat(40) }), { status: 200 });
    }
    receiptCalls += 1;
    if (receiptCalls === 1) {
      return new Response(JSON.stringify({ Message: 'Unauthorized' }), { status: 401 });
    }
    if (url.includes('/356519/')) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    if (url.includes('/1/')) {
      return new Response(JSON.stringify({ Receipt: {} }), { status: 200 });
    }
    if (url.includes('/2/')) {
      return new Response(
        JSON.stringify({
          Receipt: {
            Package: {
              PriceInfo: { TotalInclLocal: { Value: null } },
              PaxDetails: { Adults: 2, Children: 0 },
            },
          },
        }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        Receipt: {
          Package: {
            PriceInfo: { TotalInclLocal: { Value: 952.99 } },
            PaxDetails: { Adults: 2, Children: 0, Infants: 0 },
          },
        },
      }),
      { status: 200 },
    );
  };

  const base = {
    departureYmd: '20260930',
    durationDays: 8,
    filters: buildPrijsvrijReceiptFilters({
      departureYmd: '20260930',
      durationDays: 8,
      transport: 'FL',
    }),
  };

  const empty = await fetchPrijsvrijReceiptPrice({ ...base, hotelId: '356519' }, { fetchImpl });
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.equal(empty.reason, 'empty_receipt');
  assert.ok(tokenCalls >= 2); // initial + 401 refresh

  const missing = await fetchPrijsvrijReceiptPrice({ ...base, hotelId: '1' }, { fetchImpl });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.reason, 'missing_package');

  const invalid = await fetchPrijsvrijReceiptPrice({ ...base, hotelId: '2' }, { fetchImpl });
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.equal(invalid.reason, 'invalid_total');

  const ok = await fetchPrijsvrijReceiptPrice({ ...base, hotelId: '3' }, { fetchImpl });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.price.pricePerPerson, 477);
});

test('page1 pricing: receipt success sets proven price; no feed/search fallback on failure', async () => {
  clearPrijsvrijReceiptTokenCache();
  let receiptPosts = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 'b'.repeat(40) }), { status: 200 });
    }
    receiptPosts += 1;
    if (url.includes('/100/')) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        Receipt: {
          Package: {
            PriceInfo: { TotalInclLocal: { Value: 900 } },
            PaxDetails: { Adults: 2, Children: 0 },
          },
        },
      }),
      { status: 200 },
    );
  };

  const offers = [
    makeOffer({ id: 'corendon-a', provider: 'Corendon', price: 400 }),
    makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 999 }),
    makeOffer({ id: 'prijsvrij-200-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 888 }),
    makeOffer({ id: 'sunweb-a', provider: 'Sunweb', price: 350 }),
  ];

  const stats: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };

  const page = await pricePage1WithPrijsvrijReceipts(
    offers,
    { adults: 2 },
    { fetchImpl, pageSize: 10, stats },
  );

  assert.ok(page.length <= 10);
  const pv = page.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME);
  assert.ok(pv.length <= 3);
  for (const offer of pv) {
    assert.equal(offer.livePriceSource, 'receipt');
    assert.equal(offer.livePriceStatus, 'proven');
    assert.notEqual(offer.price, 999);
    assert.notEqual(offer.price, 888);
  }
  assert.ok(stats.receiptCalls <= PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP);
});

test('page1 pricing: safety cap never exceeded; stops after enough PV', async () => {
  clearPrijsvrijReceiptTokenCache();
  let receiptPosts = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 'c'.repeat(40) }), { status: 200 });
    }
    receiptPosts += 1;
    return new Response(
      JSON.stringify({
        Receipt: {
          Package: {
            PriceInfo: { TotalInclLocal: { Value: 800 } },
            PaxDetails: { Adults: 2, Children: 0 },
          },
        },
      }),
      { status: 200 },
    );
  };

  const offers = [
    ...Array.from({ length: 3 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${1000 + i}-x`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
    ...Array.from({ length: 17 }, (_, i) =>
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

  const page = await pricePage1WithPrijsvrijReceipts(
    offers,
    { adults: 2 },
    { fetchImpl, pageSize: 10, stats },
  );

  assert.ok(page.length <= 10);
  assert.equal(page.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 3);
  assert.ok(page.every((o) => o.livePriceStatus === 'proven' && o.livePriceSource === 'receipt'));
  assert.equal(stats.receiptCalls, 3);
  assert.equal(stats.matchsetReceiptCalls ?? 0, 0);
  assert.equal(receiptPosts, 3);
  assert.ok(stats.receiptCalls <= 10);
  assert.equal(stats.stoppedEarlyBecauseEnoughPv, true);

  await priceLiveRequiredMatchset(offers, { adults: 2 }, { fetchImpl, stats });
  assert.equal(stats.matchsetReceiptCalls, 17);
  assert.equal(receiptPosts, 20);
});

test('page1 pricing: failure → reserve candidate', async () => {
  clearPrijsvrijReceiptTokenCache();
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 'd'.repeat(40) }), { status: 200 });
    }
    if (url.includes('/111/')) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(
      JSON.stringify({
        Receipt: {
          Package: {
            PriceInfo: { TotalInclLocal: { Value: 700 } },
            PaxDetails: { Adults: 2, Children: 0 },
          },
        },
      }),
      { status: 200 },
    );
  };

  const offers = [
    makeOffer({ id: 'corendon-1', provider: 'Corendon' }),
    makeOffer({ id: 'prijsvrij-111-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 1 }),
    makeOffer({ id: 'prijsvrij-222-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 2 }),
    makeOffer({ id: 'corendon-2', provider: 'Corendon' }),
  ];

  const page = await pricePage1WithPrijsvrijReceipts(offers, { adults: 2 }, { fetchImpl });
  const pv = page.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME);
  assert.ok(pv.some((o) => o.id.includes('222')));
  assert.ok(pv.every((o) => o.livePriceSource === 'receipt' && o.price === 350));
});

test('page1 pricing: 2A+baby occupancy → no false Receipt price', async () => {
  let receiptPosts = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('/token')) {
      return new Response(JSON.stringify({ token: 'e'.repeat(40) }), { status: 200 });
    }
    receiptPosts += 1;
    return new Response('{}', { status: 200 });
  };

  const offers = [
    makeOffer({ id: 'prijsvrij-333-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 500 }),
    makeOffer({ id: 'corendon-1', provider: 'Corendon' }),
  ];

  const page = await pricePage1WithPrijsvrijReceipts(
    offers,
    { adults: 2, babies: 1 },
    { fetchImpl },
  );

  assert.equal(receiptPosts, 0);
  assert.ok(!page.some((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME && o.livePriceSource === 'receipt'));
  assert.equal(page.some((o) => o.livePriceStatus === 'unpriced'), false);
  assert.equal(page.length, 0);
});

test('markPrijsvrijLivePriceUnavailable: no proven PV price', () => {
  const marked = markPrijsvrijLivePriceUnavailable([
    makeOffer({ id: 'prijsvrij-1', provider: PRIJSVRIJ_PROVIDER_NAME, price: 400 }),
    makeOffer({ id: 'corendon-1', provider: 'Corendon', price: 300 }),
  ]);
  assert.equal(marked[0].livePriceStatus, 'unavailable');
  assert.equal(marked[1].livePriceStatus, 'unavailable');
  assert.equal(marked[1].livePriceSource, undefined);
});

test('mapWithConcurrency: never exceeds concurrency ceiling', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const items = Array.from({ length: 12 }, (_, i) => i);
  await mapWithConcurrency(items, 5, async () => {
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await delay(30);
    inFlight -= 1;
  });
  assert.equal(maxInFlight, 5);
  assert.equal(PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY, 5);
});

test('page1 concurrency: 3 Receipt calls run in parallel (C=5)', async () => {
  clearPrijsvrijReceiptTokenCache();
  let inFlight = 0;
  let maxInFlight = 0;
  let receiptPosts = 0;
  const fetchImpl = makeTokenAndReceiptFetch({
    latencyMs: 80,
    onReceiptStart: () => {
      receiptPosts += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
    },
    onReceiptEnd: () => {
      inFlight -= 1;
    },
  });

  const offers = [
    ...Array.from({ length: 3 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${500 + i}-x`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
  ];

  const stats: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };

  const started = Date.now();
  const page = await pricePage1WithPrijsvrijReceipts(offers, { adults: 2 }, { fetchImpl, stats });
  const elapsed = Date.now() - started;

  assert.equal(page.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 3);
  assert.equal(stats.receiptCalls, 3);
  assert.equal(receiptPosts, 3);
  assert.equal(maxInFlight, 3);
  assert.equal(stats.maxInFlightReceiptCalls, 3);
  // Serial would be ~240ms; parallel should finish near one latency window.
  assert.ok(elapsed < 200, `expected parallel wall time, got ${elapsed}ms`);
});

test('page1 concurrency: 6+ calls never exceed C=5 in-flight', async () => {
  clearPrijsvrijReceiptTokenCache();
  let inFlight = 0;
  let maxInFlight = 0;
  let receiptPosts = 0;
  const fetchImpl = makeTokenAndReceiptFetch({
    latencyMs: 40,
    onReceiptStart: () => {
      receiptPosts += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
    },
    onReceiptEnd: () => {
      inFlight -= 1;
    },
  });

  // Force 6 primary PV slots (product soft-max bypassed for concurrency probe only).
  const offers = [
    ...Array.from({ length: 6 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${600 + i}-x`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
  ];

  const stats: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };

  await pricePage1WithPrijsvrijReceipts(offers, { adults: 2 }, {
    fetchImpl,
    maxPrijsvrijSlots: 6,
    pageSize: 10,
    stats,
  });

  assert.equal(stats.receiptCalls, 6);
  assert.equal(receiptPosts, 6);
  assert.equal(maxInFlight, 5);
  assert.equal(stats.maxInFlightReceiptCalls, 5);
});

test('page1 concurrency: safety cap ≤10 still enforced under C=5', async () => {
  clearPrijsvrijReceiptTokenCache();
  let receiptPosts = 0;
  const failAll = new Set(
    Array.from({ length: 20 }, (_, i) => String(700 + i)),
  );
  const fetchImpl = makeTokenAndReceiptFetch({
    latencyMs: 5,
    failHotelIds: failAll,
    onReceiptStart: () => {
      receiptPosts += 1;
    },
  });

  const offers = [
    ...Array.from({ length: 3 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${700 + i}-x`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
    ...Array.from({ length: 7 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
    ...Array.from({ length: 17 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${710 + i}-x`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
  ];

  const stats: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };

  await pricePage1WithPrijsvrijReceipts(offers, { adults: 2 }, { fetchImpl, stats });

  assert.equal(stats.receiptCalls, PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP);
  assert.equal(stats.matchsetReceiptCalls ?? 0, 0);
  assert.equal(receiptPosts, 10);
  assert.ok((stats.maxInFlightReceiptCalls ?? 0) <= PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY);

  await priceLiveRequiredMatchset(offers, { adults: 2 }, { fetchImpl, stats });
  assert.equal(stats.matchsetReceiptCalls, 10);
  assert.equal(receiptPosts, 20);
});

test('page1 concurrency: failure → reserve still works within C=5/cap', async () => {
  clearPrijsvrijReceiptTokenCache();
  let inFlight = 0;
  let maxInFlight = 0;
  let receiptPosts = 0;
  const fetchImpl = makeTokenAndReceiptFetch({
    latencyMs: 25,
    failHotelIds: new Set(['801', '802', '803']),
    onReceiptStart: () => {
      receiptPosts += 1;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
    },
    onReceiptEnd: () => {
      inFlight -= 1;
    },
  });

  const offers = [
    makeOffer({ id: 'prijsvrij-801-x', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-802-x', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-803-x', provider: PRIJSVRIJ_PROVIDER_NAME }),
    ...Array.from({ length: 7 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
    makeOffer({ id: 'prijsvrij-901-x', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-902-x', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-903-x', provider: PRIJSVRIJ_PROVIDER_NAME }),
  ];

  const stats: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };

  const page = await pricePage1WithPrijsvrijReceipts(offers, { adults: 2 }, { fetchImpl, stats });
  const pv = page.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME);

  assert.equal(pv.length, 3);
  assert.ok(pv.every((o) => /^prijsvrij-90[123]-x$/.test(o.id)));
  assert.ok(pv.every((o) => o.livePriceSource === 'receipt'));
  assert.equal(stats.receiptCalls, 6);
  assert.equal(receiptPosts, 6);
  assert.ok(maxInFlight <= 5);
  assert.ok((stats.maxInFlightReceiptCalls ?? 0) <= 5);
});

test('page1 selection + remaining pagination intact with concurrency helpers', () => {
  const offers = [
    ...Array.from({ length: 5 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${i}`, provider: PRIJSVRIJ_PROVIDER_NAME }),
    ),
    ...Array.from({ length: 20 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
  ];
  const { page1, remaining } = splitPage1AndRemaining(offers);
  assert.equal(page1.length, 10);
  assert.equal(page1.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 3);
  assert.equal(getResultsPageOffers(offers, 1).length, 10);
  assert.equal(getResultsPageOffers(offers, 2).length, 10);
  assert.deepEqual(
    getResultsPageOffers(offers, 2).map((o) => o.id),
    remaining.slice(0, 10).map((o) => o.id),
  );
  assert.ok(!getResultsPageOffers(offers, 2).some((o) => page1.some((p) => p.id === o.id)));
});

test('REGRESSION: Receipt reserve on page1 must not remain on page2 (pre-fix split remaining)', async () => {
  clearPrijsvrijReceiptTokenCache();
  // Mirrors production failure mode: primary PV fails Receipt, reserve TARGET fills page 1,
  // but pre-Receipt splitPage1AndRemaining still keeps TARGET in remaining → page1∩page2 ≠ ∅.
  const TARGET = 'prijsvrij-359815-2027-03-12-8-269-LO';
  const fetchImpl = makeTokenAndReceiptFetch({
    failHotelIds: new Set(['801']),
  });

  const offers = [
    makeOffer({ id: 'prijsvrij-801-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 100 }),
    ...Array.from({ length: 9 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon', price: 200 + i }),
    ),
    makeOffer({
      id: TARGET,
      provider: PRIJSVRIJ_PROVIDER_NAME,
      price: 269,
      departureDate: '2027-03-12',
      nights: 8,
    }),
    makeOffer({ id: 'prijsvrij-late-1', provider: PRIJSVRIJ_PROVIDER_NAME, price: 400 }),
  ];

  const { selected, prijsvrijReserves } = selectPage1Candidates(offers);
  assert.ok(selected.some((o) => o.id === 'prijsvrij-801-x'));
  assert.ok(!selected.some((o) => o.id === TARGET));
  assert.ok(prijsvrijReserves.some((o) => o.id === TARGET));

  const { remaining: preReceiptRemaining } = splitPage1AndRemaining(offers);
  assert.ok(
    preReceiptRemaining.some((o) => o.id === TARGET),
    'pre-Receipt remaining still contains reserve TARGET (bug precondition)',
  );

  const { page1, remaining } = await pricePage1AndBuildRemaining(offers, { adults: 2 }, { fetchImpl });
  assert.ok(page1.some((o) => o.id === TARGET), 'TARGET presented on page 1 via reserve');
  assert.ok(!page1.some((o) => o.id === 'prijsvrij-801-x'), 'failed primary not presented');
  assert.ok(!remaining.some((o) => o.id === TARGET), 'TARGET excluded from post-Receipt remaining');
  assert.ok(
    remaining.some((o) => o.id === 'prijsvrij-801-x'),
    'failed primary returns to remaining for page 2+',
  );

  const page2 = paginateResults(remaining, 1, 10);
  assert.equal(page1.filter((o) => page2.some((p) => p.id === o.id)).length, 0);

  // Demonstrate old page.tsx bug pattern would duplicate TARGET:
  const buggyPage2 = paginateResults(preReceiptRemaining, 1, 10);
  assert.ok(
    page1.some((o) => o.id === TARGET) && buggyPage2.some((o) => o.id === TARGET),
    'legacy split-remaining would duplicate TARGET on page 2',
  );
});

test('buildRemainingFromPresentedPage1: partition integrity after Receipt success', async () => {
  clearPrijsvrijReceiptTokenCache();
  const fetchImpl = makeTokenAndReceiptFetch({});
  const offers = [
    makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME }),
    makeOffer({ id: 'prijsvrij-200-x', provider: PRIJSVRIJ_PROVIDER_NAME }),
    ...Array.from({ length: 12 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon' }),
    ),
    makeOffer({ id: 'prijsvrij-300-x', provider: PRIJSVRIJ_PROVIDER_NAME }),
  ];

  const { page1, remaining } = await pricePage1AndBuildRemaining(offers, { adults: 2 }, { fetchImpl });
  const presentedIds = new Set(page1.map((o) => o.id));
  const remainingIds = new Set(remaining.map((o) => o.id));

  assert.ok(page1.length <= 10);
  assert.ok(page1.every((o) => o.provider !== 'Corendon' || o.livePriceSource === 'lowestpricesacco'));
  assert.equal(page1.length + remaining.length, offers.length);
  for (const id of presentedIds) {
    assert.ok(!remainingIds.has(id));
  }
  for (const offer of offers) {
    assert.ok(presentedIds.has(offer.id) || remainingIds.has(offer.id));
  }

  // Skipped PV (over soft max) stays available on page 2+
  assert.ok(remainingIds.has('prijsvrij-300-x'));
  const page2 = paginateResults(remaining, 1, 10);
  assert.ok(page2.some((o) => o.id === 'prijsvrij-300-x') || remaining.some((o) => o.id === 'prijsvrij-300-x'));

  assert.deepEqual(
    buildRemainingFromPresentedPage1(offers, page1).map((o) => o.id),
    remaining.map((o) => o.id),
  );
});

test('>3 Prijsvrij: soft max 3 on presented page1; extras remain for page2+', async () => {
  clearPrijsvrijReceiptTokenCache();
  const fetchImpl = makeTokenAndReceiptFetch({});
  const offers = [
    ...Array.from({ length: 6 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${1000 + i}-x`, provider: PRIJSVRIJ_PROVIDER_NAME, price: 100 + i }),
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon', price: 300 + i }),
    ),
  ];

  const { page1, remaining } = await pricePage1AndBuildRemaining(offers, { adults: 2 }, { fetchImpl });
  assert.equal(page1.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 3);
  assert.ok(remaining.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length >= 3);
  assert.equal(page1.filter((o) => remaining.some((r) => r.id === o.id)).length, 0);
});

test('resolveResultsPageSlice page1: normal + max 3 PV + Receipt success', async () => {
  clearPrijsvrijReceiptTokenCache();
  const stats: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };
  const fetchImpl = makeTokenAndReceiptFetch({});
  const offers = [
    ...Array.from({ length: 4 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${i}`, provider: PRIJSVRIJ_PROVIDER_NAME, price: 100 + i }),
    ),
    ...Array.from({ length: 20 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon', price: 200 + i }),
    ),
  ];

  const slice = await resolveResultsPageSlice(offers, { adults: 2, page: 1 }, { fetchImpl, stats });
  assert.ok(slice.visibleOffers.length <= 10);
  assert.equal(slice.visibleOffers.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 3);
  assert.ok(slice.visibleOffers.every((o) => o.livePriceStatus === 'proven' && o.livePriceSource === 'receipt' || o.provider !== PRIJSVRIJ_PROVIDER_NAME));
  assert.ok(!slice.visibleOffers.some((o) => o.provider === 'Corendon'));
  assert.equal(stats.receiptCalls, 3);
  assert.equal(stats.receiptSuccesses, 3);
  assert.ok((slice.page1Ids?.length ?? 0) === slice.visibleOffers.length);
  assert.equal(slice.visibleOffers.length + slice.remaining.length, offers.length);
  assert.equal(
    slice.visibleOffers.filter((o) => slice.remaining.some((r) => r.id === o.id)).length,
    0,
  );
  assert.ok(slice.remaining.some((o) => o.id === 'prijsvrij-3'), 'skipped PV stays for page 2+');
});

test('page 1 with existing page1Ids skips Receipt when the catalog is already presentable', async () => {
  clearPrijsvrijReceiptTokenCache();
  const stats: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };
  let httpCalls = 0;
  const fetchImpl: typeof fetch = async () => {
    httpCalls += 1;
    throw new Error('live pricing must not run on catalog refine');
  };
  const offers = [
    ...Array.from({ length: 8 }, (_, i) =>
      makeOffer({
        id: `sunweb-${i}`,
        provider: 'Sunweb',
        price: 200 + i,
        livePriceStatus: 'proven',
        livePriceSource: 'getPromotedPrice',
      }),
    ),
  ];
  const budgeted = offers.filter((offer) => offer.price <= 208);

  const slice = await resolveResultsPageSlice(
    budgeted,
    { adults: 2, page: 1, page1Ids: ['sunweb-0'], budgetMax: 208 },
    { fetchImpl, stats },
  );

  assert.equal(httpCalls, 0);
  assert.equal(stats.receiptCalls, 0);
  assert.ok(slice.visibleOffers.every((offer) => offer.price <= 208));
  assert.ok(slice.visibleOffers.every((offer) => offer.provider === 'Sunweb'));
  assert.ok(!slice.visibleOffers.some((offer) => offer.livePriceStatus === 'unavailable'));
  assert.ok(slice.page1Ids?.length === slice.visibleOffers.length);
});

test('resolveResultsPageSlice: Receipt failure + reserve on page1, not on page2', async () => {
  clearPrijsvrijReceiptTokenCache();
  const TARGET = 'prijsvrij-359815-2027-03-12-8-269-LO';
  const fetchImpl = makeTokenAndReceiptFetch({ failHotelIds: new Set(['801']) });
  const offers = [
    makeOffer({ id: 'prijsvrij-801-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 100 }),
    ...Array.from({ length: 9 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon', price: 200 + i }),
    ),
    makeOffer({
      id: TARGET,
      provider: PRIJSVRIJ_PROVIDER_NAME,
      price: 269,
      departureDate: '2027-03-12',
      nights: 8,
    }),
    makeOffer({ id: 'prijsvrij-late-1', provider: PRIJSVRIJ_PROVIDER_NAME, price: 400 }),
  ];

  const page1Slice = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1 },
    { fetchImpl },
  );
  assert.ok(page1Slice.visibleOffers.some((o) => o.id === TARGET));
  assert.ok(!page1Slice.remaining.some((o) => o.id === TARGET));

  let receiptCallsOnPage2 = 0;
  const guardedFetch: typeof fetch = async (input, init) => {
    receiptCallsOnPage2 += 1;
    return fetchImpl(input, init);
  };

  const page2Slice = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 2, page1Ids: page1Slice.page1Ids },
    { fetchImpl: guardedFetch },
  );
  assert.equal(receiptCallsOnPage2, 0, 'page 2 must not execute Receipt');
  assert.ok(!page2Slice.visibleOffers.some((o) => o.id === TARGET));
  assert.equal(
    page1Slice.visibleOffers.filter((o) => page2Slice.visibleOffers.some((p) => p.id === o.id))
      .length,
    0,
  );
  assert.ok(
    page2Slice.remaining.some((o) => o.id === 'prijsvrij-801-x') ||
      page2Slice.visibleOffers.some((o) => o.id === 'prijsvrij-801-x'),
    'failed primary available on page 2+',
  );
});

test('resolveResultsPageSlice: page 2/3/4 with valid page1Ids → 0 Receipt; ids preserved', async () => {
  clearPrijsvrijReceiptTokenCache();
  const stats: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };
  let receiptHttp = 0;
  const fetchImpl = makeTokenAndReceiptFetch({
    onReceiptStart: () => {
      receiptHttp += 1;
    },
  });
  const offers = [
    ...Array.from({ length: 5 }, (_, i) =>
      makeOffer({ id: `prijsvrij-${i}`, provider: PRIJSVRIJ_PROVIDER_NAME, price: 90 + i }),
    ),
    ...Array.from({ length: 40 }, (_, i) =>
      makeOffer({
        id: `sunweb-${i}`,
        provider: 'Sunweb',
        price: 150 + i,
        livePriceStatus: 'catalog',
        livePriceSource: 'feed',
      }),
    ),
    ...Array.from({ length: 10 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon', price: 250 + i }),
    ),
  ];

  const page1 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1 },
    { fetchImpl, stats },
  );
  assert.ok(stats.receiptCalls > 0);
  assert.equal(receiptHttp, stats.receiptCalls + (stats.matchsetReceiptCalls ?? 0));
  const presented = new Set(page1.page1Ids);
  assert.ok(isUsablePage1IdsParam(page1.page1Ids, offers));

  for (const page of [2, 3, 4]) {
    const before = receiptHttp;
    const slice = await resolveResultsPageSlice(
      offers,
      { adults: 2, page, page1Ids: page1.page1Ids },
      {
        fetchImpl: async (input, init) => {
          receiptHttp += 1;
          return fetchImpl(input, init);
        },
      },
    );
    assert.equal(receiptHttp, before, `page ${page} must not call Receipt HTTP`);
    assert.equal(slice.needsPage1IdsRedirect, undefined);
    assert.deepEqual(slice.page1Ids, page1.page1Ids, `page1Ids preserved on page ${page}`);
    const presentableRemaining = filterToPresentableOffers(page1.remaining);
    assert.ok(slice.visibleOffers.every((o) => !presented.has(o.id)));
    assert.ok(slice.visibleOffers.every((o) => o.livePriceStatus !== 'unavailable'));
    assert.ok(slice.visibleOffers.every(hasValidPresentablePrice));
    assert.deepEqual(
      slice.visibleOffers.map((o) => o.id),
      presentableRemaining.slice((page - 2) * 10, (page - 1) * 10).map((o) => o.id),
    );

    const href = buildResultsPageHref(
      { adults: 2, pageSize: 10, page1Ids: slice.page1Ids },
      page,
    );
    assert.ok(href.includes(`page=${page}`));
    assert.ok(href.includes('page1Ids='));
    for (const id of page1.page1Ids ?? []) {
      assert.ok(href.includes(id) || href.includes(encodeURIComponent(id)));
    }
  }

  assert.equal(page1.visibleOffers.length + page1.remaining.length, offers.length);
});

test('cold page 2 without page1Ids: page-1 pipeline once + redirect signal with definitive ids', async () => {
  clearPrijsvrijReceiptTokenCache();
  const TARGET = 'prijsvrij-359815-2027-03-12-8-269-LO';
  const stats: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };
  const fetchImpl = makeTokenAndReceiptFetch({ failHotelIds: new Set(['801']) });
  const offers = [
    makeOffer({ id: 'prijsvrij-801-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 100 }),
    ...Array.from({ length: 9 }, (_, i) =>
      makeOffer({ id: `corendon-${i}`, provider: 'Corendon', price: 200 + i }),
    ),
    makeOffer({
      id: TARGET,
      provider: PRIJSVRIJ_PROVIDER_NAME,
      price: 269,
      departureDate: '2027-03-12',
      nights: 8,
    }),
    ...Array.from({ length: 15 }, (_, i) =>
      makeOffer({ id: `corendon-extra-${i}`, provider: 'Corendon', price: 300 + i }),
    ),
    makeOffer({ id: 'prijsvrij-skipped', provider: PRIJSVRIJ_PROVIDER_NAME, price: 400 }),
  ];

  const cold = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 2, country: 'Turkije', sort: 'price' },
    { fetchImpl, stats },
  );

  assert.ok(stats.receiptCalls >= 1, 'cold page 2 runs page-1 Receipt pipeline once');
  assert.equal(cold.needsPage1IdsRedirect, true);
  assert.ok(cold.page1Ids?.includes(TARGET), 'definitive page1Ids include reserve');
  assert.ok(!cold.page1Ids?.includes('prijsvrij-801-x'));
  assert.ok(!cold.visibleOffers.some((o) => o.id === TARGET), 'reserve not on page 2');
  assert.ok(
    cold.remaining.some((o) => o.id === 'prijsvrij-skipped') ||
      cold.visibleOffers.some((o) => o.id === 'prijsvrij-skipped'),
    'skipped PV stays available on page 2+',
  );
  assert.equal(
    cold.page1Ids!.filter((id) => cold.visibleOffers.some((o) => o.id === id)).length,
    0,
    'no page1/page2 duplicates after cold resolve',
  );
  assert.equal(cold.page1Ids!.length + cold.remaining.length, offers.length);

  const redirectHref = buildResultsPageHref(
    {
      adults: 2,
      country: 'Turkije',
      sort: 'price',
      pageSize: 10,
      page1Ids: cold.page1Ids,
    },
    2,
  );
  assert.ok(redirectHref.includes('page=2'), 'redirect keeps requested page');
  assert.ok(redirectHref.includes('page1Ids='));
  assert.ok(redirectHref.includes(TARGET) || redirectHref.includes(encodeURIComponent(TARGET)));

  // Follow-up request with redirected page1Ids: zero Receipt.
  let followUpFetch = 0;
  const followUp = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 2, page1Ids: cold.page1Ids },
    {
      fetchImpl: async (input, init) => {
        followUpFetch += 1;
        return fetchImpl(input, init);
      },
    },
  );
  assert.equal(followUpFetch, 0);
  assert.equal(followUp.needsPage1IdsRedirect, undefined);
  assert.ok(!followUp.visibleOffers.some((o) => o.id === TARGET));
});

test('isUsablePage1IdsParam: empty / no overlap → unusable', () => {
  const offers = [
    makeOffer({ id: 'a', provider: 'Corendon' }),
    makeOffer({ id: 'b', provider: 'Corendon' }),
  ];
  assert.equal(isUsablePage1IdsParam(undefined, offers), false);
  assert.equal(isUsablePage1IdsParam([], offers), false);
  assert.equal(isUsablePage1IdsParam(['missing'], offers), false);
  assert.equal(isUsablePage1IdsParam(['a'], offers), true);
});
