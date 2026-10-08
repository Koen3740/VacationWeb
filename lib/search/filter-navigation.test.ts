import assert from 'node:assert/strict';
import test from 'node:test';
import { writeBudgetParams } from './budget-params';
import {
  applyFilterNavigationPaging,
  shouldDropFilterCommit,
  SIDEBAR_FILTER_NAVIGATION,
  SORT_NAVIGATION,
  toggleSelectedValue,
} from './filter-navigation';
import { BUDGET_GENERATION_NAVIGATION } from './budget-generation';
import { readFileSync } from 'node:fs';

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

test('clearing page1Ids also clears catalogGen stamp', () => {
  const params = new URLSearchParams(
    'country=Spanje&page1Ids=a,b,c&page=3&catalogGen=gen-old&provider=Corendon',
  );
  applyFilterNavigationPaging(params, { preservePage1Ids: false });
  assert.equal(params.get('page1Ids'), null);
  assert.equal(params.get('catalogGen'), null);
  assert.equal(params.get('page'), null);
  assert.equal(params.get('country'), 'Spanje');
  assert.equal(params.get('provider'), 'Corendon');
});

test('stars / board / vacation / amenity refine keep page1Ids', () => {
  for (const extra of ['stars=4', 'boardTypes=All+Inclusive', 'vacationTypes=Adults+Only', 'amenities=pool_outdoor', 'hasCarRental=1']) {
    const params = new URLSearchParams(`adults=2&page1Ids=keep-me&${extra}`);
    applyFilterNavigationPaging(params, { preservePage1Ids: true });
    assert.equal(params.get('page1Ids'), 'keep-me', extra);
  }
});

test('sidebar catalog filters use the same latest-wins flag as budget generations', () => {
  assert.equal(SIDEBAR_FILTER_NAVIGATION.allowWhileNavigating, true);
  assert.equal(BUDGET_GENERATION_NAVIGATION.allowWhileNavigating, true);
  assert.equal(
    shouldDropFilterCommit({
      navigationLocked: true,
      allowWhileNavigating: SIDEBAR_FILTER_NAVIGATION.allowWhileNavigating,
    }),
    false,
  );
  assert.equal(shouldDropFilterCommit({ navigationLocked: true }), true);
});

test('rapid All Inclusive then beach lt100 composes on the latest selection', () => {
  const afterBoard = {
    boardTypes: toggleSelectedValue([], 'All Inclusive'),
    beachDistances: [] as string[],
  };
  const afterBeach = {
    boardTypes: afterBoard.boardTypes,
    beachDistances: toggleSelectedValue(afterBoard.beachDistances, 'lt100'),
  };
  assert.deepEqual(afterBeach.boardTypes, ['All Inclusive']);
  assert.deepEqual(afterBeach.beachDistances, ['lt100']);
});

test('rapid board ticks and unticks compose in order on the latest list', () => {
  let board: string[] = [];
  for (const value of ['Logies', 'Logies & ontbijt', 'Halfpension', 'Volpension', 'All Inclusive']) {
    board = toggleSelectedValue(board, value);
  }
  assert.deepEqual(board, [
    'Logies',
    'Logies & ontbijt',
    'Halfpension',
    'Volpension',
    'All Inclusive',
  ]);
  for (const value of ['Logies', 'Logies & ontbijt', 'Halfpension', 'Volpension', 'All Inclusive']) {
    board = toggleSelectedValue(board, value);
  }
  assert.deepEqual(board, []);
});

test('filter-sidebar issues overlapping replaces instead of dropping the second click', () => {
  const src = readFileSync('components/results/filter-sidebar.tsx', 'utf8');
  assert.match(src, /SIDEBAR_FILTER_NAVIGATION/);
  assert.match(src, /filtersRef/);
  assert.match(src, /toggleSelectedValue/);
  assert.match(src, /\{ \.\.\.filtersRef\.current, budgetMin:/);
  assert.doesNotMatch(
    src,
    /if \(navigationLockRef\.current && !options\?\.allowWhileNavigating\) \{\s*return;/,
  );
});

test('sort navigation drops page1Ids so a new ranking is not frozen to the previous page 1', () => {
  assert.equal(SORT_NAVIGATION.preservePage1Ids, false);
  const params = new URLSearchParams('country=Spanje&page1Ids=a,b,c&page=3&sort=price');
  applyFilterNavigationPaging(params, { preservePage1Ids: SORT_NAVIGATION.preservePage1Ids });
  assert.equal(params.get('page1Ids'), null);
  assert.equal(params.get('page'), null);
  const src = readFileSync('components/results/sort-selector.tsx', 'utf8');
  assert.match(src, /SORT_NAVIGATION/);
  assert.match(src, /preservePage1Ids: SORT_NAVIGATION\.preservePage1Ids/);
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
