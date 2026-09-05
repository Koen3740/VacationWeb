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

  // A stays in membership/pagination; only bookable presentation drops A.
  const page = slicePriceSortPoolPage(prepared.offers, 1, 10, {
    provisional: false,
    params: baseParams,
  });
  assert.equal(page.paginationTotal, 2);
  assert.deepEqual(membershipIds(page.visibleOffers), ['fail', 'ok']);
  assert.equal(isResultsListableOffer(page.visibleOffers.find((o) => o.id === 'fail')!), false);
  assert.equal(isResultsListableOffer(page.visibleOffers.find((o) => o.id === 'ok')!), true);
  assert.match(cardHtml(page.visibleOffers.find((o) => o.id === 'ok')!), /Hotel ok/);
  assert.equal(cardHtml(page.visibleOffers.find((o) => o.id === 'fail')!), '');
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

function seedTechnicalFailure(id: string, reason: 'stale_context' | 'timeout' | 'network_error'): void {
  setResultsLivePriceOverlay(id, baseParams, {
    price: 999,
    pricePerDay: 125,
    livePriceStatus: 'unavailable',
    livePriceSource: 'lowestpricesacco',
    livePriceFailureReason: reason,
  });
}

test('G. Abora-shaped stale_context: 1 match → 1 visible card, no fake €', () => {
  clearResultsLivePriceCache();
  const offer = makeOffer({
    id: 'corendon-8985-BRULPA-150926-7-DZA',
    price: 458,
    hotelName: 'Abora Catarina by Lopesan Hotels',
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'stale_context',
  });
  seedTechnicalFailure(offer.id, 'stale_context');
  const overlaid = rankLivePricedCandidatePool([offer], baseParams);
  assert.equal(overlaid.length, 1);
  assert.equal(isResultsListableOffer(overlaid[0]), true);
  assert.equal(hasValidPresentablePrice(overlaid[0]), false);
  const html = cardHtml(overlaid[0], false);
  assert.match(html, /Abora Catarina/);
  assert.match(html, new RegExp(RESULTS_PRICE_COPY.unavailable + '|' + RESULTS_PRICE_COPY.pending));
  assert.doesNotMatch(html, />€\s*\d/);
});

test('H. pagination membership: 37 → 10/10/10/7 regardless of pricing mix', () => {
  clearResultsLivePriceCache();
  const ranked = Array.from({ length: 37 }, (_, index) =>
    makeOffer({ id: `m-${index}`, price: 300 + index }),
  );
  // Mix: B on first 10, C on next 10, pending on rest, A on last 3.
  for (let i = 0; i < 10; i += 1) seedProven(`m-${i}`, 300 + i);
  for (let i = 10; i < 20; i += 1) seedTechnicalFailure(`m-${i}`, 'stale_context');
  for (let i = 34; i < 37; i += 1) seedUnavailable(`m-${i}`);

  const pageSizes = [1, 2, 3, 4].map((page) => {
    const slice = slicePriceSortPoolPage(ranked, page, 10, {
      provisional: false,
      params: baseParams,
    });
    assert.equal(slice.paginationTotal, 37);
    return slice.visibleOffers.length;
  });
  assert.deepEqual(pageSizes, [10, 10, 10, 7]);

  // Bookable cards: A on page 4 can drop presentation, but membership length stays 7.
  const page4 = slicePriceSortPoolPage(ranked, 4, 10, { provisional: false, params: baseParams });
  assert.equal(page4.visibleOffers.length, 7);
  const bookable = page4.visibleOffers.filter((offer) => isResultsListableOffer(offer));
  assert.equal(bookable.length, 4); // 7 members − 3 A
  assert.ok(bookable.every((offer) => cardHtml(offer, false).includes('Hotel')));
});

test('I. property: pricing status mixes do not change matchCount or page membership', () => {
  clearResultsLivePriceCache();
  const catalog = Array.from({ length: 21 }, (_, index) =>
    makeOffer({ id: `p-${index}`, price: 400 + index }),
  );
  const expectedIds = membershipIds(catalog);

  const mixes: Array<() => void> = [
    () => {
      for (const offer of catalog) seedProven(offer.id, offer.price);
    },
    () => {
      catalog.forEach((offer, index) => {
        if (index % 2 === 0) seedProven(offer.id, offer.price);
        else seedTechnicalFailure(offer.id, 'timeout');
      });
    },
    () => {
      catalog.forEach((offer, index) => {
        if (index % 2 === 0) {
          /* leave catalog/pending */
        } else {
          seedTechnicalFailure(offer.id, 'stale_context');
        }
      });
    },
    () => {
      catalog.forEach((offer, index) => {
        if (index % 3 === 0) seedProven(offer.id, offer.price);
        else if (index % 3 === 1) seedTechnicalFailure(offer.id, 'network_error');
        // else pending
      });
    },
  ];

  for (const applyMix of mixes) {
    clearResultsLivePriceCache();
    applyMix();
    const ranked = rankLivePricedCandidatePool(catalog, { ...baseParams, sort: 'price' });
    assert.equal(ranked.length, 21);
    assert.deepEqual(membershipIds(ranked), expectedIds);
    const page1 = slicePriceSortPoolPage(ranked, 1, 10, { provisional: false, params: baseParams });
    const page2 = slicePriceSortPoolPage(ranked, 2, 10, { provisional: false, params: baseParams });
    const page3 = slicePriceSortPoolPage(ranked, 3, 10, { provisional: false, params: baseParams });
    assert.equal(page1.paginationTotal, 21);
    assert.equal(page1.visibleOffers.length, 10);
    assert.equal(page2.visibleOffers.length, 10);
    assert.equal(page3.visibleOffers.length, 1);
    assert.deepEqual(
      [...page1.visibleOffers, ...page2.visibleOffers, ...page3.visibleOffers].map((o) => o.id).sort(),
      expectedIds,
    );
  }
});

test('J. sort modes share matchCount for same filters (incl. technical C)', async () => {
  clearResultsLivePriceCache();
  const catalog = [
    makeOffer({ id: 's1', price: 300, pricePerDay: 37 }),
    makeOffer({ id: 's2', price: 500, pricePerDay: 62 }),
    makeOffer({ id: 's3', price: 800, nights: 14, pricePerDay: 57 }),
  ];
  seedProven('s1', 300);
  seedTechnicalFailure('s2', 'stale_context');
  // s3 pending

  const counts: number[] = [];
  for (const sort of ['value', 'price', 'price-desc', 'price-per-day'] as const) {
    const prepared = await prepareResultsOffers(catalog, { ...baseParams, sort });
    counts.push(prepared.offers.length);
    assert.deepEqual(membershipIds(prepared.offers), ['s1', 's2', 's3'], sort);
  }
  assert.ok(counts.every((count) => count === counts[0]));
});

test('K. page-size edges keep stable membership lengths', () => {
  clearResultsLivePriceCache();
  for (const total of [1, 9, 10, 11, 20, 21, 37, 40]) {
    const ranked = Array.from({ length: total }, (_, index) =>
      makeOffer({
        id: `e-${total}-${index}`,
        price: 200 + index,
        livePriceStatus: index % 2 === 0 ? 'catalog' : 'unavailable',
        livePriceFailureReason: index % 2 === 0 ? undefined : 'timeout',
      }),
    );
    for (const offer of ranked) {
      if (offer.livePriceFailureReason === 'timeout') {
        seedTechnicalFailure(offer.id, 'timeout');
      }
    }
    const pages = Math.ceil(total / 10);
    let seen = 0;
    for (let page = 1; page <= pages; page += 1) {
      const slice = slicePriceSortPoolPage(ranked, page, 10, {
        provisional: false,
        params: baseParams,
      });
      assert.equal(slice.paginationTotal, total);
      const expected = page < pages ? 10 : total - (pages - 1) * 10;
      assert.equal(slice.visibleOffers.length, expected, `total=${total} page=${page}`);
      seen += slice.visibleOffers.length;
    }
    assert.equal(seen, total);
  }
});
