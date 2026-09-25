import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Owner 25-09-2026 23:03: no fullscreen loading overlay in the Results flow. The compact notice
 * above the cards ("Een momentje - we controleren de actuele prijzen. De volgorde kan nog
 * wijzigen.") is the Results loading feedback; the homepage search keeps its overlay.
 */
// Tests run from the repo root (npx tsx --test <files>).
const root = process.cwd();
const src = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

const RESULTS_FLOW_CONTROLS = [
  'components/results/filter-sidebar.tsx',
  'components/results/sort-selector.tsx',
  'components/results/results-pagination.tsx',
  'components/results-v2/results-search-bar.tsx',
];

test('Results flow controls render no fullscreen SearchProgressOverlay', () => {
  for (const rel of RESULTS_FLOW_CONTROLS) {
    const code = src(rel);
    assert.equal(code.includes('SearchProgressOverlay'), false, `${rel} must not render SearchProgressOverlay`);
    assert.equal(code.includes('useDelayedBusyOverlay'), false, `${rel} must not arm the delayed overlay`);
    assert.equal(/fixed inset-0/.test(code), false, `${rel} must not render a fixed full-viewport layer`);
  }
});

test('Results price-sort compact notice stays rendered while live prices are pending', () => {
  const code = src('components/results/price-sort-live-stream.tsx');
  assert.match(code, /PRICE_SORT_PENDING_MESSAGE =\s*'Een momentje .{1,3} we controleren de actuele prijzen\.'/);
  assert.match(code, /PRICE_SORT_PENDING_DETAIL = 'De volgorde kan nog wijzigen\.'/);
  assert.match(code, /\{pending \? <PriceSortPendingNotice \/> : null\}/);
});

test('Homepage search keeps its fullscreen SearchProgressOverlay (other caller unchanged)', () => {
  assert.match(src('components/home/home-search.tsx'), /\{searchBusy \? <SearchProgressOverlay \/> : null\}/);
});
