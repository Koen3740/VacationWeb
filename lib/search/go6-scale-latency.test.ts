import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  buildCatalogFilterIndex,
  narrowOfferIndicesWithIndex,
  offersFromIndices,
} from '@/lib/offers/catalog-filter-index';
import { RESULTS_LIVE_PRICING_CANDIDATE_CAP } from '@/lib/search/pagination';
import { sliceRankedCatalogResultsPage } from '@/lib/search/results-catalog-page';
import type { SearchParams, TravelOffer } from '@/types/travel';

const ROOT = process.cwd();

test('GO6: Results shell does not await prepareResultsOffers before price-sort branch', () => {
  const pageSrc = readFileSync(join(ROOT, 'app/results/page.tsx'), 'utf8');
  const shellPart = pageSrc.split('isPriceDependentSort')[0];
  assert.ok(!shellPart.includes('await prepareResultsOffers'));
  assert.ok(pageSrc.includes('CatalogLiveSection'));
  assert.ok(pageSrc.includes('PresentableResultsCount'));
  assert.ok(pageSrc.includes('GO6'));
});

test('GO6: CatalogLiveBody prepares inside Suspense via shared cache helper', () => {
  const catalogLive = readFileSync(join(ROOT, 'components/results/catalog-live-section.tsx'), 'utf8');
  assert.ok(catalogLive.includes('loadPreparedResultsOffers'));
  assert.ok(catalogLive.includes('loadCatalogLivePageState'));
  assert.ok(catalogLive.includes('scheduleCappedMatchsetLiveAfterPage'));
  assert.ok(!catalogLive.includes('filtered: TravelOffer'));
});

test('GO6: PresentableResultsCount prepares via shared cache (no filtered prop)', () => {
  const presentable = readFileSync(join(ROOT, 'components/results/presentable-results-count.tsx'), 'utf8');
  assert.ok(presentable.includes('loadPreparedResultsOffers'));
  assert.ok(presentable.includes('countResultsPool') || presentable.includes('loadPreparedResultsOffers'));
  assert.ok(!presentable.includes('filtered: TravelOffer'));
});

test('GO6: browse slice caps presentable work at live-pricing window (150)', () => {
  assert.equal(RESULTS_LIVE_PRICING_CANDIDATE_CAP, 150);
  const ranked = Array.from({ length: 400 }, (_, i) => ({
    id: `o-${i}`,
    provider: 'Sunweb',
    destinationCountry: 'Griekenland',
    nights: 8,
    departureDate: '2026-10-10',
    departureAirport: 'BRU',
  })) as unknown as TravelOffer[];
  const page = sliceRankedCatalogResultsPage(ranked, 1, 10, { adults: 2 } as SearchParams);
  assert.ok(page.paginationTotal <= RESULTS_LIVE_PRICING_CANDIDATE_CAP);
});

test('GO6: catalog filter index narrows by country + nights + airport', () => {
  const offers = [
    {
      id: 'a',
      provider: 'Sunweb',
      destinationCountry: 'Turkije',
      nights: 8,
      departureDate: '2026-10-10',
      departureAirport: 'BRU',
    },
    {
      id: 'b',
      provider: 'Sunweb',
      destinationCountry: 'Turkije',
      nights: 8,
      departureDate: '2026-10-10',
      departureAirport: 'AMS',
    },
    {
      id: 'c',
      provider: 'Sunweb',
      destinationCountry: 'Griekenland',
      nights: 8,
      departureDate: '2026-10-10',
      departureAirport: 'BRU',
    },
  ] as unknown as TravelOffer[];
  const index = buildCatalogFilterIndex(offers);
  const params = {
    countries: ['Turkije'],
    nights: [8],
    departureAirport: 'BRU,CRL',
  } as SearchParams;
  const indices = narrowOfferIndicesWithIndex(
    index,
    params,
    (p) => (p.countries?.length ? [...p.countries] : p.country ? [p.country] : []),
    (raw) =>
      (raw ?? '')
        .split(',')
        .map((a) => a.trim().toUpperCase())
        .filter(Boolean),
  );
  assert.ok(indices !== null);
  const narrowed = offersFromIndices(offers, indices!);
  assert.deepEqual(
    narrowed.map((o) => o.id),
    ['a'],
  );
});

test('GO6: prepared-results-request wires in-memory index around prepare', () => {
  const prepared = readFileSync(join(ROOT, 'lib/search/prepared-results-request.ts'), 'utf8');
  const index = readFileSync(join(ROOT, 'lib/offers/catalog-filter-index.ts'), 'utf8');
  assert.ok(prepared.includes('loadPreparedResultsOffers'));
  assert.ok(prepared.includes('withCatalogFilterIndexAsync'));
  assert.ok(index.includes('buildCatalogFilterIndex'));
  assert.ok(index.includes('narrowOfferIndicesWithIndex'));
});
