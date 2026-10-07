/**
 * t63u OPTIE B: sidebar facet badges (car rental / roadtrip) = presentable proven B only,
 * per site market. Supersedes GO11 whole-pool matchset facet counts.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { countCatalogMatchset, countResultsPool } from '@/lib/search/results-pool-count';
import { bookableResultsMembership } from '@/lib/search/results-catalog-page';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';
import { siteMarketUniverse } from '@/lib/search/market-inventory';
import { TRADETRACKER_AFFILIATE_SITE_MARKET } from '@/lib/tradetracker/promotions/constants';

function siteIdFor(market: 'be' | 'nl'): string {
  const hit = Object.entries(TRADETRACKER_AFFILIATE_SITE_MARKET).find(([, m]) => m === market);
  assert.ok(hit, `no affiliate site for ${market}`);
  return hit[0];
}

/** Test fixture string only (never requested). */
function marketLink(market: 'be' | 'nl', id: string): string {
  return `https://example.com/${id}?tt=1_2_${siteIdFor(market)}_`;
}

const base: SearchParams = { adults: 2, countries: ['Spanje'] };
const facetParams: SearchParams = { ...base, hasCarRental: true };

function offer(id: string, price: number, provider: TravelOffer['provider'], hasCarRental = true): TravelOffer {
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
    hasCarRental,
  } as TravelOffer;
}

function seedB(id: string, price: number, params: SearchParams, provider: TravelOffer['provider']): void {
  const corendon = provider === 'Corendon';
  setResultsLivePriceOverlay(id, params, {
    price,
    pricePerDay: Math.round(price / 8),
    livePriceStatus: 'proven',
    livePriceSource: corendon ? 'upsales' : 'getPromotedPrice',
    liveTotalPrice: price * 2,
    liveTotalPriceField: corendon ? 'upsales.totalPrice' : 'getPromotedPrice.totalPrice',
  });
}

function seedUnavailable(id: string, params: SearchParams, reason: 'http_204' | 'timeout'): void {
  setResultsLivePriceOverlay(id, params, {
    price: 999,
    pricePerDay: 125,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: reason,
  });
}

beforeEach(() => clearResultsLivePriceCache());

describe('facet counts = proven B only (t63u OPTIE B)', () => {
  it('no live price (Pending) is not counted', () => {
    const pool = [offer('p-1', 300, 'Sunweb'), offer('p-2', 310, 'Sunweb')];
    assert.equal(countCatalogMatchset(pool), 2);
    assert.equal(countResultsPool(pool, facetParams), 0);
  });

  it('A (unavailable) and C (timeout) are not counted; B is', () => {
    const pool = [offer('b', 300, 'Sunweb'), offer('a', 310, 'Sunweb'), offer('c', 320, 'Sunweb')];
    seedB('b', 300, facetParams, 'Sunweb');
    seedUnavailable('a', facetParams, 'http_204');
    seedUnavailable('c', facetParams, 'timeout');
    assert.equal(countResultsPool(pool, facetParams), 1);
  });

  it('multiple providers are counted together', () => {
    const pool = [
      offer('corendon-1-BRUX-101026-7-DZ', 500, 'Corendon'),
      offer('sunweb-100-2026-10-10-8-BRU-Logies', 400, 'Sunweb'),
      offer('eliza-200', 450, 'Eliza was here'),
    ];
    for (const o of pool) seedB(o.id, o.price, facetParams, o.provider);
    assert.equal(countResultsPool(pool, facetParams), 3);
  });

  it('BE and NL are isolated: each market counts only its own proven B', () => {
    const be: SearchParams = { ...facetParams, siteMarket: 'be' };
    const nl: SearchParams = { ...facetParams, siteMarket: 'nl' };
    const catalog = [
      { ...offer('be-1', 300, 'Sunweb'), deepLink: marketLink('be', 'be-1') },
      { ...offer('be-2', 310, 'Sunweb'), deepLink: marketLink('be', 'be-2') },
      { ...offer('nl-1', 320, 'Corendon'), deepLink: marketLink('nl', 'nl-1') },
    ];
    for (const o of catalog) seedB(o.id, o.price, facetParams, o.provider);
    assert.equal(countResultsPool(siteMarketUniverse(catalog, 'be'), be), 2);
    assert.equal(countResultsPool(siteMarketUniverse(catalog, 'nl'), nl), 1);
    assert.deepEqual(
      bookableResultsMembership(siteMarketUniverse(catalog, 'nl'), nl).map((o) => o.id),
      ['nl-1'],
    );
  });

  it('facet count equals the proven-B membership set', () => {
    const pool = Array.from({ length: 30 }, (_, i) => offer(`o-${i}`, 400 + i, 'Sunweb'));
    for (let i = 0; i < 12; i++) seedB(`o-${i}`, 400 + i, facetParams, 'Sunweb');
    for (let i = 12; i < 20; i++) seedUnavailable(`o-${i}`, facetParams, 'http_204');
    const members = bookableResultsMembership(pool, facetParams);
    assert.equal(countResultsPool(pool, facetParams), members.length);
    assert.deepEqual(
      members.map((o) => o.id).sort(),
      Array.from({ length: 12 }, (_, i) => `o-${i}`).sort(),
    );
  });

  it('existing facet filters stay intact and the component counts ranked + params (not matchset)', () => {
    const src = readFileSync('components/results/results-facet-counts.tsx', 'utf8');
    assert.match(src, /hasCarRental:\s*true/);
    assert.match(src, /ROADTRIP_VACATION_TYPE/);
    assert.match(src, /await prepared\.exactOffers/);
    assert.match(src, /startResultsPoolL2Hydrate\(ranked,\s*facetFiltering\)/);
    assert.doesNotMatch(src, /await hydrateResultsLivePriceOverlaysFromL2/);
    assert.match(src, /countResultsPool\(ranked,\s*facetFiltering\)/);
    assert.doesNotMatch(src, /countResultsPool\(prepared\.offers\)/);
  });
});