import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseTravelersFromQuery } from '@/components/search/travelers-popup/travelers-popup-utils';
import { parseSearchParams } from '@/lib/search/parse-search-params';

const ROOT = process.cwd();

test('GO7: blank dob= does not invent a 1-person party (falls back to adults)', () => {
  const fromBlankDob = parseTravelersFromQuery({
    dob: '',
    adults: '2',
    children: '0',
    babies: '0',
    rooms: '1',
  });
  assert.ok(fromBlankDob);
  assert.equal(fromBlankDob!.travellers.length, 2);

  const fromCommaDob = parseTravelersFromQuery({
    dob: ',',
    adults: '2',
  });
  assert.ok(fromCommaDob);
  assert.equal(fromCommaDob!.travellers.length, 2);

  const params = parseSearchParams({
    country: 'Griekenland',
    nights: '8',
    adults: '2',
    dob: '',
  });
  assert.ok(params.party);
  assert.equal(params.party!.length, 2);
});

test('GO7: Results shell does not await prepareResultsOffers on price-sort branch', () => {
  const pageSrc = readFileSync(join(ROOT, 'app/results/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('PriceSortPreparedSection'));
  assert.ok(pageSrc.includes('GO7'));
  assert.ok(!pageSrc.includes('await prepareResultsOffers'));
  assert.ok(pageSrc.includes('<Suspense'));
});

test('GO7: PriceSortPreparedSection prepares inside Suspense via shared cache', () => {
  const src = readFileSync(
    join(ROOT, 'components/results/price-sort-prepared-section.tsx'),
    'utf8',
  );
  assert.ok(src.includes('loadPreparedResultsOffers'));
  assert.ok(src.includes('PriceSortResultsStream'));
  assert.ok(src.includes('GO7'));
});

test('GO7: facet badges stream via Suspense (no hard-coded 0)', () => {
  const pageSrc = readFileSync(join(ROOT, 'app/results/page.tsx'), 'utf8');
  assert.ok(pageSrc.includes('CarRentalFacetCount'));
  assert.ok(pageSrc.includes('RoadtripFacetCount'));
  assert.ok(!pageSrc.includes('carRentalCount={0}'));
  assert.ok(!pageSrc.includes('roadtripCount={0}'));
  assert.ok(pageSrc.includes('fallback="…"'));

  const facetSrc = readFileSync(join(ROOT, 'components/results/results-facet-counts.tsx'), 'utf8');
  assert.ok(facetSrc.includes('countResultsPool') || facetSrc.includes('loadPreparedResultsOffers'));
  assert.ok(facetSrc.includes('loadPreparedResultsOffers'));
  assert.ok(facetSrc.includes('hasCarRental') || facetSrc.includes('withCarRental'));
});

test('GO7: FilterSidebar accepts streamed ReactNode facet counts', () => {
  const sidebar = readFileSync(join(ROOT, 'components/results/filter-sidebar.tsx'), 'utf8');
  assert.ok(sidebar.includes('ReactNode'));
  assert.ok(sidebar.includes('carRentalCount: number | ReactNode'));
  assert.ok(sidebar.includes('roadtripCount: number | ReactNode'));
});
