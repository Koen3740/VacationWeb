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

test('sort modes share the same stable filter match-count', async () => {
  clearResultsLivePriceCache();
  const catalog = [
    makeOffer({ id: 'a', price: 400 }),
    makeOffer({ id: 'b', price: 500 }),
    makeOffer({ id: 'c', price: 600 }),
    makeOffer({ id: 'd', price: 700 }),
    makeOffer({ id: 'other-country', price: 300, destinationCountry: 'Turkije' }),
  ];

  seedUnavailableOverlay('b');
  seedUnavailableOverlay('c');

  const filterCount = filterOffers(catalog, baseParams).length;
  assert.equal(filterCount, 4);

  const standard = await prepareResultsOffers(catalog, { ...baseParams, sort: 'value' });
  const priceAsc = await prepareResultsOffers(catalog, { ...baseParams, sort: 'price' });
  const priceDesc = await prepareResultsOffers(catalog, { ...baseParams, sort: 'price-desc' });

  assert.equal(standard.offers.length, filterCount);
  assert.equal(priceAsc.offers.length, filterCount);
  assert.equal(priceDesc.offers.length, filterCount);

  assert.equal(orderCatalogPageCandidates(standard.offers, baseParams).length, filterCount);
  assert.equal(orderCatalogPageCandidates(priceAsc.offers, baseParams).length, filterCount);
  assert.equal(orderCatalogPageCandidates(priceDesc.offers, baseParams).length, filterCount);

  assert.equal(slicePriceSortPoolPage(standard.offers, 1, 10).paginationTotal, filterCount);
  assert.equal(slicePriceSortPoolPage(priceAsc.offers, 1, 10).paginationTotal, filterCount);
  assert.equal(
    slicePriceSortPoolPage(await priceDesc.exactOffers, 1, 10).paginationTotal,
    filterCount,
  );
});

test('live-price failures do not reduce filter match-count or pagination total', () => {
  clearResultsLivePriceCache();
  const matched = [
    makeOffer({ id: 'ok', price: 400 }),
    makeOffer({ id: 'fail-a', price: 450 }),
    makeOffer({ id: 'fail-b', price: 500 }),
  ];
  seedUnavailableOverlay('fail-a');
  seedUnavailableOverlay('fail-b');

  const ranked = rankResultsOffers(matched, { ...baseParams, sort: 'value' });
  assert.equal(ranked.length, 3);

  const ordered = orderCatalogPageCandidates(ranked, baseParams);
  assert.equal(ordered.length, 3);
  assert.equal(ordered[0].id, 'ok');

  const page = slicePriceSortPoolPage(ordered, 1, 10);
  assert.equal(page.paginationTotal, 3);
  assert.equal(page.visibleOffers.length, 3);
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
