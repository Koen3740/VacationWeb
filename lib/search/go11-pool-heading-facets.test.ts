import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { isPriceDependentSort } from '@/lib/search/prepare-results-offers';
import { countResultsPool, capBrowsablePresentableCount } from '@/lib/search/results-pool-count';
import {
  RESULTS_MAX_BROWSE_PAGES,
  RESULTS_USER_PAGINATION_CAP,
  getResultsTotalPages,
} from '@/lib/search/pagination';

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('GO11 pool ≠ 150 / heading / facets / price-sort / browse cap', () => {
  it('heading helpers: pool count is matchset length; browse cap 150', () => {
    const pool = Array.from({ length: 200 }, (_, i) => ({ id: `o-${i}` }));
    assert.equal(countResultsPool(pool), 200);
    assert.equal(capBrowsablePresentableCount(200, RESULTS_USER_PAGINATION_CAP), 150);
    assert.equal(capBrowsablePresentableCount(40, RESULTS_USER_PAGINATION_CAP), 40);
    assert.equal(RESULTS_MAX_BROWSE_PAGES, 15);
    assert.equal(getResultsTotalPages(200, 10), 15);
    assert.equal(getResultsTotalPages(80, 10), 8);
  });

  it('PresentableResultsCount + PriceSortPresentableCount use pool, not B/exactOffers', () => {
    const heading = read('components/results/presentable-results-count.tsx');
    assert.match(heading, /countResultsPool/);
    assert.doesNotMatch(heading, /loadPresentableResultsCount/);
    assert.doesNotMatch(heading, /await\s+prepared\.exactOffers/);
    assert.doesNotMatch(heading, /slicePriceSortPoolPage/);
  });

  it('facet badges count whole pool (revert GO8 B-only ≤150)', () => {
    const facets = read('components/results/results-facet-counts.tsx');
    assert.match(facets, /countResultsPool/);
    assert.doesNotMatch(facets, /loadPresentableResultsCount/);
  });

  it('background matchset live is uncapped (full pool)', () => {
    const sched = read('lib/search/schedule-capped-matchset-live-after-page.ts');
    assert.match(sched, /full-pool|full pool|FULL-matchset/i);
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
