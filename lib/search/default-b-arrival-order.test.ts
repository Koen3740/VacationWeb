/**
 * Default display = live B arrival order (NOT discovery / catalogue order).
 * Low → High = same shared pool sorted by live price.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { SearchParams, TravelOffer } from '@/types/travel';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceNowMsForTests,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import {
  orderMatchsetForUnifiedLiveDiscovery,
} from '@/lib/search/schedule-capped-matchset-live-after-page';
import {
  selectSharedLivePricingPool,
  sliceRankedCatalogResultsPage,
} from '@/lib/search/results-catalog-page';
import {
  createPage1SettleController,
  page1UrlIdsForSettle,
  settlePageSelection,
  type PageSettleLiveOverlay,
} from '@/lib/search/page-settle';
import {
  rankLivePricedCandidatePool,
  slicePriceSortPoolPage,
} from '@/lib/search/prepare-results-offers';

afterEach(() => {
  clearResultsLivePriceCache();
  setResultsLivePriceNowMsForTests(null);
});

const defaultParams: SearchParams = { adults: 2, sort: 'value' };
const priceParams: SearchParams = { adults: 2, sort: 'price' };

function offer(id: string, price: number, provider = 'Sunweb'): TravelOffer {
  return {
    id,
    provider,
    hotelName: id,
    destinationCountry: 'Spanje',
    nights: 8,
    price,
    pricePerDay: Math.round(price / 8),
    imageUrl: 'https://example.com/x.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    departureDate: '10/10/2026',
    deepLink: `https://example.com/${id}`,
  };
}

function liveB(o: TravelOffer, live: number): TravelOffer {
  const isCorendon = o.provider === 'Corendon';
  return {
    ...o,
    price: live,
    pricePerDay: Math.round(live / 8),
    livePriceStatus: 'proven',
    livePriceSource: isCorendon ? 'upsales' : 'getPromotedPrice',
    liveTotalPrice: live * 2,
    liveTotalPriceField: isCorendon ? 'upsales.totalPrice' : 'getPromotedPrice.totalPrice',
  };
}

function seedB(o: TravelOffer, live: number, atMs: number, params: SearchParams = defaultParams) {
  setResultsLivePriceNowMsForTests(atMs);
  const priced = liveB(o, live);
  setResultsLivePriceOverlay(o.id, params, {
    price: priced.price,
    pricePerDay: priced.pricePerDay,
    livePriceStatus: 'proven',
    livePriceSource: priced.livePriceSource,
    liveTotalPrice: priced.liveTotalPrice,
    liveTotalPriceField: priced.liveTotalPriceField,
  });
}

function flush(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(() => queueMicrotask(resolve)));
}

test('TEST A — discovery ≠ Default display (arrival order)', async () => {
  const A = offer('A', 400, 'Corendon');
  const B = offer('B', 410, 'Sunweb');
  const C = offer('C', 420, 'Eliza was here');
  const D = offer('D', 430, 'Sunweb');
  const matchset = [A, B, C, D];

  const discovery = orderMatchsetForUnifiedLiveDiscovery(matchset);
  assert.deepEqual(
    discovery.map((o) => o.id),
    ['A', 'B', 'C', 'D'],
    'discovery = catalogue price ascending',
  );

  const deferred = new Map<string, { resolve: (v: TravelOffer) => void }>();
  const overlays: PageSettleLiveOverlay[] = discovery.map((o) => ({
    catalog: o,
    pending: true,
    live: new Promise<TravelOffer>((resolve) => {
      deferred.set(o.id, { resolve });
    }),
  }));

  const controller = createPage1SettleController({
    slotOffers: discovery,
    overlays,
    pageSize: 4,
    scheduleDeadline: () => () => {},
  });

  // Live B arrivals: C, A, D, B (not discovery order)
  deferred.get('C')!.resolve(liveB(C, 420));
  await flush();
  deferred.get('A')!.resolve(liveB(A, 400));
  await flush();
  deferred.get('D')!.resolve(liveB(D, 430));
  await flush();
  deferred.get('B')!.resolve(liveB(B, 410));
  await flush();

  const selection = await controller.selection;
  assert.deepEqual(selection.selectedIds, ['C', 'A', 'D', 'B']);
  assert.notDeepEqual(selection.selectedIds, ['A', 'B', 'C', 'D']);
  assert.deepEqual(controller.arrivalIds(), ['C', 'A', 'D', 'B']);
});

test('TEST B — late cheap B appends; never jumps to front on Default', () => {
  const catalog = Array.from({ length: 85 }, (_, i) => offer(`b${i + 1}`, 600 + i));
  const t0 = Date.now();
  // First 83 arrive early with mid prices; #84 = €379; #85 = €299 later.
  for (let i = 0; i < 83; i += 1) {
    seedB(catalog[i]!, 500 + i, t0 + i);
  }
  seedB(catalog[83]!, 379, t0 + 10_000);
  seedB(catalog[84]!, 299, t0 + 20_000);
  setResultsLivePriceNowMsForTests(t0 + 30_000);

  const pool = selectSharedLivePricingPool(catalog, defaultParams, 150);
  const ids = pool.map((o) => o.id);
  const i84 = ids.indexOf('b84');
  const i85 = ids.indexOf('b85');
  assert.ok(i84 >= 0 && i85 >= 0);
  assert.equal(i84, 83, 'B #84 stays at arrival position 84 (0-based 83)');
  assert.equal(i85, 84, 'B #85 stays at arrival position 85');
  assert.ok(i85 > i84, '€299 does not jump ahead of €379');
});

test('TEST C — Low → High sorts the same pool by live price', () => {
  const catalog = [
    offer('x1', 500),
    offer('x2', 550),
    offer('x3', 400),
    offer('x4', 450),
  ];
  const t0 = Date.now();
  seedB(catalog[0]!, 500, t0 + 100);
  seedB(catalog[1]!, 550, t0 + 200);
  seedB(catalog[2]!, 379, t0 + 300);
  seedB(catalog[3]!, 299, t0 + 400);
  setResultsLivePriceNowMsForTests(t0 + 500);

  const defaultPool = selectSharedLivePricingPool(catalog, defaultParams, 150);
  assert.deepEqual(
    defaultPool.map((o) => o.id),
    ['x1', 'x2', 'x3', 'x4'],
    'Default = arrival order',
  );

  const priceRanked = rankLivePricedCandidatePool(catalog, priceParams);
  const pricePage = slicePriceSortPoolPage(priceRanked, 1, 10, {
    provisional: false,
    params: priceParams,
  });
  assert.deepEqual(
    pricePage.visibleOffers.map((o) => o.price),
    [299, 379, 500, 550],
  );
});

test('TEST D — provider mix follows completion/arrival, not discovery or quotas', async () => {
  const slots = [
    offer('cor-1', 300, 'Corendon'),
    offer('sun-1', 310, 'Sunweb'),
    offer('eliz-1', 320, 'Eliza was here'),
    offer('cor-2', 330, 'Corendon'),
  ];
  const deferred = new Map<string, { resolve: (v: TravelOffer) => void }>();
  const overlays: PageSettleLiveOverlay[] = slots.map((o) => ({
    catalog: o,
    pending: true,
    live: new Promise<TravelOffer>((resolve) => deferred.set(o.id, { resolve })),
  }));
  const controller = createPage1SettleController({
    slotOffers: slots,
    overlays,
    pageSize: 4,
    scheduleDeadline: () => () => {},
  });

  // Completions: Eliza, Corendon#2, Sunweb, Corendon#1
  deferred.get('eliz-1')!.resolve(liveB(slots[2]!, 320));
  await flush();
  deferred.get('cor-2')!.resolve(liveB(slots[3]!, 330));
  await flush();
  deferred.get('sun-1')!.resolve(liveB(slots[1]!, 310));
  await flush();
  deferred.get('cor-1')!.resolve(liveB(slots[0]!, 300));
  await flush();

  const selection = await controller.selection;
  assert.deepEqual(selection.selectedIds, ['eliz-1', 'cor-2', 'sun-1', 'cor-1']);
});

test('TEST E — Page-1 freeze: later B arrivals do not reorder frozen page1Ids', async () => {
  const frozen = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10'];
  const controller = createPage1SettleController({
    slotOffers: frozen.map((id) => liveB(offer(id, 400, 'Sunweb'), 400)),
    overlays: frozen.map((id) => {
      const o = liveB(offer(id, 400, 'Sunweb'), 400);
      return { catalog: o, pending: false, live: Promise.resolve(o) };
    }),
    pageSize: 10,
    scheduleDeadline: () => () => {},
  });
  const selection = await controller.selection;
  assert.equal(selection.status, 'READY');
  assert.deepEqual(selection.selectedIds, frozen);
  const url = page1UrlIdsForSettle(selection, 10);
  assert.equal(url.freeze, 'DEFINITIVE');
  assert.deepEqual(url.ids, frozen);

  // Pure settle: later arrivalOrder entry must not enter the page-1 selection.
  const r = settlePageSelection({
    slots: [
      { kind: 'immediate', offer: liveB(offer('late-cheap', 100, 'Sunweb'), 100) },
      ...frozen.map((id) => ({
        kind: 'immediate' as const,
        offer: liveB(offer(id, 400, 'Sunweb'), 400),
      })),
    ],
    deadlineReached: false,
    pageSize: 10,
    arrivalOrder: [...frozen, 'late-cheap'],
  });
  assert.deepEqual(r.selectedIds, frozen, 'late cheap B is card 11, not inserted into page 1');
});

test('arrival mode READY does not wait for earlier discovery ranks', () => {
  const slots = [
    { kind: 'pending' as const, catalogOffer: offer('pending-early', 200) },
    { kind: 'immediate' as const, offer: liveB(offer('b1', 500), 500) },
    { kind: 'immediate' as const, offer: liveB(offer('b2', 510), 510) },
  ];
  const collectingRank = settlePageSelection({
    slots,
    deadlineReached: false,
    pageSize: 2,
  });
  assert.equal(collectingRank.status, 'COLLECTING', 'legacy rank mode still waits');

  const arrivalReady = settlePageSelection({
    slots,
    deadlineReached: false,
    pageSize: 2,
    arrivalOrder: ['b1', 'b2'],
  });
  assert.equal(arrivalReady.status, 'READY');
  assert.deepEqual(arrivalReady.selectedIds, ['b1', 'b2']);
});

test('Default page slice follows arrival order for shared pool', () => {
  const catalog = [offer('a', 300), offer('b', 310), offer('c', 320)];
  const t0 = Date.now();
  seedB(catalog[0]!, 300, t0 + 300);
  seedB(catalog[1]!, 310, t0 + 100);
  seedB(catalog[2]!, 320, t0 + 200);
  setResultsLivePriceNowMsForTests(t0 + 400);
  const page = sliceRankedCatalogResultsPage(catalog, 1, 10, defaultParams);
  assert.deepEqual(
    page.offers.map((o) => o.id),
    ['b', 'c', 'a'],
    'Default page = arrival (cachedAtMs), not catalogue',
  );
});
