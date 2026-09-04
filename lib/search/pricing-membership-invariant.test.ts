import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { TravelCard } from '@/components/results/travel-card';
import { CORENDON_PROVIDER_NAME } from '@/lib/providers/corendon/constants';
import {
  prepareResultsOffers,
  rankLivePricedCandidatePool,
  slicePriceSortPoolPage,
} from '@/lib/search/prepare-results-offers';
import { filterOffers, sortOffers } from '@/lib/search/filtering';
import {
  RESULTS_PRICE_COPY,
  hasValidPresentablePrice,
  isResultsListableOffer,
} from '@/lib/search/presentable-price';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import type { SearchParams, TravelOffer } from '@/types/travel';

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'price'>,
): TravelOffer {
  return {
    provider: CORENDON_PROVIDER_NAME,
    hotelName: `Hotel ${overrides.id}`,
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    departureDate: '2026-09-10',
    nights: 8,
    flightIncluded: 'true',
    pricePerDay: Math.round(overrides.price / 8),
    currency: 'EUR',
    imageUrl: '/images/results-card-placeholder.png',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.100926.8.SZ-U',
    livePriceStatus: 'catalog',
    ...overrides,
  };
}

const baseParams: SearchParams = {
  adults: 2,
  countries: ['Spanje'],
};

function membershipIds(offers: readonly TravelOffer[]): string[] {
  return [...offers.map((offer) => offer.id)].sort();
}

function cardHtml(offer: TravelOffer, provisional = false): string {
  return renderToStaticMarkup(createElement(TravelCard, { offer, provisional }));
}

function seedProven(id: string, price: number): void {
  setResultsLivePriceOverlay(id, baseParams, {
    price,
    pricePerDay: Math.round(price / 8),
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    liveTotalPrice: price * 2,
    liveTotalPriceField: 'upsales.totalPrice',
  });
}

function seedUnavailable(id: string): void {
  setResultsLivePriceOverlay(id, baseParams, {
    price: 999,
    pricePerDay: 125,
    livePriceStatus: 'unavailable',
    livePriceSource: 'lowestpricesacco',
    livePriceFailureReason: 'http_204',
  });
}

test('A. pending pricing: listable match stays in set, pageable, and renders', async () => {
  clearResultsLivePriceCache();
  const catalog = [
    makeOffer({ id: 'pending-a', price: 400 }),
    makeOffer({ id: 'pending-b', price: 500 }),
    makeOffer({ id: 'out', price: 300, destinationCountry: 'Turkije' }),
  ];
  const filtered = filterOffers(catalog, baseParams);
  assert.equal(filtered.length, 2);

  const prepared = await prepareResultsOffers(catalog, { ...baseParams, sort: 'price' });
  assert.deepEqual(membershipIds(prepared.offers), ['pending-a', 'pending-b']);
  // prepare may settle missing_context into listing-keyed cache for incomplete fixtures;
  // pending membership assertions use the catalog offer status, not that pollution.
  clearResultsLivePriceCache();

  for (const offer of prepared.offers) {
    assert.equal(hasValidPresentablePrice(offer), false);
    assert.equal(isResultsListableOffer(offer), true);
    const html = cardHtml(offer, false);
    assert.match(html, new RegExp(`Hotel ${offer.id}`));
    assert.match(html, new RegExp(RESULTS_PRICE_COPY.pending));
  }

  const page = slicePriceSortPoolPage(prepared.offers, 1, 10, {
    provisional: false,
    params: { ...baseParams, sort: 'price' },
  });
  assert.equal(page.paginationTotal, 2);
  assert.equal(page.visibleOffers.length, 2);
});

test('B. slow pricing: match remains until proven overlay arrives', async () => {
  clearResultsLivePriceCache();
  const offer = makeOffer({ id: 'slow', price: 450 });
  const prepared = await prepareResultsOffers([offer], { ...baseParams, sort: 'value' });
  assert.equal(prepared.offers.length, 1);
  assert.match(cardHtml(prepared.offers[0], false), new RegExp(RESULTS_PRICE_COPY.pending));


  clearResultsLivePriceCache();
  seedProven('slow', 420);
  const ranked = rankLivePricedCandidatePool(prepared.offers, baseParams);
  assert.equal(ranked.length, 1);
  assert.equal(hasValidPresentablePrice(ranked[0]), true);
  assert.match(cardHtml(ranked[0], false), /\u20AC/);
});

test('C. live pricing failure: match stays in filtered membership', async () => {
  clearResultsLivePriceCache();
  const catalog = [
    makeOffer({ id: 'ok', price: 400 }),
    makeOffer({ id: 'fail', price: 410 }),
  ];
  seedProven('ok', 400);
  seedUnavailable('fail');

  const prepared = await prepareResultsOffers(catalog, { ...baseParams, sort: 'price' });
  assert.deepEqual(membershipIds(prepared.offers), ['fail', 'ok']);
  assert.equal(prepared.offers.length, filterOffers(catalog, baseParams).length);

  // Confirmed unavailable is not bookable; surviving listable still fills the page.
  const page = slicePriceSortPoolPage(prepared.offers, 1, 10, {
    provisional: false,
    params: baseParams,
  });
  assert.equal(page.paginationTotal, 2);
  assert.ok(page.visibleOffers.some((offer) => offer.id === 'ok'));
  assert.ok(page.visibleOffers.every(isResultsListableOffer));
});

test('D. intermediate page stays filled when many prices are pending', () => {
  clearResultsLivePriceCache();
  // 12 proven (front-loaded by price-sort ranking) + 30 catalog pending.
  const ranked = [
    ...Array.from({ length: 12 }, (_, index) =>
      makeOffer({
        id: `proven-${index}`,
        price: 200 + index,
        livePriceStatus: 'proven',
        livePriceSource: 'upsales',
        liveTotalPrice: (200 + index) * 2,
        liveTotalPriceField: 'upsales.totalPrice',
      }),
    ),
    ...Array.from({ length: 30 }, (_, index) =>
      makeOffer({ id: `catalog-${index}`, price: 500 + index, livePriceStatus: 'catalog' }),
    ),
  ];
  for (const offer of ranked.slice(0, 12)) {
    seedProven(offer.id, offer.price);
  }

  const ordered = rankLivePricedCandidatePool(ranked, { ...baseParams, sort: 'price' });
  assert.equal(ordered.length, 42);
  assert.ok(hasValidPresentablePrice(ordered[0]));
  assert.equal(ordered[12].livePriceStatus, 'catalog');

  const page2 = slicePriceSortPoolPage(ordered, 2, 10, {
    provisional: false,
    params: { ...baseParams, sort: 'price' },
  });
  assert.equal(page2.paginationTotal, 42);
  // Page 2 must not collapse to ~2 cards: pending catalog remains renderable.
  assert.ok(page2.visibleOffers.length >= 10, `got ${page2.visibleOffers.length}`);
  const renderable = page2.visibleOffers.filter((offer) => cardHtml(offer, false).includes('Hotel'));
  assert.ok(renderable.length >= 10, `renderable=${renderable.length}`);
});

test('E. sort modes share identical offer membership', async () => {
  clearResultsLivePriceCache();
  const catalog = [
    makeOffer({ id: 'a', price: 300, pricePerDay: 37 }),
    makeOffer({ id: 'b', price: 500, pricePerDay: 62 }),
    makeOffer({ id: 'c', price: 800, nights: 14, pricePerDay: 57 }),
    makeOffer({ id: 'skip', price: 200, destinationCountry: 'Griekenland' }),
  ];
  seedProven('a', 300);
  seedUnavailable('b');

  const sorts = ['value', 'price', 'price-desc', 'price-per-day'] as const;
  const expected = membershipIds(filterOffers(catalog, baseParams));
  const memberships: string[][] = [];

  for (const sort of sorts) {
    const prepared = await prepareResultsOffers(catalog, { ...baseParams, sort });
    assert.deepEqual(membershipIds(prepared.offers), expected, sort);
    memberships.push(membershipIds(prepared.offers));
  }
  assert.deepEqual(memberships[0], memberships[1]);
  assert.deepEqual(memberships[1], memberships[2]);
  assert.deepEqual(memberships[2], memberships[3]);
});

test('F. price sort order uses proven amounts when available', () => {
  clearResultsLivePriceCache();
  const pool = [
    makeOffer({ id: 'high', price: 900 }),
    makeOffer({ id: 'low', price: 300 }),
    makeOffer({ id: 'mid', price: 600 }),
  ];
  seedProven('high', 900);
  seedProven('low', 300);
  seedProven('mid', 600);

  const asc = rankLivePricedCandidatePool(pool, { ...baseParams, sort: 'price' });
  assert.deepEqual(
    asc.filter(hasValidPresentablePrice).map((offer) => offer.id),
    ['low', 'mid', 'high'],
  );

  const desc = rankLivePricedCandidatePool(pool, { ...baseParams, sort: 'price-desc' });
  assert.deepEqual(
    desc.filter(hasValidPresentablePrice).map((offer) => offer.id),
    ['high', 'mid', 'low'],
  );

  const perDayPool = [
    makeOffer({ id: 'day-high', price: 400, nights: 8, pricePerDay: 80 }),
    makeOffer({ id: 'day-low', price: 560, nights: 14, pricePerDay: 40 }),
  ];
  seedProven('day-high', 400);
  seedProven('day-low', 560);
  const perDay = sortOffers(
    rankLivePricedCandidatePool(perDayPool, { ...baseParams, sort: 'price-per-day' }).filter(
      hasValidPresentablePrice,
    ),
    'price-per-day',
  );
  assert.ok(perDay[0].pricePerDay <= perDay[1].pricePerDay);
});
