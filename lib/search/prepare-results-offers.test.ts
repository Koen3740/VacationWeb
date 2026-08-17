import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import {
  PRIJSVRIJ_PAGE1_MAX_SLOTS,
  PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP,
} from '../providers/prijsvrij/constants';
import {
  PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY,
  clearLivePriceInflightForTests,
  priceLiveRequiredMatchset,
  startPage1ReceiptStream,
  type Page1ReceiptPricingStats,
} from '../providers/prijsvrij/page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from '../providers/prijsvrij/receipt-auth';
import {
  RESULTS_LIVE_PRICE_TTL_MS,
  clearResultsLivePriceCache,
  hasResultsLivePriceOverlay,
  setResultsLivePriceNowMsForTests,
  setResultsLivePriceOverlay,
} from './results-live-price-cache';
import { isPriceDependentSort, prepareResultsOffers } from './prepare-results-offers';

const ROOT = join(__dirname, '../..');

afterEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
  clearPrijsvrijReceiptTokenCache();
  setResultsLivePriceNowMsForTests(null);
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function hotelIdFromUrl(url: string): string {
  return /\/(\d+)\/receipt\//.exec(url)?.[1] ?? '';
}

function makeReceiptFetch(
  counter: { posts: number; urls: string[] },
  options: {
    gate?: Promise<void> | (() => Promise<void>);
    shouldGate?: (hotelId: string) => boolean;
  } = {},
): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 'r'.repeat(40) }), { status: 200 });
    }
    const hotelId = hotelIdFromUrl(url);
    if (options.gate && (!options.shouldGate || options.shouldGate(hotelId))) {
      await (typeof options.gate === 'function' ? options.gate() : options.gate);
    }
    counter.posts += 1;
    counter.urls.push(url);
    return new Response(okReceiptBody(200 + Number(hotelId || '0')), { status: 200 });
  };
}

/** 22 AI PV + 8 AI Sunweb + 40 Logies PV. AI filter → 30. */
function buildCatalog(): TravelOffer[] {
  const aiPv = Array.from({ length: 22 }, (_, index) =>
    makePv({
      id: `prijsvrij-${1100 + index}-2026-08-20-8-900-AI`,
      boardType: 'All Inclusive',
      price: 5000 + index,
      pricePerDay: 625,
    }),
  );
  const aiSun = Array.from({ length: 8 }, (_, index) =>
    makeSunweb({
      id: `sunweb-ai-${index}`,
      boardType: 'All Inclusive',
      price: 300 + index,
    }),
  );
  const logiesPv = Array.from({ length: 40 }, (_, index) =>
    makePv({
      id: `prijsvrij-${2100 + index}-2026-08-20-8-900-LG`,
      boardType: 'Logies',
      price: 4000 + index,
      pricePerDay: 500,
    }),
  );
  return [...aiPv, ...aiSun, ...logiesPv];
}

function requiredPv(offers: TravelOffer[]): TravelOffer[] {
  return offers.filter((offer) => offer.provider === 'Prijsvrij');
}

test('isPriceDependentSort covers only price / price-desc / price-per-day', () => {
  assert.equal(isPriceDependentSort('price'), true);
  assert.equal(isPriceDependentSort('price-desc'), true);
  assert.equal(isPriceDependentSort('price-per-day'), true);
  assert.equal(isPriceDependentSort('value'), false);
  assert.equal(isPriceDependentSort('stars'), false);
  assert.equal(isPriceDependentSort('rating'), false);
  assert.equal(isPriceDependentSort('departure'), false);
  assert.equal(isPriceDependentSort('duration'), false);
});

test('A. Recommended page resolves while full matchset pricing remains pending', async () => {
  const catalog = buildCatalog();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ranked = await prepareResultsOffers(catalog, { adults: 2, sort: 'value' }, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }, { gate }),
  });
  assert.ok(ranked.length > 0);
  const stillMissing = requiredPv(ranked).some(
    (offer) => !hasResultsLivePriceOverlay(offer.id, { adults: 2 }),
  );
  assert.equal(stillMissing, true, 'background matchset must still be incomplete');
  release();
  await priceLiveRequiredMatchset(ranked, { adults: 2 }, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }),
  });
});

test('B-D. price sorts wait for required live prices and do not mix catalog ranking', async () => {
  const catalog = buildCatalog();
  const holder: { wait: () => Promise<void>; release: () => void } = {
    wait: async () => {},
    release: () => {},
  };
  function armGate(): void {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    holder.wait = () => gate;
    holder.release = release;
  }

  for (const sort of ['price', 'price-desc', 'price-per-day'] as const) {
    clearResultsLivePriceCache();
    clearLivePriceInflightForTests();
    clearPrijsvrijReceiptTokenCache();
    armGate();
    await prepareResultsOffers(catalog, { adults: 2, sort: 'value' }, {
      fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }, { gate: () => holder.wait() }),
    });

    let done = false;
    const pending = prepareResultsOffers(catalog, { adults: 2, sort }, {
      fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }, { gate: () => holder.wait() }),
    }).then((ranked) => {
      done = true;
      return ranked;
    });
    await delay(40);
    assert.equal(done, false, `${sort} must wait while required live prices are gated`);

    holder.release();
    const ranked = await pending;
    assert.equal(done, true);

    const pv = requiredPv(ranked);
    for (const offer of pv) {
      assert.ok(hasResultsLivePriceOverlay(offer.id, { adults: 2 }), offer.id);
    }
    if (sort === 'price') {
      for (let i = 1; i < ranked.length; i += 1) {
        assert.ok(ranked[i - 1].price <= ranked[i].price);
      }
      assert.ok(pv.every((offer) => offer.price < 4000), 'price sort must use live overlay, not catalog 4000+');
    }
    if (sort === 'price-desc') {
      for (let i = 1; i < ranked.length; i += 1) {
        assert.ok(ranked[i - 1].price >= ranked[i].price);
      }
    }
    if (sort === 'price-per-day') {
      for (let i = 1; i < ranked.length; i += 1) {
        assert.ok(ranked[i - 1].pricePerDay <= ranked[i].pricePerDay);
      }
    }
  }
});

test('E. All Inclusive + Recommended does not wait for unrelated live prices', async () => {
  const catalog = buildCatalog();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await prepareResultsOffers(catalog, { adults: 2, sort: 'value' }, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }, {
      gate,
      shouldGate: (hotelId) => Number(hotelId) >= 2100,
    }),
  });

  const started = Date.now();
  const ranked = await prepareResultsOffers(
    catalog,
    { adults: 2, boardTypes: ['All Inclusive'], sort: 'value' },
    { fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }, { gate }) },
  );
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 80, `Recommended AI must not wait on gated Logies Receipts, got ${elapsed}ms`);
  assert.equal(ranked.length, 30);
  assert.ok(ranked.every((offer) => offer.boardType === 'All Inclusive'));
  release();
});

test('F/J. All Inclusive + price waits only for the 30-result coverage, not unrelated Logies', async () => {
  const catalog = buildCatalog();
  let releaseLogies!: () => void;
  const logiesGate = new Promise<void>((resolve) => {
    releaseLogies = resolve;
  });
  await prepareResultsOffers(catalog, { adults: 2, sort: 'value' }, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }, {
      gate: () => logiesGate,
      shouldGate: (hotelId) => Number(hotelId) >= 2100,
    }),
  });

  const http = { posts: 0, urls: [] as string[] };
  const ranked = await prepareResultsOffers(
    catalog,
    { adults: 2, boardTypes: ['All Inclusive'], sort: 'price' },
    { fetchImpl: makeReceiptFetch(http) },
  );
  assert.equal(ranked.length, 30);
  const aiPv = ranked.filter((offer) => offer.provider === 'Prijsvrij');
  assert.equal(aiPv.length, 22);
  for (const offer of aiPv) {
    assert.ok(hasResultsLivePriceOverlay(offer.id, { adults: 2 }));
    assert.ok(offer.price < 4000);
  }
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(ranked[i - 1].price <= ranked[i].price);
  }
  assert.ok(
    !http.urls.some((url) => Number(hotelIdFromUrl(url)) >= 2100),
    'must not Receipt unrelated Logies for the AI price sort',
  );
  const stillMissingLogies = catalog
    .filter((offer) => offer.boardType === 'Logies')
    .some((offer) => !hasResultsLivePriceOverlay(offer.id, { adults: 2 }));
  assert.equal(stillMissingLogies, true);
  releaseLogies();
});

test('G. required prices already cached: immediate and 0 Receipts', async () => {
  const catalog = buildCatalog();
  await priceLiveRequiredMatchset(catalog, { adults: 2 }, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }),
  });
  const http = { posts: 0, urls: [] as string[] };
  const ranked = await prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch(http),
  });
  assert.equal(http.posts, 0);
  assert.equal(ranked.length, catalog.length);
  for (let i = 1; i < ranked.length; i += 1) {
    assert.ok(ranked[i - 1].price <= ranked[i].price);
  }
});

test('H. in-flight required offers are joined with 0 duplicate Receipts', async () => {
  const catalog = [
    makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG', price: 900 }),
    makeSunweb({ id: 'sun-1', boardType: 'Logies', price: 350 }),
  ];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const http = { posts: 0, urls: [] as string[] };
  const fetchImpl = makeReceiptFetch(http, { gate });
  const background = prepareResultsOffers(catalog, { adults: 2, sort: 'value' }, { fetchImpl });
  await delay(20);
  const priceSort = prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, { fetchImpl });
  await delay(20);
  assert.ok(http.posts <= 1);
  release();
  await Promise.all([background, priceSort]);
  assert.equal(http.posts, 1);
});

test('I. missing required offers are started by the matchset mechanism and awaited', async () => {
  const catalog = [
    makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG', price: 5000 }),
    makeSunweb({ id: 'sun-1', boardType: 'Logies', price: 350 }),
  ];
  const http = { posts: 0, urls: [] as string[] };
  const ranked = await prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch(http),
  });
  assert.ok(http.posts >= 1);
  assert.ok(hasResultsLivePriceOverlay(catalog[0].id, { adults: 2 }));
  assert.ok(ranked[0].id === 'sun-1' || ranked[0].price < 5000);
});

test('K. 8-hour TTL remains unchanged', () => {
  assert.equal(RESULTS_LIVE_PRICE_TTL_MS, 8 * 60 * 60 * 1000);
});

test('L. cached unavailable remains fail-closed and is not HTTP-retried', async () => {
  const offer = makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG', price: 900 });
  setResultsLivePriceOverlay(offer.id, { adults: 2 }, {
    price: 900,
    pricePerDay: 112,
    livePriceStatus: 'unavailable',
    livePriceSource: undefined,
  });
  const http = { posts: 0, urls: [] as string[] };
  await prepareResultsOffers(
    [offer, makeSunweb({ id: 'sun-ok', price: 350, boardType: 'Logies' })],
    { adults: 2, sort: 'price' },
    { fetchImpl: makeReceiptFetch(http) },
  );
  assert.equal(http.posts, 0);
});

test('M/N. page-1 Package-1 max-3 and cap ≤10 remain unchanged', async () => {
  const offers = [
    ...Array.from({ length: 20 }, (_, index) =>
      makePv({ id: `prijsvrij-${2000 + index}-2026-08-20-8-900-LG`, price: 800 }),
    ),
    ...Array.from({ length: 8 }, (_, index) =>
      makeSunweb({ id: `sunweb-c-${index}`, boardType: 'Logies' }),
    ),
  ];
  const ranked = await prepareResultsOffers(offers, { adults: 2, sort: 'value' }, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }),
  });
  const stats = emptyStats();
  const presented = await startPage1ReceiptStream(ranked, { adults: 2 }, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }),
    stats,
  }).presented;
  assert.ok(
    presented.page1.filter((offer) => offer.provider === 'Prijsvrij').length <= PRIJSVRIJ_PAGE1_MAX_SLOTS,
  );
  assert.ok(stats.receiptCalls <= PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP);
});

test('O. initial page-1 path does not await the full matchset; source keeps that split', async () => {
  const page = readFileSync(join(ROOT, 'app/results/page.tsx'), 'utf8');
  const pricing = readFileSync(join(ROOT, 'lib/providers/prijsvrij/page1-receipt-pricing.ts'), 'utf8');
  const prepare = readFileSync(join(ROOT, 'lib/search/prepare-results-offers.ts'), 'utf8');
  assert.ok(page.includes('prepareResultsOffers'));
  assert.ok(!/await\s+priceLiveRequiredMatchset/.test(page));
  assert.ok(!/await\s+priceLiveRequiredMatchset/.test(pricing));
  assert.ok(prepare.includes('isPriceDependentSort'));
  assert.ok(prepare.includes('await priceLiveRequiredMatchset'));
});

test('P. page-1 and matchset overlap still does not duplicate Receipt HTTP', async () => {
  const offer = makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG' });
  const sun = makeSunweb({ id: 'sun-1', boardType: 'Logies' });
  const http = { posts: 0, urls: [] as string[] };
  const fetchImpl = makeReceiptFetch(http);
  const ranked = await prepareResultsOffers([offer, sun], { adults: 2, sort: 'value' }, { fetchImpl });
  const stream = startPage1ReceiptStream(ranked, { adults: 2 }, { fetchImpl });
  await stream.presented;
  await delay(20);
  assert.equal(http.posts, 1);
});
