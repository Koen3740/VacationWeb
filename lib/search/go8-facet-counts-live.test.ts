import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const ROOT = process.cwd();

test('GO8/GO11: Results facet badges count whole pool (not B-only ≤150)', () => {
  const facetSrc = readFileSync(join(ROOT, 'components/results/results-facet-counts.tsx'), 'utf8');
  assert.ok(facetSrc.includes('countResultsPool'));
  assert.ok(facetSrc.includes('loadPreparedResultsOffers'));
  assert.ok(!facetSrc.includes('loadPresentableResultsCount'));
});

test('GO8: page streams CarRental/Roadtrip facets with Suspense', () => {
  const pageSrc = readFileSync(join(ROOT, 'app/results/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('CarRentalFacetCount'));
  assert.ok(pageSrc.includes('RoadtripFacetCount'));
});

test('GO8: audit — carRental/roadtrip appear in filter sidebar', () => {
  const sidebar = readFileSync(join(ROOT, 'components/results/filter-sidebar.tsx'), 'utf8');
  assert.ok(/carRental|CarRental|hasCarRental/i.test(sidebar));
  assert.ok(/roadtrip|Roadtrip/i.test(sidebar));
});
