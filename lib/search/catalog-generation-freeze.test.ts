/**
 * Page 15 Gold: catalog-generation freeze stamp + mismatch/legacy reset.
 *
 * A–N coverage (unit + source-contract where hydrate order matters).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import type { SearchParams } from '@/types/travel';
import {
  CATALOG_GENERATION_MISMATCH_NAVIGATION,
  CATALOG_GENERATION_PARAM,
  parseCatalogGenerationParam,
  shouldInvalidateResultsFreeze,
  stripResultsFreezePaging,
} from '@/lib/search/catalog-generation-freeze';
import { applyFilterNavigationPaging } from '@/lib/search/filter-navigation';
import { buildResultsSearchQuery, parsePage1IdsParam } from '@/lib/search/pagination';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import {
  page1UrlIdsForSettle,
  resolvePage1SettleOutput,
  type PageSettleResult,
} from '@/lib/search/page-settle';
import { selectPage2PlusHydrationPlan } from '@/lib/search/results-catalog-page';
import { BUDGET_GENERATION_NAVIGATION } from '@/lib/search/budget-generation';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const GEN_A = '20260927T120000Z-aaaa';
const GEN_B = '20260927T180000Z-bbbb';

function settleReady(ids: string[]): PageSettleResult {
  return {
    status: 'READY',
    selectedIds: ids,
    final: true,
    pendingRanks: [],
    pendingRanksBeforeLastSelected: [],
  } as unknown as PageSettleResult;
}

function settleExhausted(ids: string[]): PageSettleResult {
  return {
    status: 'EXHAUSTED',
    selectedIds: ids,
    final: true,
    pendingRanks: [],
    pendingRanksBeforeLastSelected: [],
  } as unknown as PageSettleResult;
}

function settleDeadlineAnchor(ids: string[]): PageSettleResult {
  return {
    status: 'DEADLINE',
    selectedIds: ids,
    final: true,
    pendingRanks: [ids.length],
    pendingRanksBeforeLastSelected: [],
  } as unknown as PageSettleResult;
}

// --- A: definitive freeze gets stamp (settle output + URL emit) ---
test('A: READY/EXHAUSTED are DEFINITIVE; DEADLINE short is ANCHOR (no stamp policy)', () => {
  assert.equal(page1UrlIdsForSettle(settleReady(['a', 'b']), 10).freeze, 'DEFINITIVE');
  assert.equal(page1UrlIdsForSettle(settleExhausted(['a']), 10).freeze, 'DEFINITIVE');
  assert.equal(page1UrlIdsForSettle(settleDeadlineAnchor(['a', 'b']), 10).freeze, 'ANCHOR');

  const ready = resolvePage1SettleOutput({
    result: settleReady(['id1', 'id2']),
    browseTotal: 40,
    pageSize: 10,
  });
  assert.equal(ready.freeze, 'DEFINITIVE');
  assert.deepEqual(ready.page1Ids, ['id1', 'id2']);

  const q = buildResultsSearchQuery(
    { page1Ids: ready.page1Ids, catalogGen: GEN_A, countries: ['Spanje'] },
    2,
  );
  assert.equal(q.get(CATALOG_GENERATION_PARAM), GEN_A);
  assert.equal(q.get('page1Ids'), 'id1,id2');
  assert.equal(q.get('country'), 'Spanje');
});

test('A: SyncPage1IdsToUrl + receipt stream stamp only DEFINITIVE', () => {
  const sync = read('components/results/sync-page1-ids-to-url.tsx');
  assert.match(sync, /catalogGen/);
  assert.match(sync, /CATALOG_GENERATION_PARAM/);
  const receipt = read('components/results/page1-receipt-stream.tsx');
  assert.match(receipt, /freeze === 'DEFINITIVE'/);
  assert.match(receipt, /catalogGen=\{definitiveGen\}/);
});

// --- B: same generation keeps freeze ---
test('B: matching generation keeps page + page1Ids', () => {
  assert.equal(
    shouldInvalidateResultsFreeze({
      page1Ids: ['a', 'b'],
      catalogGen: GEN_A,
      currentGenerationId: GEN_A,
    }),
    false,
  );
  const params: SearchParams = {
    page: 15,
    page1Ids: ['a', 'b'],
    catalogGen: GEN_A,
    provider: 'Corendon',
    sort: 'price',
    budgetMax: 1200,
  };
  // no strip when matching
  assert.equal(params.page, 15);
  assert.deepEqual(params.page1Ids, ['a', 'b']);
});

// --- C / G / H / I: mismatch clears freeze, keeps criteria ---
test('C/G/H/I: mismatch strips page+page1Ids+catalogGen; keeps criteria', () => {
  assert.equal(
    shouldInvalidateResultsFreeze({
      page1Ids: ['a', 'b'],
      catalogGen: GEN_A,
      currentGenerationId: GEN_B,
    }),
    true,
  );
  const stripped = stripResultsFreezePaging({
    page: 15,
    page1Ids: ['a', 'b', 'c'],
    catalogGen: GEN_A,
    provider: 'Corendon',
    sort: 'price',
    budgetMin: 400,
    budgetMax: 1200,
    countries: ['Spanje'],
    region: 'Canarische Eilanden',
    departureStart: '2026-10-01',
    departureEnd: '2026-10-15',
    departureAirport: 'AMS',
    nightsMin: 7,
    nightsMax: 10,
    stars: [4, 5],
    boardTypes: ['All Inclusive'],
    adults: 2,
    children: 1,
    hasCarRental: true,
  });
  assert.equal(stripped.page, 1);
  assert.equal(stripped.page1Ids, undefined);
  assert.equal(stripped.catalogGen, undefined);
  assert.equal(stripped.provider, 'Corendon');
  assert.equal(stripped.sort, 'price');
  assert.equal(stripped.budgetMin, 400);
  assert.equal(stripped.budgetMax, 1200);
  assert.deepEqual(stripped.countries, ['Spanje']);
  assert.equal(stripped.region, 'Canarische Eilanden');
  assert.equal(stripped.departureStart, '2026-10-01');
  assert.equal(stripped.departureAirport, 'AMS');
  assert.equal(stripped.nightsMin, 7);
  assert.deepEqual(stripped.stars, [4, 5]);
  assert.deepEqual(stripped.boardTypes, ['All Inclusive']);
  assert.equal(stripped.adults, 2);
  assert.equal(stripped.children, 1);
  assert.equal(stripped.hasCarRental, true);

  const hrefQ = buildResultsSearchQuery(stripped, 1);
  assert.equal(hrefQ.get('page1Ids'), null);
  assert.equal(hrefQ.get(CATALOG_GENERATION_PARAM), null);
  assert.equal(hrefQ.get('page'), '1');
  assert.equal(hrefQ.get('provider'), 'Corendon');
  assert.equal(hrefQ.get('sort'), 'price');
  assert.equal(hrefQ.get('budgetMax'), '1200');
});

// --- D / E / F: legacy no stamp ---
test('D/E/F: page1Ids without stamp → invalidate (page 2 and page 15)', () => {
  assert.equal(
    shouldInvalidateResultsFreeze({
      page1Ids: ['a', 'b'],
      catalogGen: undefined,
      currentGenerationId: GEN_A,
    }),
    true,
  );
  for (const page of [2, 15]) {
    const stripped = stripResultsFreezePaging({
      page,
      page1Ids: Array.from({ length: 10 }, (_, i) => `id${i}`),
      countries: ['Spanje'],
      sort: 'value',
    });
    assert.equal(stripped.page, 1);
    assert.equal(stripped.page1Ids, undefined);
    assert.deepEqual(stripped.countries, ['Spanje']);
  }
});

// --- J / K: refresh match vs mismatch ---
test('J: refresh matching generation does not invalidate', () => {
  assert.equal(
    shouldInvalidateResultsFreeze({
      page1Ids: ['x'],
      catalogGen: GEN_A,
      currentGenerationId: GEN_A,
    }),
    false,
  );
});

test('K: refresh mismatching generation invalidates', () => {
  assert.equal(
    shouldInvalidateResultsFreeze({
      page1Ids: ['x'],
      catalogGen: GEN_A,
      currentGenerationId: GEN_B,
    }),
    true,
  );
});

// --- L: cold page 15 without page1Ids keeps existing flow ---
test('L: no page1Ids → never invalidate (cold deep-link path)', () => {
  assert.equal(
    shouldInvalidateResultsFreeze({
      page1Ids: undefined,
      catalogGen: undefined,
      currentGenerationId: GEN_A,
    }),
    false,
  );
  assert.equal(
    shouldInvalidateResultsFreeze({
      page1Ids: [],
      catalogGen: GEN_A,
      currentGenerationId: GEN_B,
    }),
    false,
  );
  const pageSrc = read('app/results/page.tsx');
  assert.match(pageSrc, /shouldInvalidateResultsFreeze/);
  assert.match(pageSrc, /stripResultsFreezePaging/);
  const section = read('components/results/catalog-live-section.tsx');
  assert.match(section, /coldPage2Page1Settle/);
  assert.match(section, /catalogGen: catalogGenerationId/);
});

// --- M: matching gen + thin L1 still uses discover-prefix (LP-001 unchanged) ---
test('M: selectPage2PlusHydrationPlan discover-prefix unchanged when freeze valid', () => {
  // Thin L1 (no seeded B) → discover-prefix; plan does not read catalogGen.
  const ranked = Array.from({ length: 50 }, (_, i) => ({
    id: `o${i}`,
    provider: 'Corendon',
    hotelName: `H${i}`,
    destinationCountry: 'Spanje',
    destinationRegion: 'Costa',
    departureDate: '2026-09-10',
    nights: 8,
    flightIncluded: 'true',
    price: 500 + i,
    pricePerDay: 60,
    currency: 'EUR',
    imageUrl: '/x.png',
    deepLink: 'https://example.com',
    livePriceStatus: 'catalog' as const,
  }));
  const page1Ids = ranked.slice(0, 10).map((o) => o.id);
  const plan = selectPage2PlusHydrationPlan({
    ranked,
    page: 15,
    pageSize: 10,
    page1Ids,
    browseCap: 150,
    params: { adults: 2 },
  });
  assert.equal(plan.mode, 'discover-prefix');
  assert.ok(plan.ids.length > 10);
});

// --- N: mismatch handled before discover-prefix hydrate ---
test('N: results page invalidates before CatalogLive / discover-prefix', () => {
  const pageSrc = read('app/results/page.tsx');
  const invAt = pageSrc.indexOf('shouldInvalidateResultsFreeze');
  // Compare against JSX usage (not the import line at the top of the file).
  const catalogAt = pageSrc.indexOf('<CatalogLiveSection');
  const priceAt = pageSrc.indexOf('<PriceSortPreparedSection');
  assert.ok(invAt > 0, 'invalidation present');
  assert.ok(catalogAt > invAt, 'CatalogLiveSection JSX after invalidation');
  assert.ok(priceAt > invAt, 'PriceSortPreparedSection JSX after invalidation');
  // Invalidation sits before filterOptions / prepare work in the page body.
  const filterOptsAt = pageSrc.indexOf('await loadPresentedFilterOptions');
  assert.ok(filterOptsAt > invAt, 'filter options load after invalidation gate');
  const stateSrc = read('lib/search/catalog-live-page-state.ts');
  assert.match(stateSrc, /selectPage2PlusHydrationPlan/);
  assert.match(stateSrc, /hydrateDiscoverPrefixUntilBrowseCap/);
  // Invalidation is in page.tsx, not after hydrate in catalog-live-page-state.
  assert.doesNotMatch(stateSrc, /shouldInvalidateResultsFreeze/);
});

test('parse + navigation: catalogGen round-trip; clear with page1Ids', () => {
  assert.equal(parseCatalogGenerationParam('  ' + GEN_A + '  '), GEN_A);
  assert.equal(parseCatalogGenerationParam(''), undefined);
  assert.equal(parseCatalogGenerationParam(undefined), undefined);

  const parsed = parseSearchParams({
    country: 'Spanje',
    page: '15',
    page1Ids: 'a,b,c',
    catalogGen: GEN_A,
    provider: 'Corendon',
  });
  assert.deepEqual(parsed.page1Ids, ['a', 'b', 'c']);
  assert.equal(parsed.catalogGen, GEN_A);
  assert.equal(parsed.page, 15);

  const params = new URLSearchParams(
    `country=Spanje&page=15&page1Ids=a,b&catalogGen=${GEN_A}&provider=Corendon`,
  );
  applyFilterNavigationPaging(params, {
    preservePage1Ids: CATALOG_GENERATION_MISMATCH_NAVIGATION.preservePage1Ids,
  });
  assert.equal(params.get('page1Ids'), null);
  assert.equal(params.get(CATALOG_GENERATION_PARAM), null);
  assert.equal(params.get('page'), null);
  assert.equal(params.get('country'), 'Spanje');
  assert.equal(params.get('provider'), 'Corendon');

  // Budget-generation nav shape matches mismatch nav for page1Ids.
  assert.equal(
    CATALOG_GENERATION_MISMATCH_NAVIGATION.preservePage1Ids,
    BUDGET_GENERATION_NAVIGATION.preservePage1Ids,
  );

  const keep = new URLSearchParams(`page1Ids=a,b&catalogGen=${GEN_A}&page=3`);
  applyFilterNavigationPaging(keep, { preservePage1Ids: true });
  assert.equal(keep.get('page1Ids'), 'a,b');
  assert.equal(keep.get(CATALOG_GENERATION_PARAM), GEN_A);
  assert.equal(keep.get('page'), null);

  const fromLive = new URLSearchParams('country=Spanje');
  applyFilterNavigationPaging(fromLive, {
    preservePage1Ids: true,
    liveQuery: `?page1Ids=x,y&catalogGen=${GEN_A}`,
  });
  assert.equal(fromLive.get('page1Ids'), 'x,y');
  assert.equal(fromLive.get(CATALOG_GENERATION_PARAM), GEN_A);

  assert.deepEqual(parsePage1IdsParam('a,b'), ['a', 'b']);
});

test('live pricing is not keyed by catalogGen (source contract)', () => {
  const liveCache = read('lib/search/results-live-price-cache.ts');
  assert.doesNotMatch(liveCache, /catalogGen/);
  assert.doesNotMatch(liveCache, /generationId/);
  const pageState = read('lib/search/catalog-live-page-state.ts');
  assert.doesNotMatch(pageState, /catalogGen/);
});
