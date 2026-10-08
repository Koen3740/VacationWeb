import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

/**
 * Owner 25-09-2026 23:03: no fullscreen loading overlay in the Results flow. Delayed
 * compact notice above the cards reuses SearchProgressFeedback after ~2s.
 * Homepage search keeps its overlay. Browse-cap dialog may use a modal overlay.
 */
const root = process.cwd();
const src = (rel: string) => readFileSync(path.join(root, rel), 'utf8');

const RESULTS_FLOW_CONTROLS = [
  'components/results/filter-sidebar.tsx',
  'components/results/sort-selector.tsx',
  'components/results/results-pagination.tsx',
  'components/results-v2/results-search-bar.tsx',
  'components/results/provider-filter-select.tsx',
];

test('Results flow controls render no fullscreen SearchProgressOverlay', () => {
  for (const rel of RESULTS_FLOW_CONTROLS) {
    const code = src(rel);
    assert.equal(
      code.includes('SearchProgressOverlay'),
      false,
      `${rel} must not render SearchProgressOverlay`,
    );
  }
  assert.equal(src('components/results-v2/results-page-client.tsx').includes('SearchProgressOverlay'), false);
  assert.equal(src('components/results/results-navigation-busy.tsx').includes('SearchProgressOverlay'), false);
});

test('delayed navigation notice reuses existing SearchProgressFeedback after 2s', () => {
  const notice = src('components/results/results-navigation-busy.tsx');
  const page = src('components/results-v2/results-page-client.tsx');
  const progress = src('components/search/search-progress-feedback.tsx');
  assert.match(progress, /SEARCH_PROGRESS_DELAY_MS = 2000/);
  assert.match(progress, /Een momentje — we zoeken de beste vakantie voor jou\./);
  assert.match(notice, /useDelayedBusyOverlay\(Boolean\(ctx\?\.isBusy\),\s*SEARCH_PROGRESS_DELAY_MS\)/);
  assert.match(notice, /SearchProgressFeedback/);
  assert.match(notice, /results-delayed-navigation-notice/);
  assert.match(page, /ResultsDelayedNavigationNotice/);
  assert.match(page, /ResultsNavigationBusyProvider/);
});

test('fast navigation stays quiet: delay is not 0 and notice is not a control lock', () => {
  const notice = src('components/results/results-navigation-busy.tsx');
  const provider = src('components/results/provider-filter-select.tsx');
  const sidebar = src('components/results/filter-sidebar.tsx');
  assert.doesNotMatch(notice, /useDelayedBusyOverlay\([^,]+,\s*0\)/);
  assert.match(provider, /useReportResultsNavigationBusy\(isPending\)/);
  assert.doesNotMatch(provider, /disabled=\{isPending\}/);
  assert.match(provider, /setOptimisticProvider/);
  assert.match(sidebar, /useReportResultsNavigationBusy\(filterBusy\)/);
  assert.match(sidebar, /SIDEBAR_FILTER_NAVIGATION/);
  assert.match(sidebar, /allowWhileNavigating/);
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
