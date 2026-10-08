/**
 * User-facing Results/facet display: catalog > 150 → catalog; else Proven-B.
 * countResultsPool remains Proven-B membership and is not the display layer.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { RESULTS_BROWSE_PRESENTABLE_CAP } from '@/lib/search/pagination';
import {
  selectDisplayedResultsCount,
  usesCatalogResultsDisplayCount,
} from '@/lib/search/results-pool-count';

describe('selectDisplayedResultsCount — catalog > 150 vs Proven-B', () => {
  it('TEST 1: catalog 0 / Proven-B 0 → 0', () => {
    assert.equal(selectDisplayedResultsCount(0, 0), 0);
    assert.equal(usesCatalogResultsDisplayCount(0), false);
  });

  it('TEST 2: catalog 25 / Proven-B 18 → 18', () => {
    assert.equal(selectDisplayedResultsCount(25, 18), 18);
  });

  it('TEST 3: catalog 25 / Proven-B 25 → 25', () => {
    assert.equal(selectDisplayedResultsCount(25, 25), 25);
  });

  it('TEST 4: catalog 100 / Proven-B 73 → 73', () => {
    assert.equal(selectDisplayedResultsCount(100, 73), 73);
  });

  it('TEST 5: catalog 149 / Proven-B 121 → 121', () => {
    assert.equal(selectDisplayedResultsCount(149, 121), 121);
  });

  it('TEST 6: catalog 150 / Proven-B 137 → 137 (boundary = Proven-B)', () => {
    assert.equal(RESULTS_BROWSE_PRESENTABLE_CAP, 150);
    assert.equal(usesCatalogResultsDisplayCount(150), false);
    assert.equal(selectDisplayedResultsCount(150, 137), 137);
  });

  it('TEST 7: catalog 150 / Proven-B 150 → 150', () => {
    assert.equal(selectDisplayedResultsCount(150, 150), 150);
  });

  it('TEST 8: catalog 151 / Proven-B 100 → 151 (boundary = catalog)', () => {
    assert.equal(usesCatalogResultsDisplayCount(151), true);
    assert.equal(selectDisplayedResultsCount(151, 100), 151);
  });

  it('TEST 9: catalog 180 / Proven-B 145 → 180', () => {
    assert.equal(selectDisplayedResultsCount(180, 145), 180);
  });

  it('TEST 10: catalog 1643 / Proven-B 150 → 1643', () => {
    assert.equal(selectDisplayedResultsCount(1643, 150), 1643);
  });

  it('TEST 11: catalog 11600 / Proven-B 300 → 11600', () => {
    assert.equal(selectDisplayedResultsCount(11600, 300), 11600);
  });

  it('TEST 12: catalog 64000 / Proven-B 300 → 64000', () => {
    assert.equal(selectDisplayedResultsCount(64000, 300), 64000);
  });

  it('does not treat catalog as Proven-B: large catalog + low B still displays catalog', () => {
    assert.notEqual(selectDisplayedResultsCount(1643, 150), 150);
  });

  it('does not use catalog as end count when catalog <= 150', () => {
    assert.notEqual(selectDisplayedResultsCount(150, 137), 150);
    assert.notEqual(selectDisplayedResultsCount(120, 83), 120);
  });
});

describe('facet display uses the same 150/151 boundary', () => {
  it('Spanje catalog 1643 / Proven-B 150 → 1643', () => {
    assert.equal(selectDisplayedResultsCount(1643, 150), 1643);
  });

  it('Italië catalog 25 / Proven-B 18 → 18', () => {
    assert.equal(selectDisplayedResultsCount(25, 18), 18);
  });

  it('facet catalog 150 / Proven-B 137 → 137', () => {
    assert.equal(selectDisplayedResultsCount(150, 137), 137);
  });

  it('facet catalog 151 / Proven-B 137 → 151', () => {
    assert.equal(selectDisplayedResultsCount(151, 137), 151);
  });
});

describe('heading and facet wire display choice without awaiting pricing when catalog > 150', () => {
  it('heading: catalog branch before exactOffers; Proven-B stream kept for <=150', () => {
    const heading = readFileSync('components/results/presentable-results-count.tsx', 'utf8');
    assert.match(heading, /usesCatalogResultsDisplayCount\(catalogCount\)/);
    assert.match(heading, /countCatalogMatchsetForSearch\(prepared\.offers,\s*countParams\)/);
    const catalogIdx = heading.indexOf('usesCatalogResultsDisplayCount(catalogCount)');
    const exactIdx = heading.indexOf('await prepared.exactOffers');
    assert.ok(catalogIdx >= 0 && exactIdx > catalogIdx);
    assert.match(heading, /PoolProgressStream/);
    assert.match(heading, /getSharedResultsPoolReader\(ranked,\s*countParams\)/);
    assert.doesNotMatch(heading, /150\+|meer dan 150/);
  });

  it('facets: catalog branch before exactOffers; Proven-B via countResultsPool when <=150', () => {
    const facets = readFileSync('components/results/results-facet-counts.tsx', 'utf8');
    assert.match(facets, /usesCatalogResultsDisplayCount\(catalogCount\)/);
    assert.match(facets, /countCatalogMatchset\(prepared\.offers\)/);
    assert.match(facets, /selectDisplayedResultsCount/);
    assert.match(facets, /countResultsPool\(ranked,\s*facetFiltering\)/);
    const catalogIdx = facets.indexOf('usesCatalogResultsDisplayCount(catalogCount)');
    const exactIdx = facets.indexOf('await prepared.exactOffers');
    assert.ok(catalogIdx >= 0 && exactIdx > catalogIdx);
  });
});
