import assert from 'node:assert/strict';
import test from 'node:test';
import { writeBudgetParams } from './budget-params';
import { applyFilterNavigationPaging } from './filter-navigation';

test('budget refine writes only the real max constraint', () => {
  const params = new URLSearchParams('country=Spanje&page1Ids=a,b,c');
  writeBudgetParams(params, 500, 1800, 500, 2000);
  assert.equal(params.get('budgetMin'), null);
  assert.equal(params.get('budgetMax'), '1800');
});

test('budget refine keeps page1Ids and drops page', () => {
  const params = new URLSearchParams('country=Spanje&page=2&page1Ids=a,b,c');
  applyFilterNavigationPaging(params, { preservePage1Ids: true });
  assert.equal(params.get('page1Ids'), 'a,b,c');
  assert.equal(params.get('page'), null);
});

test('budget refine reads page1Ids from the live URL when Next searchParams is stale', () => {
  const params = new URLSearchParams('country=Spanje');
  applyFilterNavigationPaging(params, {
    preservePage1Ids: true,
    liveQuery: '?country=Spanje&page1Ids=pv-1,cor-2',
  });
  assert.equal(params.get('page1Ids'), 'pv-1,cor-2');
});

test('occupancy new-search navigation still clears page1Ids', () => {
  const params = new URLSearchParams('country=Spanje&page1Ids=a,b,c&page=3');
  applyFilterNavigationPaging(params, { preservePage1Ids: false });
  assert.equal(params.get('page1Ids'), null);
  assert.equal(params.get('page'), null);
});

test('stars / board / vacation / amenity refine keep page1Ids', () => {
  for (const extra of ['stars=4', 'boardTypes=All+Inclusive', 'vacationTypes=Adults+Only', 'amenities=pool_outdoor']) {
    const params = new URLSearchParams(`adults=2&page1Ids=keep-me&${extra}`);
    applyFilterNavigationPaging(params, { preservePage1Ids: true });
    assert.equal(params.get('page1Ids'), 'keep-me', extra);
  }
});

test('unchanged budget should not require a second navigation helper', () => {
  const first = new URLSearchParams('page1Ids=a,b');
  writeBudgetParams(first, 500, 1800, 500, 2000);
  applyFilterNavigationPaging(first, { preservePage1Ids: true });

  const second = new URLSearchParams(first.toString());
  writeBudgetParams(second, 500, 1800, 500, 2000);
  applyFilterNavigationPaging(second, { preservePage1Ids: true });
  assert.equal(second.toString(), first.toString());
});
