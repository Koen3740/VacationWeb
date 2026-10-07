/**
 * Heading / result count = proven listable B only (never catalog matchset).
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import type { SearchParams, TravelOffer } from '@/types/travel';
import {
  countCatalogMatchset,
  countResultsPool,
} from '@/lib/search/results-pool-count';
import { countPresentableB } from '@/lib/search/s6-dynamic-refill';
import {
  bookableResultsMembership,
  selectResultsBrowsePool,
  selectSharedLivePricingPool,
} from '@/lib/search/results-catalog-page';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import {
  rankCatalogOffers,
  rankLivePricedCandidatePool,
  slicePriceSortPoolPage,
} from '@/lib/search/prepare-results-offers';

const params: SearchParams = { adults: 2, countries: ['Spanje'] };

function makeOffer(
  id: string,
  price: number,
  provider: 'Eliza was here' | 'Sunweb' | 'Corendon' = 'Eliza was here',
): TravelOffer {
  return {
    id,
    provider,
    hotelName: `Hotel ${id}`,
    destinationCountry: 'Spanje',
    departureDate: '2026-10-10',
    departureAirport: 'BRU',
    nights: 8,
    flightIncluded: 'true',
    price,
    pricePerDay: Math.round(price / 8),
    currency: 'EUR',
    imageUrl: '/images/results-card-placeholder.png',
    deepLink: `https://example.com/${id}`,
    livePriceStatus: 'catalog',
  };
}

function seedB(id: string, price: number, provider: TravelOffer['provider']): void {
  const source =
    provider === 'Corendon'
      ? ('upsales' as const)
      : ('getPromotedPrice' as const);
  setResultsLivePriceOverlay(id, params, {
    price,
    pricePerDay: Math.round(price / 8),
    livePriceStatus: 'proven',
    livePriceSource: source,
    liveTotalPrice: price * 2,
    liveTotalPriceField:
      provider === 'Corendon' ? 'upsales.totalPrice' : 'getPromotedPrice.totalPrice',
  });
}

function seedA(id: string): void {
  setResultsLivePriceOverlay(id, params, {
    price: 999,
    pricePerDay: 125,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'http_204',
  });
}

function seedC(id: string): void {
  setResultsLivePriceOverlay(id, params, {
    price: 999,
    pricePerDay: 125,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'timeout',
  });
}

beforeEach(() => {
  clearResultsLivePriceCache();
});

describe('heading result count = proven B only', () => {
  it('312 catalog + 250 B + 62 A/C/Pending => heading 250', () => {
    const catalog = Array.from({ length: 312 }, (_, i) => makeOffer(`o-${i}`, 400 + i));
    for (let i = 0; i < 250; i++) seedB(`o-${i}`, 400 + i, 'Eliza was here');
    for (let i = 250; i < 280; i++) seedA(`o-${i}`);
    for (let i = 280; i < 312; i++) seedC(`o-${i}`);

    assert.equal(countCatalogMatchset(catalog), 312);
    assert.equal(countResultsPool(catalog, params), 250);
    assert.equal(countPresentableB(catalog, params), 250);
    assert.equal(bookableResultsMembership(catalog, params).length, 250);
  });

  it('312 catalog + 10 B => heading 10', () => {
    const catalog = Array.from({ length: 312 }, (_, i) => makeOffer(`o-${i}`, 400 + i));
    for (let i = 0; i < 10; i++) seedB(`o-${i}`, 400 + i, 'Eliza was here');
    for (let i = 10; i < 200; i++) seedA(`o-${i}`);
    // rest stay Pending/unpriced

    assert.equal(countCatalogMatchset(catalog), 312);
    assert.equal(countResultsPool(catalog, params), 10);
  });

  it('A/C/Pending are never counted in the user-facing result count', () => {
    const catalog = [
      makeOffer('b-1', 300),
      makeOffer('a-1', 310),
      makeOffer('c-1', 320),
      makeOffer('p-1', 330),
    ];
    seedB('b-1', 300, 'Eliza was here');
    seedA('a-1');
    seedC('c-1');
    // p-1: no overlay = Pending

    assert.equal(countResultsPool(catalog, params), 1);
    assert.deepEqual(
      bookableResultsMembership(catalog, params).map((o) => o.id),
      ['b-1'],
    );
  });

  it('no double-counting of B ids', () => {
    const catalog = [
      makeOffer('b-1', 300),
      makeOffer('b-2', 310),
      makeOffer('b-1', 300), // duplicate id in array should still be 2 membership rows if duplicated objects
    ];
    seedB('b-1', 300, 'Eliza was here');
    seedB('b-2', 310, 'Eliza was here');
    const bookable = bookableResultsMembership(catalog, params);
    assert.equal(bookable.length, 3);
    assert.equal(new Set(bookable.map((o) => o.id)).size, 2);
    // Heading counts membership length (listable rows); callers pass unique matchset.
    const uniqueCatalog = [catalog[0]!, catalog[1]!];
    assert.equal(countResultsPool(uniqueCatalog, params), 2);
  });

  it('provider-independent: Corendon + Sunweb + Eliza B counted together', () => {
    const catalog = [
      makeOffer('corendon-1-BRUX-101026-7-DZ', 500, 'Corendon'),
      makeOffer('sunweb-100-2026-10-10-8-BRU-Logies', 400, 'Sunweb'),
      makeOffer('eliza-200', 450, 'Eliza was here'),
      makeOffer('eliza-201', 460, 'Eliza was here'),
    ];
    seedB(catalog[0]!.id, 500, 'Corendon');
    seedB(catalog[1]!.id, 400, 'Sunweb');
    seedB(catalog[2]!.id, 450, 'Eliza was here');
    seedA(catalog[3]!.id);

    assert.equal(countResultsPool(catalog, params), 3);
  });

  it('Default / Low→High / High→Low membership semantics preserved', () => {
    const catalog = Array.from({ length: 40 }, (_, i) =>
      makeOffer(`o-${i}`, 100 + i, 'Eliza was here'),
    );
    for (let i = 0; i < 40; i++) seedB(`o-${i}`, 1000 - i, 'Eliza was here');

    const defaultParams: SearchParams = { ...params };
    const priceParams: SearchParams = { ...params, sort: 'price' };
    const descParams: SearchParams = { ...params, sort: 'price-desc' };

    assert.equal(countResultsPool(catalog, defaultParams), 40);
    assert.equal(countResultsPool(catalog, priceParams), 40);
    assert.equal(countResultsPool(catalog, descParams), 40);

    const shared = selectSharedLivePricingPool(catalog, priceParams, 150);
    const defaultPool = selectResultsBrowsePool(catalog, defaultParams, 150);
    assert.deepEqual(
      new Set(shared.map((o) => o.id)),
      new Set(defaultPool.map((o) => o.id)),
    );

    const descRanked = rankLivePricedCandidatePool(
      rankCatalogOffers(catalog, descParams),
      descParams,
    );
    const descPage = slicePriceSortPoolPage(descRanked, 1, 150, {
      provisional: false,
      params: descParams,
    });
    assert.equal(descPage.paginationTotal, 40);
    assert.ok(descPage.visibleOffers[0]!.price >= descPage.visibleOffers.at(-1)!.price);
  });

  it('B proven later via overlay (S6/refill) enters the result count', () => {
    const catalog = Array.from({ length: 20 }, (_, i) => makeOffer(`o-${i}`, 400 + i));
    assert.equal(countResultsPool(catalog, params), 0);

    seedB('o-5', 405, 'Eliza was here');
    assert.equal(countResultsPool(catalog, params), 1);

    seedB('o-7', 407, 'Eliza was here');
    seedB('o-9', 409, 'Eliza was here');
    assert.equal(countResultsPool(catalog, params), 3);
  });

  it('count never falls back to catalog matchset length', () => {
    const catalog = Array.from({ length: 312 }, (_, i) => makeOffer(`o-${i}`, 400 + i));
    for (let i = 0; i < 50; i++) seedB(`o-${i}`, 400 + i, 'Eliza was here');
    const heading = countResultsPool(catalog, params);
    assert.equal(heading, 50);
    assert.notEqual(heading, countCatalogMatchset(catalog));
    assert.notEqual(heading, catalog.length);
  });

  it('heading + facet components wire countResultsPool with params (not bare length)', () => {
    const heading = readFileSync('components/results/presentable-results-count.tsx', 'utf8');
    const facets = readFileSync('components/results/results-facet-counts.tsx', 'utf8');
    const pool = readFileSync('lib/search/results-pool-count.ts', 'utf8');
    // t334u: the heading reads the pool through results-pool-reading.ts (same membership).
    assert.match(heading, /getSharedResultsPoolReader\(ranked,\s*countParams\)/);
    assert.match(
      readFileSync('lib/search/results-pool-reading.ts', 'utf8'),
      /bookableMembershipFromOverlaid\(overlaid,\s*params\)/,
    );
    assert.match(facets, /countResultsPool\(ranked,\s*facetFiltering\)/);
    assert.match(pool, /bookableResultsMembership\(offers, params\)\.length/);
    assert.match(pool, /countCatalogMatchset/);
    assert.match(
      pool,
      /User-facing Results count: proven B\/listable/,
    );
  });
});
