import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { join } from 'node:path';

import { test } from 'node:test';



const ROOT = process.cwd();



function read(rel: string): string {

  return readFileSync(join(ROOT, rel), 'utf8');

}



test('GO9/GO11 F1: price-sort path streams pool heading (same as default sort)', () => {

  const page = read('app/results/page.tsx');

  assert.ok(page.includes('PriceSortPresentableCount') || page.includes('isPriceDependentSort'));

  const presentable = read('components/results/presentable-results-count.tsx');

  assert.ok(presentable.includes('export async function PriceSortPresentableCount'));

  assert.ok(presentable.includes('countResultsPool'));

  assert.ok(!/await\s+prepared\.exactOffers/.test(presentable));

  assert.ok(!presentable.includes('slicePriceSortPoolPage'));

});



test('GO9 F2: cold catalog presentable count still settles overlays (cards path)', () => {

  const state = read('lib/search/catalog-live-page-state.ts');

  assert.ok(state.includes('export async function loadPresentableResultsCount'));

  assert.ok(/overlay/i.test(state));

  const presentable = read('components/results/presentable-results-count.tsx');

  assert.ok(/Geen/i.test(presentable));

});



test('GO9 F3: price-sort L2 hydrate passes workset offers (listingKey)', () => {
  const prepSrc = read('lib/search/prepare-results-offers.ts');
  const awaitIdx = prepSrc.indexOf('await hydrateResultsLivePriceOverlaysFromL2');
  assert.ok(awaitIdx > 0, 'price-sort hydrate await');
  const call = prepSrc.slice(awaitIdx, awaitIdx + 220);
  assert.ok(call.includes('offers: workset'), 'hydrate must pass offers: workset, got: ' + call);
});



test('GO9 F4: Results shell does not await loadOffers on critical path', () => {

  const page = read('app/results/page.tsx');

  assert.equal(page.includes('await loadOffers('), false);

});

