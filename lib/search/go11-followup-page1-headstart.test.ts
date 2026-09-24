import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('GO11-fu: full-pool schedule waits for page overlays / head-start (not on render await)', () => {
  const sched = readFileSync('lib/search/schedule-capped-matchset-live-after-page.ts', 'utf8');
  const body = readFileSync('components/results/catalog-live-section.tsx', 'utf8');
  assert.match(sched, /MATCHSET_LIVE_AFTER_PAGE_HEADSTART_MS/);
  assert.match(sched, /afterPageOverlays/);
  assert.match(sched, /Promise\.race/);
  assert.doesNotMatch(body, /await scheduleCappedMatchsetLiveAfterPage/);
  assert.match(body, /afterPageOverlays:\s*Promise\.all\(overlays\.map/);
  // schedule call must come after overlays are in scope, still not awaited
  const schedIdx = body.indexOf('scheduleCappedMatchsetLiveAfterPage(filtered');
  const awaitLoad = body.indexOf('await loadCatalogLivePageState');
  assert.ok(schedIdx > awaitLoad);
});
