/**
 * GO2: Page 2+ paint↔overlay alignment + bounded L2→L1 hydrate (catalog path).
 * Does not change Page 1 FREEZE / PriceSort semantics.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { CORENDON_PROVIDER_NAME } from '@/lib/providers/corendon/constants';
import {
  PAGE1_OVERLAY_RESERVE,
  selectCatalogPageHydrationIds,
  selectPage1OverlayCandidates,
  selectPageOverlayCandidates,
  selectPaintAlignedPageOverlayCandidates,
  sliceRankedCatalogResultsPage,
} from '@/lib/search/results-catalog-page';
import {
  clearResultsLivePriceCache,
  hasResultsLivePriceOverlay,
  hydrateResultsLivePriceOverlaysFromL2,
  livePriceCacheKey,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import {
  isLivePriceL2Enabled,
  readLivePriceL2Record,
  resetLivePriceL2MemoryBackendForTests,
  setLivePriceL2EnabledForTests,
  writeLivePriceL2Record,
} from '@/lib/search/live-price-l2-store';
import { isResultsLivePriceCandidateOffer } from '@/lib/search/presentable-price';
import type { SearchParams, TravelOffer } from '@/types/travel';

const params: SearchParams = { adults: 2, countries: ['Spanje'] };
const pageSize = 10;

function baseOffer(id: string, price: number): TravelOffer {
  return {
    id,
    provider: CORENDON_PROVIDER_NAME,
    hotelName: `Hotel ${id}`,
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    departureDate: '2026-09-10',
    nights: 8,
    flightIncluded: 'true',
    price,
    pricePerDay: Math.round(price / 8),
    currency: 'EUR',
    imageUrl: '/images/results-card-placeholder.png',
    deepLink: 'https://www.corendon.be/vakantie#x',
    livePriceStatus: 'catalog',
  };
}

function seedA(id: string): void {
  setResultsLivePriceOverlay(id, params, {
    price: 999,
    pricePerDay: 125,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'http_204',
  });
}

function seedB(id: string, price: number): void {
  setResultsLivePriceOverlay(id, params, {
    price,
    pricePerDay: Math.round(price / 8),
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    liveTotalPrice: price * 2,
    liveTotalPriceField: 'upsales.totalPrice',
  });
}

/** A×5 | P×10 | B×15 — pre-check fixture. */
function buildMismatchFixture(): TravelOffer[] {
  const filtered: TravelOffer[] = [];
  for (let i = 0; i < 5; i += 1) filtered.push(baseOffer(`A${i}`, 900 + i));
  for (let i = 0; i < 10; i += 1) filtered.push(baseOffer(`P${i}`, 800 + i));
  for (let i = 0; i < 15; i += 1) filtered.push(baseOffer(`B${i}`, 700 + i));
  for (const id of ['A0', 'A1', 'A2', 'A3', 'A4']) seedA(id);
  for (let i = 0; i < 15; i += 1) seedB(`B${i}`, 700 + i);
  return filtered;
}

beforeEach(() => {
  clearResultsLivePriceCache();
  resetLivePriceL2MemoryBackendForTests();
  setLivePriceL2EnabledForTests(true);
});

test('CASE1: Page 2 primary is B10-B14; paint-aligned overlay does not lead with Page-1 B', () => {
  const filtered = buildMismatchFixture();
  const catalogPage = sliceRankedCatalogResultsPage(filtered, 2, pageSize, params);
  assert.deepEqual(
    catalogPage.offers.map((o) => o.id),
    ['B10', 'B11', 'B12', 'B13', 'B14'],
  );

  const legacy = selectPageOverlayCandidates(filtered, 2, pageSize, PAGE1_OVERLAY_RESERVE, params);
  assert.equal(legacy[0]?.id, 'P5', 'legacy absolute offset still starts at matchset index 10');
  assert.ok(legacy.some((o) => o.id === 'B0'), 'legacy window includes Page-1 B');

  const aligned = selectPaintAlignedPageOverlayCandidates(
    filtered,
    catalogPage.offers,
    pageSize,
    PAGE1_OVERLAY_RESERVE,
    params,
  );
  assert.deepEqual(
    aligned.slice(0, catalogPage.offers.length).map((o) => o.id),
    ['B10', 'B11', 'B12', 'B13', 'B14'],
    'PRIMARY must equal painted B page',
  );
  const reserve = aligned.slice(catalogPage.offers.length);
  assert.ok(!reserve.some((o) => o.id === 'B0'), 'reserve must not lead with Page-1 B0');
  assert.ok(!reserve.some((o) => ['B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9'].includes(o.id)));
});

test('CASE2: painted page is B-only when A/C/Pending precede B in matchset', () => {
  const filtered = buildMismatchFixture();
  const page1 = sliceRankedCatalogResultsPage(filtered, 1, pageSize, params);
  const page2 = sliceRankedCatalogResultsPage(filtered, 2, pageSize, params);
  assert.ok(page1.offers.every((o) => o.id.startsWith('B')));
  assert.ok(page2.offers.every((o) => o.id.startsWith('B')));
  assert.ok(!page1.offers.some((o) => o.id.startsWith('A') || o.id.startsWith('P')));
  assert.ok(!page2.offers.some((o) => o.id.startsWith('A') || o.id.startsWith('P')));
});

test('CASE3: Cap/reserve still admits Pending from matchset after painted page (not B-only window)', () => {
  // A | B0-B14 | R0-R9 (pending after B) — reserve must pick R*
  const filtered: TravelOffer[] = [baseOffer('A0', 900)];
  seedA('A0');
  for (let i = 0; i < 15; i += 1) {
    filtered.push(baseOffer(`B${i}`, 700 + i));
    seedB(`B${i}`, 700 + i);
  }
  for (let i = 0; i < 10; i += 1) {
    filtered.push(baseOffer(`R${i}`, 600 + i));
    // leave pending (no overlay)
  }

  const catalogPage = sliceRankedCatalogResultsPage(filtered, 2, pageSize, params);
  assert.deepEqual(
    catalogPage.offers.map((o) => o.id),
    ['B10', 'B11', 'B12', 'B13', 'B14'],
  );

  const aligned = selectPaintAlignedPageOverlayCandidates(
    filtered,
    catalogPage.offers,
    pageSize,
    PAGE1_OVERLAY_RESERVE,
    params,
  );
  const reserve = aligned.slice(catalogPage.offers.length);
  assert.ok(reserve.length > 0, 'reserve must not be empty when Pending follows painted B');
  assert.ok(reserve.every((o) => o.id.startsWith('R')));
  assert.ok(reserve.every((o) => isResultsLivePriceCandidateOffer(o)));
  assert.ok(!aligned.every((o) => o.id.startsWith('B')), 'overlay window must not be B-only');
});

test('CASE4: Page 1 still uses selectPage1OverlayCandidates; page1Ids from B pool unchanged', () => {
  const filtered = buildMismatchFixture();
  const catalogPage = sliceRankedCatalogResultsPage(filtered, 1, pageSize, params);
  assert.deepEqual(catalogPage.page1Ids, [
    'B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9',
  ]);
  const page1Overlay = selectPage1OverlayCandidates(filtered, pageSize, PAGE1_OVERLAY_RESERVE, params);
  assert.equal(page1Overlay[0]?.id, 'P0');
  assert.ok(page1Overlay.some((o) => o.id.startsWith('P')));
  // paint-aligned helper is not required for page 1 path
  assert.equal(typeof selectPage1OverlayCandidates, 'function');
});

test('CASE5: PriceSort slice helper unchanged (exact membership, no paint-aligned overlay)', async () => {
  const { slicePriceSortPoolPage } = await import('@/lib/search/prepare-results-offers');
  const ranked = Array.from({ length: 40 }, (_, i) => baseOffer(`offer-${i}`, 500 + i));
  for (let i = 0; i < 40; i += 1) seedB(`offer-${i}`, 500 + i);
  const page4 = slicePriceSortPoolPage(ranked, 4, pageSize, { provisional: false, params });
  assert.equal(page4.visibleOffers.length, 10);
  assert.equal(page4.visibleOffers[0]?.id, 'offer-30');
  assert.equal(page4.visibleOffers[9]?.id, 'offer-39');
});

test('CASE6: L2 B hydrate before slice admits offer into presentable page', async () => {
  assert.equal(isLivePriceL2Enabled(), true);
  const offer = baseOffer('l2-b', 777);
  const filtered = [
    baseOffer('A0', 900),
    offer,
    ...Array.from({ length: 12 }, (_, i) => baseOffer(`P${i}`, 800 + i)),
  ];
  seedA('A0');
  // B only in L2, not L1
  const key = livePriceCacheKey('l2-b', params);
  await writeLivePriceL2Record(
    key,
    {
      price: 777,
      pricePerDay: Math.round(777 / 8),
      livePriceStatus: 'proven',
      livePriceSource: 'upsales',
      liveTotalPrice: 1554,
      liveTotalPriceField: 'upsales.totalPrice',
    },
    { ttlMs: 60_000 },
  );
  assert.equal(hasResultsLivePriceOverlay('l2-b', params), false);
  const l2 = await readLivePriceL2Record(key);
  assert.ok(l2);

  const before = sliceRankedCatalogResultsPage(filtered, 1, pageSize, params);
  assert.ok(!before.offers.some((o) => o.id === 'l2-b'), 'without hydrate, L2-only B is not painted');

  const ids = selectCatalogPageHydrationIds(filtered, 1, pageSize, PAGE1_OVERLAY_RESERVE, params);
  assert.ok(ids.includes('l2-b'));
  await hydrateResultsLivePriceOverlaysFromL2(ids, params);
  assert.equal(hasResultsLivePriceOverlay('l2-b', params), true);

  const after = sliceRankedCatalogResultsPage(filtered, 1, pageSize, params);
  assert.ok(after.offers.some((o) => o.id === 'l2-b'), 'after L2→L1 hydrate, B is presentable');
});
