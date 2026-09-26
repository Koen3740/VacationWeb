/**
 * Shared live-pricing pool: Default and Laag → Hoog present the same ≤150 lowest
 * live in-budget B (Default in catalogue order, Laag → Hoog by live price).
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { clearLivePriceInflightForTests } from '@/lib/providers/prijsvrij/page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from '@/lib/providers/prijsvrij/receipt-auth';
import { resetLivePriceCircuitForTests } from '@/lib/providers/live-price-circuit';
import { clearLivePriceObservabilityForTests } from '@/lib/search/live-price-observability';
import {
  clearResultsLivePriceCache,
  hasResultsLivePriceOverlay,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import {
  resetLivePriceL2CircuitForTests,
  resetLivePriceL2MemoryBackendForTests,
  setLivePriceL2BackendForTests,
  setLivePriceL2EnabledForTests,
} from '@/lib/search/live-price-l2-store';
import {
  isSharedLivePricingPoolSort,
  selectPage2PlusHydrationPlan,
  selectResultsBrowsePool,
  selectSharedLivePricingPool,
  selectSharedPoolExcludedIds,
  sharedPoolPriceCeiling,
  sliceRankedCatalogResultsPage,
} from '@/lib/search/results-catalog-page';
import {
  rankCatalogOffers,
  rankLivePricedCandidatePool,
  slicePriceSortPoolPage,
} from '@/lib/search/prepare-results-offers';
import { countPresentableB } from '@/lib/search/s6-dynamic-refill';
import {
  orderMatchsetCheapestFirst,
  scheduleCappedMatchsetLiveAfterPage,
} from '@/lib/search/schedule-capped-matchset-live-after-page';
import { awaitPendingResultsMatchsetLivePricingForTests } from '@/lib/search/schedule-results-matchset-live-pricing';

afterEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
  clearPrijsvrijReceiptTokenCache();
  clearLivePriceObservabilityForTests();
  resetLivePriceCircuitForTests();
  setLivePriceL2EnabledForTests(null);
  setLivePriceL2BackendForTests(null);
  resetLivePriceL2CircuitForTests();
});

const defaultParams: SearchParams = { adults: 2 };
const priceParams: SearchParams = { adults: 2, sort: 'price' };

function makePv(n: number, price: number): TravelOffer {
  return {
    id: `prijsvrij-${n}-2026-08-20-8-900-LG`,
    provider: 'Prijsvrij',
    hotelName: `PV ${n}`,
    destinationCountry: 'Portugal',
    destinationRegion: 'Algarve',
    departureDate: '2026-08-20',
    nights: 8,
    flightIncluded: 'true',
    price,
    pricePerDay: Math.round(price / 8),
    boardType: 'Logies',
    imageUrl: 'https://example.com/a.jpg',
    deepLink:
      'https://www.prijsvrij.be/vakantie/?r=https%3A%2F%2Fwww.prijsvrij.be%2Fvakanties%2Fportugal%3Fvertrekdatum%3D2026-08-20%26reisduurdagen%3D8%26transport%3Dvl',
  };
}

/** Non-parked Results provider (Prijsvrij is parked for cards). */
function makeEliza(n: number, price: number): TravelOffer {
  return {
    id: `eliza-${n}`,
    provider: 'Eliza was here',
    hotelName: `Eliza ${n}`,
    destinationCountry: 'Spanje',
    departureDate: '2026-08-20',
    departureAirport: 'BRU',
    nights: 8,
    flightIncluded: 'true',
    price,
    pricePerDay: Math.round(price / 8),
    boardType: 'All Inclusive',
    imageUrl: 'https://example.com/a.jpg',
    deepLink: `https://www.elizawashere.nl/reis/${n}`,
  };
}

/** Proven live B overlay (card-presentable for Eliza / Sunweb). */
function seedB(offer: TravelOffer, livePrice: number, params: SearchParams = defaultParams): void {
  setResultsLivePriceOverlay(offer.id, params, {
    price: livePrice,
    pricePerDay: Math.round(livePrice / 8),
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: livePrice * 2,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
}

/** Proven Prijsvrij receipt overlay (parked — never card-countable for S6). */
function seedReceipt(offer: TravelOffer, livePrice: number, params: SearchParams = defaultParams): void {
  setResultsLivePriceOverlay(offer.id, params, {
    price: livePrice,
    pricePerDay: Math.round(livePrice / 8),
    livePriceStatus: 'proven',
    livePriceSource: 'receipt',
    liveTotalPrice: livePrice * 2,
    liveTotalPriceField: 'receipt.TotalInclLocal',
  });
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

function makeReceiptFetch(counter: { posts: number; hotelIds: string[] }) {
  return async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 'r'.repeat(40) }), { status: 200 });
    }
    const hotelId = /\/(\d+)\/receipt\//.exec(url)?.[1] ?? '';
    counter.posts += 1;
    counter.hotelIds.push(hotelId);
    return new Response(okReceiptBody(400 + Number(hotelId || '0') % 100), { status: 200 });
  };
}

/**
 * 200 B; catalogue order is NOT live-price order (live price descends with catalogue
 * index), so "first 150 in catalogue order" and "150 cheapest" differ.
 */
function seed200B(): TravelOffer[] {
  const catalog = Array.from({ length: 200 }, (_, i) => makeEliza(10_000 + i, 100 + (i % 7)));
  catalog.forEach((offer, i) => seedB(offer, 1000 - i));
  return catalog;
}

test('Default and Laag → Hoog share the same live B pool', () => {
  const catalog = seed200B();
  const defaultPool = selectResultsBrowsePool(catalog, defaultParams, 150);
  const priceRanked = rankLivePricedCandidatePool(rankCatalogOffers(catalog, priceParams), priceParams);
  const pricePage = slicePriceSortPoolPage(priceRanked, 1, 150, {
    provisional: false,
    params: priceParams,
  });

  assert.equal(defaultPool.length, 150);
  assert.equal(pricePage.paginationTotal, 150);
  assert.deepEqual(
    new Set(defaultPool.map((offer) => offer.id)),
    new Set(pricePage.visibleOffers.map((offer) => offer.id)),
  );
  // The pool is the 150 lowest live prices (catalogue items 50..199), not the first 150.
  const expected = new Set(catalog.slice(50).map((offer) => offer.id));
  assert.deepEqual(new Set(defaultPool.map((offer) => offer.id)), expected);
});

test('Default presents the shared pool in catalogue order', () => {
  const catalog = seed200B();
  const page = sliceRankedCatalogResultsPage(catalog, 1, 150, defaultParams);
  const catalogIndex = new Map(catalog.map((offer, i) => [offer.id, i]));
  const indices = page.offers.map((offer) => catalogIndex.get(offer.id)!);
  assert.deepEqual(indices, [...indices].sort((a, b) => a - b));
  assert.equal(page.offers[0]?.id, catalog[50]?.id);
  assert.equal(page.paginationTotal, 150);
});

test('Laag → Hoog sorts the same pool by live price', () => {
  const catalog = seed200B();
  const priceRanked = rankLivePricedCandidatePool(rankCatalogOffers(catalog, priceParams), priceParams);
  const page = slicePriceSortPoolPage(priceRanked, 1, 150, { provisional: false, params: priceParams });
  const prices = page.visibleOffers.map((offer) => offer.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  assert.equal(prices[0], 1000 - 199);
  assert.equal(prices[149], 1000 - 50);
});

test('a later cheaper B enters the pool and replaces the most expensive member', () => {
  const catalog = seed200B();
  const before = selectSharedLivePricingPool(catalog, defaultParams, 150);
  const mostExpensive = before.reduce((max, offer) => (offer.price > max.price ? offer : max));
  assert.equal(mostExpensive.id, catalog[50]?.id);

  // Catalogue item 0 (outside pool at live 1000) is re-priced far cheaper later.
  seedB(catalog[0]!, 50);
  const after = selectSharedLivePricingPool(catalog, defaultParams, 150);
  const afterIds = new Set(after.map((offer) => offer.id));
  assert.equal(after.length, 150);
  assert.ok(afterIds.has(catalog[0]!.id), 'cheaper late B joins the pool');
  assert.ok(!afterIds.has(mostExpensive.id), 'most expensive member leaves the pool');
  // Default: the newcomer is first in catalogue order.
  assert.equal(sliceRankedCatalogResultsPage(catalog, 1, 10, defaultParams).offers[0]?.id, catalog[0]!.id);
});

test('frozen page-1 ids stay pinned in the pool even when cheaper B exist', () => {
  const catalog = seed200B();
  const frozen = catalog.slice(0, 10).map((offer) => offer.id);
  const pool = selectSharedLivePricingPool(catalog, defaultParams, 150, frozen);
  const ids = pool.map((offer) => offer.id);
  assert.equal(pool.length, 150);
  assert.deepEqual(ids.slice(0, 10), frozen);
  // Remaining 140 are the cheapest non-pinned B.
  assert.deepEqual(new Set(ids.slice(10)), new Set(catalog.slice(60).map((offer) => offer.id)));

  const plan = selectPage2PlusHydrationPlan({
    ranked: catalog,
    page: 2,
    pageSize: 10,
    page1Ids: frozen,
    browseCap: 150,
    params: defaultParams,
  });
  assert.equal(plan.mode, 'page-local');
  assert.deepEqual(plan.paintedIds, catalog.slice(60, 70).map((offer) => offer.id));
});

test('live budget stays a hard filter on the shared pool', () => {
  const budget: SearchParams = { adults: 2, budgetMax: 500 };
  const catalog = Array.from({ length: 6 }, (_, i) => makeEliza(20_000 + i, 300));
  // Catalogue price in budget; live prices 450, 480, 520 (out), 400, 600 (out), 490.
  [450, 480, 520, 400, 600, 490].forEach((live, i) => seedB(catalog[i]!, live, budget));
  const pool = selectSharedLivePricingPool(catalog, budget, 150);
  assert.deepEqual(
    pool.map((offer) => offer.price),
    [450, 480, 400, 490],
  );
  assert.ok(pool.every((offer) => offer.price <= 500));
  const pricePage = slicePriceSortPoolPage(
    rankLivePricedCandidatePool(catalog, { ...budget, sort: 'price' }),
    1,
    10,
    { provisional: false, params: { ...budget, sort: 'price' } },
  );
  assert.deepEqual(pricePage.visibleOffers.map((offer) => offer.price), [400, 450, 480, 490]);
});

test('S6 counts only presentable in-budget B', () => {
  const budget: SearchParams = { adults: 2, budgetMin: 200, budgetMax: 500 };
  const catalog = Array.from({ length: 5 }, (_, i) => makeEliza(30_000 + i, 300));
  seedB(catalog[0]!, 300, budget);
  seedB(catalog[1]!, 150, budget); // below budgetMin
  seedB(catalog[2]!, 700, budget); // above budgetMax
  seedB(catalog[3]!, 499, budget);
  // catalog[4] unpriced (not B)
  assert.equal(countPresentableB(catalog, budget), 2);
  assert.equal(countPresentableB(catalog, { adults: 2 }), 4);
});

test('S6 does not count parked Prijsvrij toward the 150 B target', () => {
  const catalog = Array.from({ length: 20 }, (_, i) => makePv(70_000 + i, 100 + i));
  catalog.forEach((offer) => seedReceipt(offer, 400));
  assert.equal(countPresentableB(catalog, defaultParams), 0);
  const withEliza = [...catalog, makeEliza(70_100, 200)];
  seedB(withEliza[withEliza.length - 1]!, 200);
  assert.equal(countPresentableB(withEliza, defaultParams), 1);
});

test('pool ceiling and exclusions only apply once the shared pool is full', () => {
  const catalog = seed200B();
  const pool = selectSharedLivePricingPool(catalog, defaultParams, 150);
  assert.equal(sharedPoolPriceCeiling(pool, defaultParams, 150), 1000 - 50);
  const excluded = selectSharedPoolExcludedIds(catalog, defaultParams, pool);
  assert.deepEqual(excluded, new Set(catalog.slice(0, 50).map((offer) => offer.id)));

  const small = catalog.slice(0, 20);
  const smallPool = selectSharedLivePricingPool(small, defaultParams, 150);
  assert.equal(sharedPoolPriceCeiling(smallPool, defaultParams, 150), Number.POSITIVE_INFINITY);
  assert.equal(selectSharedPoolExcludedIds(small, defaultParams, smallPool).size, 0);
});

test('other sorts keep their own first-150 browse pool', () => {
  const catalog = seed200B();
  const stars: SearchParams = { adults: 2, sort: 'stars' };
  assert.equal(isSharedLivePricingPoolSort('stars'), false);
  assert.equal(isSharedLivePricingPoolSort(undefined), true);
  assert.equal(isSharedLivePricingPoolSort('value'), true);
  assert.equal(isSharedLivePricingPoolSort('price'), true);
  const pool = selectResultsBrowsePool(catalog, stars, 150);
  assert.deepEqual(pool.map((offer) => offer.id), catalog.slice(0, 150).map((offer) => offer.id));
});

test('cheap-first order: ascending catalogue price, stable, same objects', () => {
  const a = makePv(1, 300);
  const b = makePv(2, 100);
  const c = makePv(3, 200);
  const d = makePv(4, 100);
  const ordered = orderMatchsetCheapestFirst([a, b, c, d]);
  assert.deepEqual(ordered, [b, d, c, a]);
  assert.strictEqual(ordered[0], b);
});

test('default background pricing walks the matchset cheap-first via S6', async () => {
  const catalog = [makePv(40_003, 900), makePv(40_001, 100), makePv(40_002, 500)];
  const http = { posts: 0, hotelIds: [] as string[] };
  scheduleCappedMatchsetLiveAfterPage(catalog, defaultParams, {
    fetchImpl: makeReceiptFetch(http),
    headstartMs: 0,
    cheapestFirst: true,
  });
  await awaitPendingResultsMatchsetLivePricingForTests();
  assert.equal(http.posts, 3);
  assert.equal(http.hotelIds[0], '40001');
  for (const offer of catalog) {
    assert.ok(hasResultsLivePriceOverlay(offer.id, defaultParams));
  }
});

test('no duplicate provider pricing when prices are already in L1 (sort-independent key)', async () => {
  const catalog = Array.from({ length: 12 }, (_, i) => makePv(50_000 + i, 100 + i));
  // Priced under Laag → Hoog; Default reuses the same L1 entries.
  catalog.forEach((offer) => seedReceipt(offer, 400, priceParams));
  // Parked Prijsvrij overlays skip HTTP but never count as card B.
  assert.equal(countPresentableB(catalog, defaultParams), 0);
  const http = { posts: 0, hotelIds: [] as string[] };
  scheduleCappedMatchsetLiveAfterPage(catalog, defaultParams, {
    fetchImpl: makeReceiptFetch(http),
    headstartMs: 0,
    cheapestFirst: true,
  });
  await awaitPendingResultsMatchsetLivePricingForTests();
  assert.equal(http.posts, 0);
});

test('no duplicate provider pricing when prices are only in L2', async () => {
  resetLivePriceL2MemoryBackendForTests();
  setLivePriceL2EnabledForTests(true);
  const catalog = Array.from({ length: 4 }, (_, i) => makePv(60_000 + i, 100 + i));
  catalog.forEach((offer) => seedReceipt(offer, 400));
  await new Promise((resolve) => setTimeout(resolve, 30));
  clearResultsLivePriceCache();
  assert.equal(hasResultsLivePriceOverlay(catalog[0]!.id, defaultParams), false);

  const http = { posts: 0, hotelIds: [] as string[] };
  scheduleCappedMatchsetLiveAfterPage(catalog, defaultParams, {
    fetchImpl: makeReceiptFetch(http),
    headstartMs: 0,
    cheapestFirst: true,
  });
  await awaitPendingResultsMatchsetLivePricingForTests();
  assert.equal(http.posts, 0);
  for (const offer of catalog) {
    assert.ok(hasResultsLivePriceOverlay(offer.id, defaultParams));
  }
});
