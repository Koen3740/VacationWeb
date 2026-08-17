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
  livePriceCacheKey,
  setResultsLivePriceNowMsForTests,
  setResultsLivePriceOverlay,
} from './results-live-price-cache';
import { hasValidPresentablePrice } from './presentable-price';
import { limitRankedResultsForPagination, RESULTS_USER_PAGINATION_CAP } from './pagination';
import {
  isPriceDependentSort,
  prepareResultsOffers,
  rankCatalogOffers,
  slicePriceSortPoolPage,
} from './prepare-results-offers';

const ROOT = join(__dirname, '../..');

async function prepareRanked(
  ...args: Parameters<typeof prepareResultsOffers>
) {
  return (await prepareResultsOffers(...args)).offers;
}

async function prepareExactRanked(
  ...args: Parameters<typeof prepareResultsOffers>
) {
  const prepared = await prepareResultsOffers(...args);
  return prepared.exactOffers;
}

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
    failHotelIds?: Set<string>;
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
    if (options.failHotelIds?.has(hotelId)) {
      counter.posts += 1;
      counter.urls.push(url);
      return new Response(JSON.stringify({}), { status: 200 });
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

function makeEliza(overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id'>): TravelOffer {
  return {
    provider: 'Eliza was here',
    hotelName: 'Eliza Hotel',
    destinationCountry: 'Portugal',
    departureDate: '2026-08-20',
    nights: 8,
    price: 250,
    pricePerDay: 31,
    boardType: 'Logies',
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.elizawashere.nl/offer',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    ...overrides,
  };
}

/** 859 Prijsvrij + 58 Sunweb + 4 Eliza = 921. */
function build921(): TravelOffer[] {
  const pv = Array.from({ length: 859 }, (_, index) =>
    makePv({
      id: `prijsvrij-${5000 + index}-2026-08-20-8-900-LG`,
      price: 4000 + index,
      pricePerDay: 500,
    }),
  );
  const sun = Array.from({ length: 58 }, (_, index) =>
    makeSunweb({
      id: `sunweb-921-${index}`,
      boardType: 'Logies',
      price: 300 + index,
    }),
  );
  const eliza = Array.from({ length: 4 }, (_, index) =>
    makeEliza({
      id: `eliza-921-${index}`,
      price: 200 + index,
    }),
  );
  return [...pv, ...sun, ...eliza];
}

function build927(): TravelOffer[] {
  return [
    ...build921(),
    ...Array.from({ length: 6 }, (_, index) =>
      makeSunweb({
        id: `sunweb-927-${index}`,
        boardType: 'Logies',
        price: 280 + index,
      }),
    ),
  ];
}

function uniqueReceiptHotelIds(urls: string[]): Set<string> {
  return new Set(urls.map(hotelIdFromUrl).filter(Boolean));
}

/**
 * 921 offers where price-asc top 150 includes 40 cheap AI Prijsvrij,
 * and All Inclusive has 150 PV of which 110 were outside that first pool.
 */
function build921PriceThenAllInclusive(): TravelOffer[] {
  const cheapAi = Array.from({ length: 40 }, (_, index) =>
    makePv({
      id: `prijsvrij-${41000 + index}-2026-08-20-8-900-AI`,
      boardType: 'All Inclusive',
      price: 250 + index,
      pricePerDay: 31,
    }),
  );
  const expensiveAi = Array.from({ length: 110 }, (_, index) =>
    makePv({
      id: `prijsvrij-${42000 + index}-2026-08-20-8-900-AI`,
      boardType: 'All Inclusive',
      price: 8000 + index,
      pricePerDay: 1000,
    }),
  );
  const sun = Array.from({ length: 58 }, (_, index) =>
    makeSunweb({
      id: `sunweb-ai-split-${index}`,
      boardType: 'Logies',
      price: 300 + index,
    }),
  );
  const eliza = Array.from({ length: 4 }, (_, index) =>
    makeEliza({
      id: `eliza-ai-split-${index}`,
      price: 200 + index,
    }),
  );
  const logiesPv = Array.from({ length: 709 }, (_, index) =>
    makePv({
      id: `prijsvrij-${43000 + index}-2026-08-20-8-900-LG`,
      boardType: 'Logies',
      price: 4000 + index,
      pricePerDay: 500,
    }),
  );
  return [...cheapAi, ...expensiveAi, ...sun, ...eliza, ...logiesPv];
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
  const ranked = await prepareRanked(catalog, { adults: 2, sort: 'value' }, {
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

test('B-D. price sorts return catalog ranking immediately; exact ranking waits for live prices', async () => {
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

    let exactDone = false;
    const prepared = await prepareResultsOffers(catalog, { adults: 2, sort }, {
      fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }, { gate: () => holder.wait() }),
    });
    assert.equal(prepared.priceSortPending, true, `${sort} must not block on gated Receipts`);
    assert.ok(prepared.offers.length > 0);
    const catalogPool = limitRankedResultsForPagination(
      rankCatalogOffers(catalog, { adults: 2, sort }),
    );
    assert.equal(prepared.offers[0].id, catalogPool[0].id);
    const exactPending = prepared.exactOffers.then((ranked) => {
      exactDone = true;
      return ranked;
    });
    await delay(40);
    assert.equal(exactDone, false, `${sort} exact ranking must wait while Receipts are gated`);

    holder.release();
    const ranked = await exactPending;
    assert.equal(exactDone, true);

    const pv = requiredPv(ranked);
    for (const offer of pv) {
      assert.ok(hasResultsLivePriceOverlay(offer.id, { adults: 2 }), offer.id);
    }
    if (sort === 'price') {
      const presentable = ranked.filter(hasValidPresentablePrice);
      for (let i = 1; i < presentable.length; i += 1) {
        assert.ok(presentable[i - 1].price <= presentable[i].price);
      }
      assert.ok(pv.filter(hasValidPresentablePrice).every((offer) => offer.price < 4000), 'price sort must use live overlay, not catalog 4000+');
    }
    if (sort === 'price-desc') {
      const presentable = ranked.filter(hasValidPresentablePrice);
      for (let i = 1; i < presentable.length; i += 1) {
        assert.ok(presentable[i - 1].price >= presentable[i].price);
      }
    }
    if (sort === 'price-per-day') {
      const presentable = ranked.filter(hasValidPresentablePrice);
      for (let i = 1; i < presentable.length; i += 1) {
        assert.ok(presentable[i - 1].pricePerDay <= presentable[i].pricePerDay);
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
  const ranked = await prepareRanked(
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
  const ranked = await prepareExactRanked(
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
  const prepared = await prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch(http),
  });
  assert.equal(prepared.priceSortPending, false);
  const ranked = await prepared.exactOffers;
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
  await Promise.all([
    background.then((prepared) => prepared.exactOffers),
    priceSort.then((prepared) => prepared.exactOffers),
  ]);
  assert.equal(http.posts, 1);
});

test('I. missing required offers are started by the matchset mechanism and awaited', async () => {
  const catalog = [
    makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG', price: 5000 }),
    makeSunweb({ id: 'sun-1', boardType: 'Logies', price: 350 }),
  ];
  const http = { posts: 0, urls: [] as string[] };
  const ranked = await prepareExactRanked(catalog, { adults: 2, sort: 'price' }, {
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
  await prepareExactRanked(
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
  const ranked = await prepareRanked(offers, { adults: 2, sort: 'value' }, {
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
  assert.ok(page.includes('PriceSortResultsStream'));
  assert.ok(page.includes('isPriceDependentSort'));
  assert.ok(!/await\s+priceLiveRequiredMatchset/.test(page));
  assert.ok(!/await\s+priceLiveRequiredMatchset/.test(pricing));
  assert.ok(prepare.includes('isPriceDependentSort'));
  assert.ok(prepare.includes('rankCatalogOffers'));
  assert.ok(prepare.includes('limitRankedResultsForPagination'));
  assert.ok(prepare.includes('priceLiveRequiredMatchset(pool'));
  assert.ok(!prepare.includes('await priceLiveRequiredMatchset(pool'));
  assert.ok(prepare.includes('rankLivePricedCandidatePool'));
  assert.ok(!prepare.includes('await priceLiveRequiredMatchset(required'));
  assert.ok(!prepare.includes('await priceLiveRequiredMatchset(ranked'));
  const stream = readFileSync(join(ROOT, 'components/results/price-sort-live-stream.tsx'), 'utf8');
  assert.ok(stream.includes('Een momentje — we controleren de actuele prijzen.'));
  assert.ok(stream.includes('De volgorde kan nog wijzigen.'));
  assert.ok(stream.includes('Suspense'));
});

test('P. page-1 and matchset overlap still does not duplicate Receipt HTTP', async () => {
  const offer = makePv({ id: 'prijsvrij-356519-2026-08-20-8-900-LG' });
  const sun = makeSunweb({ id: 'sun-1', boardType: 'Logies' });
  const http = { posts: 0, urls: [] as string[] };
  const fetchImpl = makeReceiptFetch(http);
  const ranked = await prepareRanked([offer, sun], { adults: 2, sort: 'value' }, { fetchImpl });
  const stream = startPage1ReceiptStream(ranked, { adults: 2 }, { fetchImpl });
  await stream.presented;
  await delay(20);
  assert.equal(http.posts, 1);
});

test('A. 921 matches: price sort live-prices the 150 pool, not all 859 Prijsvrij', async () => {
  const catalog = build921();
  assert.equal(catalog.length, 921);
  assert.equal(requiredPv(catalog).length, 859);
  const catalogPool = limitRankedResultsForPagination(
    rankCatalogOffers(catalog, { adults: 2, sort: 'price' }),
  );
  const http = { posts: 0, urls: [] as string[] };
  const prepared = await prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch(http),
  });
  assert.equal(prepared.priceSortPending, true);
  assert.equal(prepared.offers.length, 921);
  const ranked = await prepared.exactOffers;
  assert.equal(ranked.length, 921);
  assert.equal(catalogPool.length, RESULTS_USER_PAGINATION_CAP);
  const receiptHotels = uniqueReceiptHotelIds(http.urls);
  assert.ok(receiptHotels.size <= RESULTS_USER_PAGINATION_CAP);
  assert.ok(receiptHotels.size < 859, 'must not Receipt all 859 Prijsvrij');
  assert.equal(receiptHotels.size, requiredPv(catalogPool).length);
  const livePool = ranked.slice(0, RESULTS_USER_PAGINATION_CAP);
  for (const offer of requiredPv(livePool)) {
    assert.ok(hasResultsLivePriceOverlay(offer.id, { adults: 2 }), offer.id);
  }
  const unpricedTailPv = requiredPv(ranked.slice(RESULTS_USER_PAGINATION_CAP));
  assert.ok(unpricedTailPv.length > 0);
  assert.ok(unpricedTailPv.some((offer) => !hasResultsLivePriceOverlay(offer.id, { adults: 2 })));
});

test('B. 1486 matches: price-sort live-pricing input <= 150', async () => {
  const catalog = [
    ...build921(),
    ...Array.from({ length: 565 }, (_, index) =>
      makePv({
        id: `prijsvrij-${8000 + index}-2026-08-20-8-900-LG`,
        price: 5000 + index,
      }),
    ),
  ];
  assert.equal(catalog.length, 1486);
  const http = { posts: 0, urls: [] as string[] };
  const prepared = await prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch(http),
  });
  assert.equal(prepared.offers.length, 1486);
  const ranked = await prepared.exactOffers;
  assert.equal(ranked.length, 1486);
  assert.ok(uniqueReceiptHotelIds(http.urls).size <= RESULTS_USER_PAGINATION_CAP);
});

test('C/J. 3000 matches: live-pricing pool <= 150; full result architecture retained', async () => {
  const catalog = Array.from({ length: 3000 }, (_, index) =>
    makePv({
      id: `prijsvrij-${20000 + index}-2026-08-20-8-900-LG`,
      price: 1000 + index,
    }),
  );
  const http = { posts: 0, urls: [] as string[] };
  const prepared = await prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch(http),
  });
  assert.equal(prepared.offers.length, 3000, '150 is not a total-results cap');
  const ranked = await prepared.exactOffers;
  assert.equal(ranked.length, 3000, '150 is not a total-results cap');
  assert.equal(uniqueReceiptHotelIds(http.urls).size, RESULTS_USER_PAGINATION_CAP);
  assert.equal(limitRankedResultsForPagination(ranked).length, RESULTS_USER_PAGINATION_CAP);
});

test('D. 80 live-pricing candidates are not padded to 150', async () => {
  const catalog = Array.from({ length: 80 }, (_, index) =>
    makePv({
      id: `prijsvrij-${35000 + index}-2026-08-20-8-900-LG`,
      price: 800 + index,
    }),
  );
  const http = { posts: 0, urls: [] as string[] };
  const prepared = await prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch(http),
  });
  assert.equal(prepared.offers.length, 80);
  const ranked = await prepared.exactOffers;
  assert.equal(ranked.length, 80);
  assert.equal(uniqueReceiptHotelIds(http.urls).size, 80);
});

test('E. cached members of the 150 pool skip HTTP', async () => {
  const catalog = Array.from({ length: 200 }, (_, index) =>
    makePv({
      id: `prijsvrij-${36000 + index}-2026-08-20-8-900-LG`,
      price: 800 + index,
    }),
  );
  const pool = limitRankedResultsForPagination(rankCatalogOffers(catalog, { adults: 2, sort: 'price' }));
  for (const offer of pool.slice(0, 40)) {
    setResultsLivePriceOverlay(offer.id, { adults: 2 }, {
      price: 100,
      pricePerDay: 12,
      livePriceStatus: 'proven',
      livePriceSource: 'receipt',
    });
  }
  const http = { posts: 0, urls: [] as string[] };
  await prepareExactRanked(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch(http),
  });
  assert.equal(uniqueReceiptHotelIds(http.urls).size, 110);
});

test('F. price / price-desc / price-per-day re-rank the 150 pool with live overlays', async () => {
  const catalog = build921();
  for (const sort of ['price', 'price-desc', 'price-per-day'] as const) {
    clearResultsLivePriceCache();
    clearLivePriceInflightForTests();
    clearPrijsvrijReceiptTokenCache();
    const http = { posts: 0, urls: [] as string[] };
    const ranked = await prepareExactRanked(catalog, { adults: 2, sort }, {
      fetchImpl: makeReceiptFetch(http),
    });
    const pool = ranked.slice(0, RESULTS_USER_PAGINATION_CAP);
    const presentable = pool.filter(hasValidPresentablePrice);
    assert.ok(uniqueReceiptHotelIds(http.urls).size <= RESULTS_USER_PAGINATION_CAP);
    if (sort === 'price') {
      for (let i = 1; i < presentable.length; i += 1) {
        assert.ok(presentable[i - 1].price <= presentable[i].price);
      }
    }
    if (sort === 'price-desc') {
      for (let i = 1; i < presentable.length; i += 1) {
        assert.ok(presentable[i - 1].price >= presentable[i].price);
      }
    }
    if (sort === 'price-per-day') {
      for (let i = 1; i < presentable.length; i += 1) {
        assert.ok(presentable[i - 1].pricePerDay <= presentable[i].pricePerDay);
      }
    }
  }
});

test('G. Recommended does not await the 150 pool or the full matchset', async () => {
  const catalog = build921();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = Date.now();
  const ranked = await prepareRanked(catalog, { adults: 2, sort: 'value' }, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }, { gate }),
  });
  const elapsed = Date.now() - started;
  assert.ok(elapsed < 80, `Recommended must not wait for Receipts, got ${elapsed}ms`);
  assert.equal(ranked.length, 921);
  release();
});

test('B. All Inclusive after price sort rebuilds the 150 pool from the new catalog filter', async () => {
  const catalog = build921PriceThenAllInclusive();
  assert.equal(catalog.length, 921);
  const priceParams = { adults: 2, sort: 'price' as const };
  const aiParams = { adults: 2, sort: 'price' as const, boardTypes: ['All Inclusive'] };
  const previousPool = limitRankedResultsForPagination(rankCatalogOffers(catalog, priceParams));
  const expectedAiPool = limitRankedResultsForPagination(rankCatalogOffers(catalog, aiParams));
  assert.equal(expectedAiPool.length, RESULTS_USER_PAGINATION_CAP);
  assert.ok(expectedAiPool.every((offer) => offer.boardType === 'All Inclusive'));
  assert.ok(previousPool.some((offer) => offer.boardType !== 'All Inclusive'));

  await prepareExactRanked(catalog, priceParams, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }),
  });
  const previousIds = new Set(previousPool.map((offer) => offer.id));
  const http = { posts: 0, urls: [] as string[] };
  const ranked = await prepareExactRanked(catalog, aiParams, {
    fetchImpl: makeReceiptFetch(http),
  });
  const aiPresentable = ranked.filter((offer) => offer.boardType === 'All Inclusive').slice(0, RESULTS_USER_PAGINATION_CAP);
  assert.equal(ranked.filter((offer) => offer.boardType === 'All Inclusive').length, 150);
  const newPoolIds = new Set(expectedAiPool.map((offer) => offer.id));
  assert.ok([...newPoolIds].some((id) => !previousIds.has(id)), 'new pool is not the previous 150');
  const overlap = expectedAiPool.filter((offer) => previousIds.has(offer.id));
  const missing = expectedAiPool.filter((offer) => offer.provider === 'Prijsvrij' && !previousIds.has(offer.id));
  assert.equal(overlap.length, 40);
  assert.equal(missing.length, 110);
  assert.equal(uniqueReceiptHotelIds(http.urls).size, 110);
  for (const offer of missing) {
    assert.ok(hasResultsLivePriceOverlay(offer.id, { adults: 2 }), offer.id);
  }
  assert.ok(aiPresentable.every((offer) => offer.boardType === 'All Inclusive'));
});

test('C/D. cached overlap in the new 150 skips HTTP; new candidates are fetched', async () => {
  const catalog = build921PriceThenAllInclusive();
  const priceParams = { adults: 2, sort: 'price' as const };
  const aiParams = { adults: 2, sort: 'price' as const, boardTypes: ['All Inclusive'] };
  await prepareExactRanked(catalog, priceParams, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }),
  });
  const previousPool = limitRankedResultsForPagination(rankCatalogOffers(catalog, priceParams));
  const expectedAiPool = limitRankedResultsForPagination(rankCatalogOffers(catalog, aiParams));
  const previousIds = new Set(previousPool.map((offer) => offer.id));
  const overlapPv = expectedAiPool.filter((offer) => offer.provider === 'Prijsvrij' && previousIds.has(offer.id));
  const missingPv = expectedAiPool.filter((offer) => offer.provider === 'Prijsvrij' && !previousIds.has(offer.id));
  const http = { posts: 0, urls: [] as string[] };
  await prepareExactRanked(catalog, aiParams, { fetchImpl: makeReceiptFetch(http) });
  const fetched = uniqueReceiptHotelIds(http.urls);
  assert.equal(fetched.size, missingPv.length);
  for (const offer of overlapPv) {
    const hotelId = /^prijsvrij-(\d+)/.exec(offer.id)?.[1];
    assert.ok(hotelId && !fetched.has(hotelId), offer.id);
    assert.ok(hasResultsLivePriceOverlay(offer.id, { adults: 2 }));
  }
});

test('E. no overlap: All Inclusive pool is fully live-priced up to 150', async () => {
  const catalog = [
    ...Array.from({ length: 150 }, (_, index) =>
      makeSunweb({ id: `sun-logies-${index}`, boardType: 'Logies', price: 100 + index }),
    ),
    ...Array.from({ length: 200 }, (_, index) =>
      makePv({
        id: `prijsvrij-${45000 + index}-2026-08-20-8-900-AI`,
        boardType: 'All Inclusive',
        price: 8000 + index,
      }),
    ),
  ];
  await prepareExactRanked(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }),
  });
  const http = { posts: 0, urls: [] as string[] };
  await prepareExactRanked(
    catalog,
    { adults: 2, sort: 'price', boardTypes: ['All Inclusive'] },
    { fetchImpl: makeReceiptFetch(http) },
  );
  assert.equal(uniqueReceiptHotelIds(http.urls).size, RESULTS_USER_PAGINATION_CAP);
});

test('H. price-desc and price-per-day also use the CURRENT catalog pool', async () => {
  const catalog = build921PriceThenAllInclusive();
  for (const sort of ['price-desc', 'price-per-day'] as const) {
    clearResultsLivePriceCache();
    clearLivePriceInflightForTests();
    clearPrijsvrijReceiptTokenCache();
    const params = { adults: 2, sort, boardTypes: ['All Inclusive'] };
    const expectedPool = limitRankedResultsForPagination(rankCatalogOffers(catalog, params));
    const http = { posts: 0, urls: [] as string[] };
    await prepareExactRanked(catalog, params, { fetchImpl: makeReceiptFetch(http) });
    assert.equal(
      uniqueReceiptHotelIds(http.urls).size,
      expectedPool.filter((offer) => offer.provider === 'Prijsvrij').length,
      sort,
    );
  }
});

test('I/J. final price ranking uses live prices, not catalog fallback for unavailable PV', async () => {
  const failId = 'prijsvrij-100-2026-08-20-8-900-LG';
  const liveId = 'prijsvrij-150-2026-08-20-8-900-LG';
  const catalog = [
    makePv({ id: failId, price: 50, pricePerDay: 6 }),
    makePv({ id: liveId, price: 9000, pricePerDay: 1125 }),
    makeSunweb({ id: 'sun-ok', boardType: 'Logies', price: 400 }),
  ];
  const http = { posts: 0, urls: [] as string[] };
  const ranked = await prepareExactRanked(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch(http, { failHotelIds: new Set(['100']) }),
  });
  const liveOffer = ranked.find((offer) => offer.id === liveId);
  assert.ok(liveOffer);
  assert.equal(liveOffer.livePriceStatus, 'proven');
  assert.ok(liveOffer.price < 9000, 'ranking must use Receipt overlay, not catalog 9000');
  const failIndex = ranked.findIndex((offer) => offer.id === failId);
  const liveIndex = ranked.findIndex((offer) => offer.id === liveId);
  assert.ok(liveIndex < failIndex, 'unavailable catalog-cheap PV must not rank above proven live');
  assert.notEqual(ranked[0].id, failId);
});

test('L. occupancy remains part of the cache key', () => {
  assert.equal(
    livePriceCacheKey('prijsvrij-1', { adults: 2 }),
    '2|0|0|1|prijsvrij-1',
  );
  assert.notEqual(
    livePriceCacheKey('prijsvrij-1', { adults: 2 }),
    livePriceCacheKey('prijsvrij-1', { adults: 3 }),
  );
});

test('A. 927-result style search: full count stays 927; live pool <= 150', async () => {
  const catalog = build927();
  assert.equal(catalog.length, 927);
  const http = { posts: 0, urls: [] as string[] };
  const prepared = await prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch(http),
  });
  assert.equal(prepared.offers.length, 927);
  const ranked = await prepared.exactOffers;
  assert.equal(ranked.length, 927);
  assert.ok(uniqueReceiptHotelIds(http.urls).size <= RESULTS_USER_PAGINATION_CAP);
});

test('H. incomplete live pool is not the exact ranking', async () => {
  const catalog = build927();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const prepared = await prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }, { gate }),
  });
  assert.equal(prepared.priceSortPending, true);
  const catalogPool = limitRankedResultsForPagination(
    rankCatalogOffers(catalog, { adults: 2, sort: 'price' }),
  );
  assert.deepEqual(
    prepared.offers.slice(0, 10).map((offer) => offer.id),
    catalogPool.slice(0, 10).map((offer) => offer.id),
  );
  const page1 = slicePriceSortPoolPage(prepared.offers, 1, 10, { provisional: true });
  assert.equal(page1.visibleOffers.length, 10);
  assert.equal(page1.page1Ids.length, 10);
  const page2 = slicePriceSortPoolPage(prepared.offers, 2, 10, { provisional: true });
  assert.equal(page2.visibleOffers[0].id, catalogPool[10].id);
  assert.notEqual(page2.visibleOffers[0].id, page1.visibleOffers[0].id);
  release();
  const exact = await prepared.exactOffers;
  const exactPage1 = slicePriceSortPoolPage(exact, 1, 10, { provisional: false });
  assert.ok(exactPage1.visibleOffers.every(hasValidPresentablePrice));
});

test('M. pagination after exact ranking uses live order and keeps remaining pages', async () => {
  const catalog = Array.from({ length: 80 }, (_, index) =>
    makePv({
      id: `prijsvrij-${50000 + index}-2026-08-20-8-900-LG`,
      price: 800 + index,
    }),
  );
  const exact = await prepareExactRanked(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: makeReceiptFetch({ posts: 0, urls: [] }),
  });
  const page1 = slicePriceSortPoolPage(exact, 1, 10, { provisional: false });
  const page8 = slicePriceSortPoolPage(exact, 8, 10, { provisional: false });
  assert.equal(page1.visibleOffers.length, 10);
  assert.equal(page8.visibleOffers.length, 10);
  assert.equal(page1.paginationTotal, 80);
  const page1Ids = new Set(page1.page1Ids);
  assert.ok(page8.visibleOffers.every((offer) => !page1Ids.has(offer.id)));
});

test('O. Results page does not await exactOffers before returning the shell', () => {
  const page = readFileSync(join(ROOT, 'app/results/page.tsx'), 'utf8');
  assert.ok(!page.includes('await prepared.exactOffers'));
  assert.ok(page.includes('PriceSortResultsStream'));
  assert.ok(page.includes('priceSortPending={prepared.priceSortPending}'));
});
