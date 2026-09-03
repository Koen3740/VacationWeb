import assert from 'node:assert/strict';
import test from 'node:test';
import { filterOffers } from '@/lib/search/filtering';
import {
  prepareResultsOffers,
  rankCatalogOffers,
  rankLivePricedCandidatePool,
  slicePriceSortPoolPage,
} from '@/lib/search/prepare-results-offers';
import { rankResultsOffers } from '@/lib/search/rank-results-offers';
import { orderCatalogPageCandidates } from '@/lib/search/results-catalog-page';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import { CORENDON_PROVIDER_NAME } from '@/lib/providers/corendon/constants';
import type { SearchParams, TravelOffer } from '@/types/travel';

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'price'>,
): TravelOffer {
  return {
    provider: CORENDON_PROVIDER_NAME,
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    departureDate: '2026-10-20',
    nights: 8,
    flightIncluded: 'true',
    pricePerDay: Math.round(overrides.price / 8),
    currency: 'EUR',
    imageUrl: '/images/results-card-placeholder.png',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.201026.8.SZ-U',
    livePriceStatus: 'catalog',
    ...overrides,
  };
}

const baseParams: SearchParams = {
  adults: 2,
  countries: ['Spanje'],
};

function seedUnavailableOverlay(offerId: string): void {
  setResultsLivePriceOverlay(offerId, baseParams, {
    price: 999,
    pricePerDay: 125,
    livePriceStatus: 'unavailable',
    livePriceSource: 'lowestpricesacco',
    livePriceFailureReason: 'http_204',
  });
}

function seedProvenOverlay(offerId: string, price: number): void {
  setResultsLivePriceOverlay(offerId, baseParams, {
    price,
    pricePerDay: Math.round(price / 8),
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    liveTotalPrice: price * 2,
    liveTotalPriceField: 'upsales.totalPrice',
  });
}

test('sort modes share the same stable filter match-count', async () => {
  clearResultsLivePriceCache();
  const catalog = [
    makeOffer({ id: 'a', price: 400 }),
    makeOffer({ id: 'b', price: 500 }),
    makeOffer({ id: 'c', price: 600 }),
    makeOffer({ id: 'd', price: 700 }),
    makeOffer({ id: 'other-country', price: 300, destinationCountry: 'Turkije' }),
  ];

  const filterCount = filterOffers(catalog, baseParams).length;
  assert.equal(filterCount, 4);

  const standard = await prepareResultsOffers(catalog, { ...baseParams, sort: 'value' });
  const priceAsc = await prepareResultsOffers(catalog, { ...baseParams, sort: 'price' });
  const priceDesc = await prepareResultsOffers(catalog, { ...baseParams, sort: 'price-desc' });

  // Full ranked matchset stays sort-stable (length equal across sort modes).
  assert.equal(standard.offers.length, filterCount);
  assert.equal(priceAsc.offers.length, filterCount);
  assert.equal(priceDesc.offers.length, filterCount);
});

test('browse pool excludes settled failures so cards can render', () => {
  clearResultsLivePriceCache();
  const ranked = [
    makeOffer({ id: 'a', price: 400 }),
    makeOffer({ id: 'b', price: 500 }),
    makeOffer({ id: 'c', price: 600 }),
    makeOffer({ id: 'd', price: 700 }),
  ];
  seedProvenOverlay('a', 400);
  seedProvenOverlay('d', 700);
  seedUnavailableOverlay('b');
  seedUnavailableOverlay('c');

  const browseable = orderCatalogPageCandidates(ranked, baseParams);
  assert.equal(browseable.length, 2);
  assert.deepEqual(
    browseable.map((offer) => offer.id).sort(),
    ['a', 'd'],
  );

  const page = slicePriceSortPoolPage(ranked, 1, 10, {
    provisional: false,
    params: baseParams,
  });
  assert.equal(page.paginationTotal, 2);
  assert.equal(page.visibleOffers.length, 2);
});

test('live-price failures do not create empty card pages', () => {
  clearResultsLivePriceCache();
  const matched = [
    makeOffer({ id: 'ok', price: 400 }),
    makeOffer({ id: 'fail-a', price: 450 }),
    makeOffer({ id: 'fail-b', price: 500 }),
  ];
  seedProvenOverlay('ok', 400);
  seedUnavailableOverlay('fail-a');
  seedUnavailableOverlay('fail-b');

  const ranked = rankResultsOffers(matched, { ...baseParams, sort: 'value' });
  assert.equal(ranked.length, 3);

  const ordered = orderCatalogPageCandidates(ranked, baseParams);
  assert.equal(ordered.length, 1);
  assert.equal(ordered[0].id, 'ok');

  const page = slicePriceSortPoolPage(ranked, 1, 10, {
    provisional: false,
    params: baseParams,
  });
  assert.equal(page.paginationTotal, 1);
  assert.equal(page.visibleOffers.length, 1);
  assert.equal(page.visibleOffers[0].id, 'ok');
});

test('price-sort live ranking keeps over-budget live overlays in the matchset', () => {
  clearResultsLivePriceCache();
  const pool = [
    makeOffer({ id: 'cheap', price: 300 }),
    makeOffer({ id: 'live-expensive', price: 350 }),
  ];
  setResultsLivePriceOverlay('live-expensive', baseParams, {
    price: 900,
    pricePerDay: 112,
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    liveTotalPrice: 1800,
    liveTotalPriceField: 'upsales.totalPrice',
  });

  const ranked = rankLivePricedCandidatePool(pool, {
    ...baseParams,
    budgetMax: 400,
    sort: 'price',
  });
  assert.equal(ranked.length, 2);
  assert.ok(ranked.some((offer) => offer.id === 'live-expensive'));
});

test('rankCatalogOffers length equals filterOffers for every sort', () => {
  clearResultsLivePriceCache();
  const catalog = [
    makeOffer({ id: '1', price: 400 }),
    makeOffer({ id: '2', price: 500 }),
    makeOffer({ id: 'skip', price: 200, destinationCountry: 'Griekenland' }),
  ];
  const filters = filterOffers(catalog, baseParams).length;
  assert.equal(filters, 2);
  for (const sort of ['value', 'price', 'price-desc', 'price-per-day', 'stars'] as const) {
    assert.equal(rankCatalogOffers(catalog, { ...baseParams, sort }).length, filters, sort);
  }
});
