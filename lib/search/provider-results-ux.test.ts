/**
 * Hero vs Results heading + compact pagination for provider filter UX.
 */
import {
  formatHeroCountLabel,
  formatSectionCountLabel,
} from '@/lib/search/results-count-labels';
import {
  buildCompactPaginationItems,
  clampResultsPage,
  getResultsTotalPages,
  RESULTS_MAX_BROWSE_PAGES,
} from '@/lib/search/pagination';
import { CORENDON_PROVIDER_NAME, SUNWEB_PROVIDER_NAME } from '@/lib/search/presentable-price';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('hero vs results heading labels', () => {
  it('hero stays destination count without provider suffix', () => {
    assert.equal(formatHeroCountLabel(193, 'Spanje • 1 okt – 31 okt'), '193 vakanties in Spanje');
    assert.equal(formatHeroCountLabel(0, 'Spanje'), 'Geen vakanties gevonden');
  });

  it('section heading has no provider suffix when Alle aanbieders', () => {
    assert.equal(formatSectionCountLabel(193), '193 vakanties gevonden');
    assert.equal(formatSectionCountLabel(193, undefined), '193 vakanties gevonden');
    assert.equal(formatSectionCountLabel(193, ''), '193 vakanties gevonden');
  });

  it('section heading adds bij [provider] when filtered', () => {
    assert.equal(
      formatSectionCountLabel(3, CORENDON_PROVIDER_NAME),
      '3 vakanties gevonden bij Corendon',
    );
    assert.equal(
      formatSectionCountLabel(161, SUNWEB_PROVIDER_NAME),
      '161 vakanties gevonden bij Sunweb',
    );
    assert.equal(
      formatSectionCountLabel(29, 'Eliza was here'),
      '29 vakanties gevonden bij Eliza was here',
    );
  });

  it('PresentableResultsCount uses the current search including provider for both headings', () => {
    const src = readFileSync('components/results/presentable-results-count.tsx', 'utf8');
    assert.match(src, /countCatalogMatchsetForSearch\(prepared\.offers,\s*countParams\)/);
    assert.match(src, /scopeOffersToProviderFilter\(await prepared\.exactOffers,\s*countParams\)/);
    assert.doesNotMatch(src, /omitProviderFilter\(filteringParams\)/);
    assert.match(src, /provider=\{filteringParams\.provider\}/);
    assert.match(
      readFileSync('lib/search/results-count-labels.ts', 'utf8'),
      /formatSectionCountLabel\(step\.count,\s*options\.provider\)/,
    );
    assert.match(src, /variant: 'hero' \| 'section'/);
  });
});

describe('effective-pool pagination pages', () => {
  it('totalPages = min(15, ceil(count / pageSize))', () => {
    assert.equal(getResultsTotalPages(3, 10), 1);
    assert.equal(getResultsTotalPages(10, 10), 1);
    assert.equal(getResultsTotalPages(11, 10), 2);
    assert.equal(getResultsTotalPages(29, 10), 3);
    assert.equal(getResultsTotalPages(39, 10), 4);
    assert.equal(getResultsTotalPages(100, 10), 10);
    assert.equal(getResultsTotalPages(150, 10), 15);
    assert.equal(getResultsTotalPages(161, 10), RESULTS_MAX_BROWSE_PAGES);
    assert.equal(getResultsTotalPages(200, 10), RESULTS_MAX_BROWSE_PAGES);
  });

  it('clampResultsPage corrects invalid page numbers', () => {
    assert.equal(clampResultsPage(7, 4), 4);
    assert.equal(clampResultsPage(1, 4), 1);
    assert.equal(clampResultsPage(99, 1), 1);
    assert.equal(clampResultsPage(0, 3), 1);
  });

  it('compact pagination matches expected shapes', () => {
    assert.deepEqual(buildCompactPaginationItems(1, 4), [1, 2, 3, 4]);
    assert.deepEqual(buildCompactPaginationItems(1, 10), [1, 2, 3, 'ellipsis', 10]);
    assert.deepEqual(buildCompactPaginationItems(5, 10), [1, 2, 3, 4, 5, 6, 'ellipsis', 10]);
    assert.deepEqual(buildCompactPaginationItems(10, 10), [1, 'ellipsis', 9, 10]);
    assert.deepEqual(buildCompactPaginationItems(1, 15), [1, 2, 3, 'ellipsis', 15]);
    assert.deepEqual(buildCompactPaginationItems(2, 15), [1, 2, 3, 4, 'ellipsis', 15]);
    assert.deepEqual(buildCompactPaginationItems(3, 15), [1, 2, 3, 4, 'ellipsis', 15]);
    assert.deepEqual(buildCompactPaginationItems(4, 15), [1, 2, 3, 4, 5, 'ellipsis', 15]);
    assert.deepEqual(buildCompactPaginationItems(5, 15), [1, 2, 3, 4, 5, 6, 'ellipsis', 15]);
    assert.deepEqual(buildCompactPaginationItems(7, 15), [1, 'ellipsis', 6, 7, 8, 'ellipsis', 15]);
    assert.deepEqual(buildCompactPaginationItems(14, 15), [1, 'ellipsis', 13, 14, 15]);
    assert.deepEqual(buildCompactPaginationItems(15, 15), [1, 'ellipsis', 14, 15]);
  });

  it('ResultsPagination drives pages from effective totalResults', () => {
    const ui = readFileSync('components/results/results-pagination.tsx', 'utf8');
    assert.match(ui, /getResultsTotalPages/);
    assert.match(ui, /buildCompactPaginationItems/);
    assert.match(ui, /clampResultsPage/);
    assert.doesNotMatch(ui, /getResultsBrowsePageCount/);
  });
});
