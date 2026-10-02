import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { selectLivePricingCandidateWindow } from './live-pricing-workset';
import { RESULTS_LIVE_PRICING_CANDIDATE_CAP } from './pagination';
import type { TravelOffer } from '@/types/travel';

const ROOT = process.cwd();

test('GO5: prepare non-price path does not schedule full ranked matchset live inline', () => {
  const prepare = readFileSync(join(ROOT, 'lib/search/prepare-results-offers.ts'), 'utf8');
  assert.ok(prepare.includes('GO5'));
  assert.ok(!prepare.includes('priceLiveRequiredMatchset(ranked'));
});

test('GO5/GO11: CatalogLive loads page state then schedules matchset live (deferred, full pool)', () => {
  const catalogLive = readFileSync(join(ROOT, 'components/results/catalog-live-section.tsx'), 'utf8');
  const scheduleCap = readFileSync(
    join(ROOT, 'lib/search/schedule-capped-matchset-live-after-page.ts'),
    'utf8',
  );
  assert.ok(catalogLive.includes('loadCatalogLivePageState'));
  assert.ok(catalogLive.includes('scheduleCappedMatchsetLiveAfterPage'));
  assert.ok(
    catalogLive.indexOf('scheduleCappedMatchsetLiveAfterPage') >
      catalogLive.indexOf('loadCatalogLivePageState'),
  );
  assert.ok(!scheduleCap.includes('selectLivePricingCandidateWindow'));
  assert.ok(scheduleCap.includes('runP2BackgroundWarm'));
  assert.ok(scheduleCap.includes('runS6DynamicRefill'));
  assert.ok(scheduleCap.includes('setTimeout'));
  assert.ok(/p1-then-p2|P2|background/i.test(scheduleCap));
  assert.ok(!scheduleCap.includes('priceLiveRequiredMatchset(matchset'));
});

test('GO5: technical live window helper cap remains 150 (priority window, not pool)', () => {
  const offers = Array.from({ length: 400 }, (_, i) => ({
    id: `sun-${i}`,
    provider: 'Sunweb',
    country: 'Griekenland',
  })) as unknown as TravelOffer[];
  const windowed = selectLivePricingCandidateWindow(offers, { adults: 2 });
  assert.ok(windowed.length <= RESULTS_LIVE_PRICING_CANDIDATE_CAP);
  assert.equal(RESULTS_LIVE_PRICING_CANDIDATE_CAP, 150);
});

test('GO5/GO11: heading uses PresentableResultsCount (proven B); cards use paginationTotal', () => {
  const pageSrc = readFileSync(join(ROOT, 'app/results/page.tsx'), 'utf8');
  const presentableSrc = readFileSync(
    join(ROOT, 'components/results/presentable-results-count.tsx'),
    'utf8',
  );
  const catalogLive = readFileSync(join(ROOT, 'components/results/catalog-live-section.tsx'), 'utf8');
  const stateSrc = readFileSync(join(ROOT, 'lib/search/catalog-live-page-state.ts'), 'utf8');
  assert.ok(pageSrc.includes('PresentableResultsCount'));
  assert.ok(presentableSrc.includes('getSharedResultsPoolReader')); // t334u: the pool is read via results-pool-reading.ts
  assert.ok(readFileSync(join(ROOT, 'lib/search/results-pool-reading.ts'), 'utf8').includes('bookableMembershipFromOverlaid'));
  assert.ok(presentableSrc.includes('loadPreparedResultsOffers'));
  assert.ok(presentableSrc.includes('exactOffers'));
  assert.ok(!presentableSrc.includes('loadPresentableResultsCount'));
  assert.ok(catalogLive.includes('paginationTotal'));
  assert.ok(stateSrc.includes('cache('));
  assert.ok(stateSrc.includes('paginationTotal'));
});
