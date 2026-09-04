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
import {
  orderCatalogPageCandidates,
  sliceRankedCatalogResultsPage,
} from '@/lib/search/results-catalog-page';
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

function membershipIds(offers: readonly TravelOffer[]): string[] {
  return [...offers.map((offer) => offer.id)].sort();
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

  assert.equal(standard.offers.length, filterCount);
  assert.equal(priceAsc.offers.length, filterCount);
  assert.equal(priceDesc.offers.length, filterCount);
});

test('orderCatalogPageCandidates keeps full matchset membership (reorder only)', () => {
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

  const ordered = orderCatalogPageCandidates(ranked, baseParams);
  assert.equal(ordered.length, 4);
  assert.deepEqual(membershipIds(ordered), ['a', 'b', 'c', 'd']);
  // Presentable first for paint priority; settled remain members.
  assert.deepEqual(
    ordered.map((offer) => offer.id),
    ['a', 'd', 'b', 'c'],
  );

  const page = slicePriceSortPoolPage(ranked, 1, 10, {
    provisional: false,
    params: baseParams,
  });
  assert.equal(page.paginationTotal, 4);
  assert.equal(page.visibleOffers.length, 2);
  assert.deepEqual(
    page.visibleOffers.map((offer) => offer.id).sort(),
    ['a', 'd'],
  );
});

test('live-price failures do not shrink paginationTotal or membership', () => {
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
  assert.equal(ordered.length, 3);
  assert.deepEqual(membershipIds(ordered), ['fail-a', 'fail-b', 'ok']);

  const page = slicePriceSortPoolPage(ranked, 1, 10, {
    provisional: false,
    params: baseParams,
  });
  assert.equal(page.paginationTotal, 3);
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

test('membership(standard) == membership(price) == membership(price-per-day)', async () => {
  clearResultsLivePriceCache();
  const catalog = [
    makeOffer({ id: 'cheap', price: 299, pricePerDay: 37 }),
    makeOffer({ id: 'mid', price: 500, pricePerDay: 62 }),
    makeOffer({ id: 'pricey', price: 900, pricePerDay: 112 }),
    makeOffer({ id: 'day-cheap-total-high', price: 800, nights: 14, pricePerDay: 57 }),
    makeOffer({ id: 'out', price: 200, destinationCountry: 'Turkije' }),
  ];

  // Uneven live settlement across the ranked windows must not change membership.
  seedProvenOverlay('cheap', 299);
  seedProvenOverlay('mid', 500);
  seedUnavailableOverlay('pricey');
  seedProvenOverlay('day-cheap-total-high', 800);

  const filterIds = membershipIds(filterOffers(catalog, baseParams));
  assert.equal(filterIds.length, 4);

  const sorts = ['value', 'price', 'price-per-day'] as const;
  const memberships: string[][] = [];
  const counts: number[] = [];

  for (const sort of sorts) {
    const prepared = await prepareResultsOffers(catalog, { ...baseParams, sort });
    const ranked = prepared.offers;
    const ordered = orderCatalogPageCandidates(ranked, { ...baseParams, sort });
    const catalogPage = sliceRankedCatalogResultsPage(ranked, 1, 10, { ...baseParams, sort });
    const pricePage = slicePriceSortPoolPage(ranked, 1, 10, {
      provisional: false,
      params: { ...baseParams, sort },
    });

    assert.deepEqual(membershipIds(ranked), filterIds, `prepare ${sort}`);
    assert.deepEqual(membershipIds(ordered), filterIds, `order ${sort}`);
    assert.equal(catalogPage.paginationTotal, filterIds.length, `catalog page ${sort}`);
    assert.equal(pricePage.paginationTotal, filterIds.length, `price page ${sort}`);
    // Paint window may omit settled non-listable; ranked membership stays full.
    assert.ok(pricePage.visibleOffers.every((offer) => filterIds.includes(offer.id)));
    assert.ok(pricePage.visibleOffers.length <= filterIds.length);

    memberships.push(membershipIds(ranked));
    counts.push(ranked.length);
  }

  assert.deepEqual(memberships[0], memberships[1]);
  assert.deepEqual(memberships[1], memberships[2]);
  assert.equal(counts[0], counts[1]);
  assert.equal(counts[1], counts[2]);

  // Sorting may change order but not the ID set.
  const priceAsc = await prepareResultsOffers(catalog, { ...baseParams, sort: 'price' });
  const priceDay = await prepareResultsOffers(catalog, {
    ...baseParams,
    sort: 'price-per-day',
  });
  assert.notDeepEqual(
    priceAsc.offers.map((offer) => offer.id),
    priceDay.offers.map((offer) => offer.id),
  );
  assert.deepEqual(membershipIds(priceAsc.offers), membershipIds(priceDay.offers));
});
