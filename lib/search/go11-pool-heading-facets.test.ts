import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { isPriceDependentSort } from '@/lib/search/prepare-results-offers';
import {
  countCatalogMatchset,
  countResultsPool,
  capBrowsablePresentableCount,
} from '@/lib/search/results-pool-count';
import {
  RESULTS_MAX_BROWSE_PAGES,
  RESULTS_USER_PAGINATION_CAP,
  getResultsTotalPages,
} from '@/lib/search/pagination';
import type { SearchParams, TravelOffer } from '@/types/travel';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from '@/lib/search/results-live-price-cache';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

const params: SearchParams = { adults: 2 };

function makeEliza(i: number): TravelOffer {
  return {
    id: `eliza-${i}`,
    provider: 'Eliza was here',
    hotelName: `E ${i}`,
    destinationCountry: 'Spanje',
    departureDate: '2026-10-10',
    departureAirport: 'BRU',
    nights: 8,
    flightIncluded: 'true',
    price: 400 + i,
    pricePerDay: 50,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: `https://example.com/${i}`,
  };
}

describe('GO11 pool ≠ 150 / heading / facets / price-sort / browse cap', () => {
  it('heading helpers: pool count is proven B; browse cap 150; matchset separate', () => {
    clearResultsLivePriceCache();
    const pool = Array.from({ length: 200 }, (_, i) => makeEliza(i));
    for (let i = 0; i < 80; i++) {
      setResultsLivePriceOverlay(`eliza-${i}`, params, {
        price: 400 + i,
        pricePerDay: 50,
        livePriceStatus: 'proven',
        livePriceSource: 'getPromotedPrice',
        liveTotalPrice: (400 + i) * 2,
        liveTotalPriceField: 'getPromotedPrice.totalPrice',
      });
    }
    assert.equal(countCatalogMatchset(pool), 200);
    assert.equal(countResultsPool(pool, params), 80);
    assert.equal(capBrowsablePresentableCount(200, RESULTS_USER_PAGINATION_CAP), 150);
    assert.equal(capBrowsablePresentableCount(40, RESULTS_USER_PAGINATION_CAP), 40);
    assert.equal(RESULTS_MAX_BROWSE_PAGES, 15);
    assert.equal(getResultsTotalPages(200, 10), 15);
    assert.equal(getResultsTotalPages(80, 10), 8);
  });

  it('PresentableResultsCount + PriceSortPresentableCount use proven-B pool count', () => {
    const heading = read('components/results/presentable-results-count.tsx');
    assert.match(heading, /countResultsPool/);
    assert.match(heading, /exactOffers/);
    assert.match(heading, /hydrateResultsLivePriceOverlaysFromL2/);
    assert.doesNotMatch(heading, /loadPresentableResultsCount/);
    assert.doesNotMatch(heading, /slicePriceSortPoolPage/);
  });

  it('facet badges count proven B (same family as heading)', () => {
    const facets = read('components/results/results-facet-counts.tsx');
    assert.match(facets, /countResultsPool/);
    assert.match(facets, /hydrateResultsLivePriceOverlaysFromL2/);
    assert.doesNotMatch(facets, /loadPresentableResultsCount/);
  });

  it('background matchset live is demand-driven P2 after P1 (not uncapped enqueue)', () => {
    const sched = read('lib/search/schedule-capped-matchset-live-after-page.ts');
    assert.match(sched, /runP2BackgroundWarm/);
    assert.match(sched, /runS6DynamicRefill/);
    assert.doesNotMatch(sched, /priceLiveRequiredMatchset\(matchset/);
    assert.doesNotMatch(sched, /selectLivePricingCandidateWindow/);
  });

  it('catalog page browse caps B at 150 over full matchset membership', () => {
    const state = read('lib/search/catalog-live-page-state.ts');
    assert.match(state, /GO11/);
    assert.match(state, /bookableResultsMembership\(filtered/);
    assert.match(state, /RESULTS_BROWSE_PRESENTABLE_CAP|RESULTS_USER_PAGINATION_CAP/);
    assert.doesNotMatch(state, /limitLivePricingCandidatePool\(\s*filtered/);
  });

  it('price-sort assemble ranks whole catalog by live price; slice caps at 150', () => {
    const prep = read('lib/search/prepare-results-offers.ts');
    assert.match(prep, /assemblePriceSortRanking\(\s*catalogRanked/);
    assert.match(prep, /rankLivePricedCandidatePool\(catalogRanked/);
    assert.match(prep, /RESULTS_USER_PAGINATION_CAP/);
    assert.ok(isPriceDependentSort('price-desc'));
  });

  it('price-desc top can be outside first-150 catalog window when that offer is B', () => {
    const prep = read('lib/search/prepare-results-offers.ts');
    assert.doesNotMatch(
      prep,
      /rankLivePricedCandidatePool\(liveWindow[\s\S]*\.\.\.tail/,
    );
    assert.equal(capBrowsablePresentableCount(160, 150), 150);
  });

  it('page1 freeze repair module still present (GO10 keep)', () => {
    const freeze = read('lib/search/page1-freeze-repair.ts');
    assert.match(freeze, /repairPage1FreezeOrder/);
    const state = read('lib/search/catalog-live-page-state.ts');
    assert.match(state, /repairPage1FreezeOrder/);
  });

  it('CatalogLiveBody does not Geen when pool non-empty', () => {
    const body = read('components/results/catalog-live-section.tsx');
    assert.match(body, /filtered\.length === 0/);
    assert.match(body, /const showEmpty = false/);
  });
});
