/**
 * Results budget invariant (owner RCA 25-09-2026 21:37): for an active budget range,
 * budgetMin <= displayed card price (live p.p.) <= budgetMax for every visible B card.
 * The matchset budget filter (filterOffers) runs on the catalog price; the price-sort
 * display pool (slicePriceSortPoolPage) must re-check the budget on the live price.
 * Pure; no I/O, no server.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { filterOffers, offerMatchesBudget } from '@/lib/search/filtering';
import { isPage1VisibleOffer } from '@/lib/search/page-settle';
import { slicePriceSortPoolPage } from '@/lib/search/prepare-results-offers';
import { clearResultsLivePriceCache } from '@/lib/search/results-live-price-cache';

function makeCatalog(id: string, overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id,
    provider: 'Corendon',
    hotelName: `Hotel ${id}`,
    destinationCountry: 'Portugal',
    destinationRegion: 'Algarve',
    departureDate: '2026-11-24',
    nights: 8,
    flightIncluded: 'true',
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUFAO.241126.3-4-3.SZ-U',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    ...overrides,
  };
}

/** Presentable B with a proven live p.p. price (1 adult pricing rule: total = p.p.). */
function makeLiveB(id: string, livePricePp: number, catalogPrice = 800): TravelOffer {
  return {
    ...makeCatalog(id, { price: catalogPrice }),
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    price: livePricePp,
    pricePerDay: Math.round(livePricePp / 8),
    liveTotalPrice: livePricePp,
    liveTotalPriceField: 'upsales.totalPrice',
  };
}

const BUDGET: SearchParams = { adults: 1, budgetMin: 764, budgetMax: 1560 } as SearchParams;

test('offerMatchesBudget on live price: min 764 -> 622 out, 764 in, 765 in', () => {
  assert.equal(offerMatchesBudget(makeLiveB('a', 622), BUDGET), false);
  assert.equal(offerMatchesBudget(makeLiveB('b', 764), BUDGET), true);
  assert.equal(offerMatchesBudget(makeLiveB('c', 765), BUDGET), true);
});

test('offerMatchesBudget on live price: max 1560 -> 1559 in, 1560 in, 1561 out', () => {
  assert.equal(offerMatchesBudget(makeLiveB('d', 1559), BUDGET), true);
  assert.equal(offerMatchesBudget(makeLiveB('e', 1560), BUDGET), true);
  assert.equal(offerMatchesBudget(makeLiveB('f', 1561), BUDGET), false);
});

test('default path render predicate (isPage1VisibleOffer) applies the same live-price bounds', () => {
  assert.equal(isPage1VisibleOffer(makeLiveB('a', 622), BUDGET), false);
  assert.equal(isPage1VisibleOffer(makeLiveB('b', 764), BUDGET), true);
  assert.equal(isPage1VisibleOffer(makeLiveB('c', 765), BUDGET), true);
  assert.equal(isPage1VisibleOffer(makeLiveB('e', 1560), BUDGET), true);
  assert.equal(isPage1VisibleOffer(makeLiveB('f', 1561), BUDGET), false);
});

test('catalog price inside budget passes the matchset filter even when the live price is below min', () => {
  // Stage 1 (matchset) uses the catalog price: 800 is inside 764-1560.
  const catalog = makeCatalog('faro-1', { price: 800 });
  assert.deepEqual(
    filterOffers([catalog], BUDGET).map((offer) => offer.id),
    ['faro-1'],
  );
  // Stage 2 (live price shown on the card) = 622: must not be presentable.
  assert.equal(offerMatchesBudget(makeLiveB('faro-1', 622, 800), BUDGET), false);
});

test('price-sort pool page: live 622 / 1561 not presentable, 764 / 765 / 1560 presentable', () => {
  clearResultsLivePriceCache();
  // low -> high as the price sort ranks them (B first).
  const ranked = [
    makeLiveB('p622', 622),
    makeLiveB('p764', 764),
    makeLiveB('p765', 765),
    makeLiveB('p1560', 1560),
    makeLiveB('p1561', 1561),
  ];
  const slice = slicePriceSortPoolPage(ranked, 1, 10, { provisional: false, params: BUDGET });
  assert.deepEqual(slice.visibleOffers.map((offer) => offer.id), ['p764', 'p765', 'p1560']);
  assert.deepEqual(slice.page1Ids, ['p764', 'p765', 'p1560']);
  assert.equal(slice.paginationTotal, 3);
  for (const offer of slice.visibleOffers) {
    assert.ok(offer.price >= 764 && offer.price <= 1560, `${offer.id} ${offer.price}`);
  }
});

test('price-sort pool page: out-of-budget live prices do not consume page slots or pagination', () => {
  clearResultsLivePriceCache();
  const below = Array.from({ length: 10 }, (_, i) => makeLiveB(`low-${i}`, 600 + i));
  const inside = Array.from({ length: 12 }, (_, i) => makeLiveB(`in-${i}`, 800 + i));
  const slice1 = slicePriceSortPoolPage([...below, ...inside], 1, 10, {
    provisional: false,
    params: BUDGET,
  });
  assert.equal(slice1.visibleOffers.length, 10);
  assert.ok(slice1.visibleOffers.every((offer) => offer.id.startsWith('in-')));
  assert.equal(slice1.paginationTotal, 12);
  const slice2 = slicePriceSortPoolPage([...below, ...inside], 2, 10, {
    provisional: false,
    params: BUDGET,
  });
  assert.deepEqual(slice2.visibleOffers.map((offer) => offer.id), ['in-10', 'in-11']);
});

test('price-sort pool page without budget params is unchanged (no budget filter)', () => {
  clearResultsLivePriceCache();
  const ranked = [makeLiveB('p622', 622), makeLiveB('p1561', 1561)];
  const slice = slicePriceSortPoolPage(ranked, 1, 10, { provisional: false });
  assert.deepEqual(slice.visibleOffers.map((offer) => offer.id), ['p622', 'p1561']);
  const noBudget = slicePriceSortPoolPage(ranked, 1, 10, {
    provisional: false,
    params: { adults: 1 } as SearchParams,
  });
  assert.deepEqual(noBudget.visibleOffers.map((offer) => offer.id), ['p622', 'p1561']);
});