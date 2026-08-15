import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import {
  PRIJSVRIJ_PROVIDER_NAME,
  PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP,
} from './constants';
import {
  getResultsPageOffers,
  mapWithConcurrency,
  markPrijsvrijLivePriceUnavailable,
  PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY,
  pricePage1WithPrijsvrijReceipts,
  selectPage1Candidates,
  splitPage1AndRemaining,
  type Page1ReceiptPricingStats,
} from './page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from './receipt-auth';
import { buildPrijsvrijReceiptFilters, fetchPrijsvrijReceiptPrice } from './receipt-client';
import {
  buildPrijsvrijReceiptContext,
  resolvePrijsvrijReceiptOccupancy,
} from './receipt-context';
import { computePrijsvrijReceiptPricePerPerson } from './receipt-price';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  assert.ok(receiptPosts <= PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP);
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

  assert.equal(page.length, 10);
  assert.equal(page.filter((o) => o.provider === PRIJSVRIJ_PROVIDER_NAME).length, 3);
  assert.equal(stats.receiptCalls, 3);
  assert.equal(receiptPosts, 3);
  assert.ok(stats.receiptCalls <= 10);
  assert.equal(stats.stoppedEarlyBecauseEnoughPv, true);
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
});

test('markPrijsvrijLivePriceUnavailable: no proven PV price', () => {
  const marked = markPrijsvrijLivePriceUnavailable([
    makeOffer({ id: 'prijsvrij-1', provider: PRIJSVRIJ_PROVIDER_NAME, price: 400 }),
    makeOffer({ id: 'corendon-1', provider: 'Corendon', price: 300 }),
  ]);
  assert.equal(marked[0].livePriceStatus, 'unavailable');
  assert.equal(marked[1].livePriceSource, 'feed');
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
  assert.equal(receiptPosts, PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP);
  assert.ok((stats.maxInFlightReceiptCalls ?? 0) <= PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY);
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
