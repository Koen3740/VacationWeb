/**
 * LP-001: Page 2+ / Page 15 R2 hydrate — Option B page-local vs discover-prefix.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { CORENDON_PROVIDER_NAME } from '@/lib/providers/corendon/constants';
import {
  PAGE1_OVERLAY_RESERVE,
  selectCatalogPageHydrationIds,
  selectPage2PlusHydrationPlan,
} from '@/lib/search/results-catalog-page';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import type { SearchParams, TravelOffer } from '@/types/travel';

const params: SearchParams = { adults: 2, countries: ['Spanje'] };

function baseOffer(id: string, price: number): TravelOffer {
  return {
    id,
    provider: CORENDON_PROVIDER_NAME,
    hotelName: `Hotel ${id}`,
    destinationCountry: 'Spanje',
    destinationRegion: 'Costa',
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

beforeEach(() => {
  clearResultsLivePriceCache();
});

test('legacy selectCatalogPageHydrationIds grows with page (historical formula)', () => {
  const ranked = Array.from({ length: 300 }, (_, i) => baseOffer(`o${i}`, 500 + i));
  const p1 = selectCatalogPageHydrationIds(ranked, 1, 10, PAGE1_OVERLAY_RESERVE, params);
  const p15 = selectCatalogPageHydrationIds(ranked, 15, 10, PAGE1_OVERLAY_RESERVE, params);
  assert.equal(p1.length, 50);
  assert.equal(p15.length, 190);
});

test('LP-001 page-local: with 150 L1 B, page 15 hydrates far fewer than 190 ids', () => {
  const ranked = Array.from({ length: 200 }, (_, i) => baseOffer(`b${i}`, 500 + i));
  for (let i = 0; i < 150; i += 1) seedB(`b${i}`, 500 + i);
  const page1Ids = ranked.slice(0, 10).map((o) => o.id);

  const plan = selectPage2PlusHydrationPlan({
    ranked,
    page: 15,
    pageSize: 10,
    page1Ids,
    browseCap: 150,
    params,
  });

  assert.equal(plan.mode, 'page-local');
  assert.ok(
    plan.ids.length < 190,
    `expected page-local ids < 190, got ${plan.ids.length}`,
  );
  assert.equal(plan.paintedIds.length, 10);
  assert.deepEqual(plan.paintedIds, ranked.slice(140, 150).map((o) => o.id));
  for (const id of page1Ids) {
    assert.ok(plan.ids.includes(id), 'page1Ids included for freeze repair');
  }
});

test('LP-001 page-local: page 2 with warm L1 is much smaller than prefix-60', () => {
  const ranked = Array.from({ length: 80 }, (_, i) => baseOffer(`w${i}`, 500 + i));
  for (let i = 0; i < 60; i += 1) seedB(`w${i}`, 500 + i);
  const page1Ids = ranked.slice(0, 10).map((o) => o.id);
  const legacy = selectCatalogPageHydrationIds(ranked, 2, 10, PAGE1_OVERLAY_RESERVE, params);
  const plan = selectPage2PlusHydrationPlan({
    ranked,
    page: 2,
    pageSize: 10,
    page1Ids,
    browseCap: 150,
    params,
  });
  assert.equal(plan.mode, 'page-local');
  assert.ok(plan.ids.length <= legacy.length, `${plan.ids.length} <= ${legacy.length}`);
  assert.deepEqual(plan.paintedIds, ranked.slice(10, 20).map((o) => o.id));
  // Must not grow with higher pages: page-15 plan is the LP-001 win vs legacy 190.
  const plan15 = selectPage2PlusHydrationPlan({
    ranked,
    page: 15,
    pageSize: 10,
    page1Ids,
    browseCap: 150,
    params,
  });
  // Only 60 B seeded — not enough for page 15 → discover-prefix (not a 190 page-local mistake).
  assert.equal(plan15.mode, 'discover-prefix');
});

test('LP-001 discover-prefix: cold L1 falls back to capped page×size+reserve', () => {
  const ranked = Array.from({ length: 300 }, (_, i) => baseOffer(`c${i}`, 500 + i));
  // No L1 B seeded → cannot serve page 15 from L1.
  const page1Ids = ranked.slice(0, 10).map((o) => o.id);
  const plan = selectPage2PlusHydrationPlan({
    ranked,
    page: 15,
    pageSize: 10,
    page1Ids,
    browseCap: 150,
    params,
  });
  assert.equal(plan.mode, 'discover-prefix');
  const legacy = selectCatalogPageHydrationIds(ranked, 15, 10, PAGE1_OVERLAY_RESERVE, params);
  assert.ok(plan.ids.length >= legacy.length);
  assert.ok(plan.ids.length <= legacy.length + page1Ids.length);
});
