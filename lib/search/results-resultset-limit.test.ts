import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  getResultsTotalPages,
  limitLivePricingCandidatePool,
  paginateResults,
  RESULTS_LIVE_PRICING_CANDIDATE_CAP,
  RESULTS_PAGE_SIZE_DEFAULT,
} from '@/lib/search/pagination';
import { filterOffers } from '@/lib/search/filtering';
import {
  prepareResultsOffers,
  rankCatalogOffers,
  slicePriceSortPoolPage,
} from '@/lib/search/prepare-results-offers';
import {
  evaluateResultsResultsetLimit,
  rankResultsMatchsetForLimit,
  resolveFilteringParamsForEarlyLimit,
} from '@/lib/search/results-resultset-limit';
import { orderCatalogPageCandidates } from '@/lib/search/results-catalog-page';
import { clearResultsLivePriceCache } from '@/lib/search/results-live-price-cache';
import type { TravelOffer } from '@/types/travel';

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider' | 'price'>,
): TravelOffer {
  const provider = overrides.provider;
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    pricePerDay: Math.round(overrides.price / 8),
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink:
      provider === 'Sunweb'
        ? 'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
          encodeURIComponent(
            'https://www.sunweb.be/nl/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-20',
          )
        : 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.200826.8.DZI-U',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    ...overrides,
  };
}

function catalogOf(count: number): TravelOffer[] {
  return Array.from({ length: count }, (_, index) => {
    const provider =
      index % 3 === 0 ? 'Corendon' : index % 3 === 1 ? 'Sunweb' : 'Eliza was here';
    return makeOffer({
      id: `${provider === 'Eliza was here' ? 'eliza' : provider.toLowerCase()}-${index}`,
      provider,
      price: 200 + (index % 500),
    });
  });
}

test('1. 9000 matches → no product cap; full count; not overLimit', () => {
  const catalog = catalogOf(9000);
  const evaluation = evaluateResultsResultsetLimit(catalog, { adults: 2 });
  assert.equal(evaluation.overLimit, false);
  assert.equal(evaluation.stoppedEarly, false);
  assert.equal(evaluation.matchCount, 9000);
  assert.equal(evaluation.scannedOffers, 9000);
});

test('2. 1001 matches → normal Results path (not refinement)', () => {
  const evaluation = evaluateResultsResultsetLimit(catalogOf(1001), { adults: 2 });
  assert.equal(evaluation.matchCount, 1001);
  assert.equal(evaluation.overLimit, false);
});

test('3. exact 1000 → normal Results flow', () => {
  const evaluation = evaluateResultsResultsetLimit(catalogOf(1000), { adults: 2 });
  assert.equal(evaluation.matchCount, 1000);
  assert.equal(evaluation.overLimit, false);
});

test('4. Results page has no overLimit early-return / refinement gate', () => {
  const pageSource = readFileSync(join(process.cwd(), 'app/results/page.tsx'), 'utf8');
  assert.equal(pageSource.includes('resultsetLimit.overLimit'), false);
  assert.equal(pageSource.includes('ResultsRefinementRequired'), false);
  assert.equal(pageSource.includes('refinementRequired'), false);
  assert.ok(pageSource.includes('await prepareResultsOffers'));
});

test('5. pagination works for resultsets well above 1000', async () => {
  clearResultsLivePriceCache();
  const catalog = catalogOf(2500);
  const prepared = await prepareResultsOffers(catalog, { adults: 2 });
  assert.equal(prepared.offers.length, 2500);

  const params = { adults: 2 };
  const browseable = orderCatalogPageCandidates(prepared.offers, params);
  assert.ok(browseable.length > 1000, `expected large browseable pool, got ${browseable.length}`);

  const page1 = slicePriceSortPoolPage(prepared.offers, 1, RESULTS_PAGE_SIZE_DEFAULT, {
    provisional: false,
    params,
  });
  assert.equal(page1.paginationTotal, browseable.length);
  assert.equal(page1.visibleOffers.length, 10);
  assert.equal(
    getResultsTotalPages(page1.paginationTotal, 10),
    Math.ceil(browseable.length / 10),
  );

  const lastPageNumber = getResultsTotalPages(browseable.length, 10);
  const lastPage = paginateResults(browseable, lastPageNumber, 10);
  assert.ok(lastPage.length > 0);
  assert.ok(lastPage.every((offer) => Boolean(offer.id)));

  const deepPage = paginateResults(browseable, 101, 10);
  assert.equal(deepPage.length, 10);
  assert.ok(deepPage.every((offer) => Boolean(offer.id)));
});

test('6. count path matches filterOffers for large filtered sets', () => {
  const catalog = [
    ...Array.from({ length: 1400 }, (_, index) =>
      makeOffer({
        id: `es-8-${index}`,
        provider: 'Corendon',
        price: 300 + (index % 100),
        destinationCountry: 'Spanje',
        departureDate: '2026-09-15',
        nights: 8,
      }),
    ),
    ...Array.from({ length: 600 }, (_, index) =>
      makeOffer({
        id: `gr-7-${index}`,
        provider: 'Sunweb',
        price: 400 + (index % 100),
        destinationCountry: 'Griekenland',
        departureDate: '2026-09-15',
        nights: 7,
      }),
    ),
  ];
  const params = {
    adults: 2,
    countries: ['Spanje'],
    departureStart: '2026-09-01',
    departureEnd: '2026-09-30',
    nights: [8],
  };
  const full = filterOffers(catalog, params);
  const early = evaluateResultsResultsetLimit(catalog, params);
  assert.equal(early.overLimit, false);
  assert.equal(early.matchCount, full.length);
  assert.equal(full.length, 1400);
  assert.ok(full.length > 1000);
  assert.deepEqual(
    resolveFilteringParamsForEarlyLimit(params).accommodationTypes,
    undefined,
  );
});

test('7. live-pricing candidate-cap remains 150 (not a user browse cap)', async () => {
  const catalog = catalogOf(2000);
  const ranked = rankCatalogOffers(catalog, { adults: 2, sort: 'price' });
  const liveWindow = limitLivePricingCandidatePool(ranked);
  assert.equal(liveWindow.length, RESULTS_LIVE_PRICING_CANDIDATE_CAP);
  assert.equal(RESULTS_LIVE_PRICING_CANDIDATE_CAP, 150);

  const prepared = await prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: (async () => new Response('{}', { status: 204 })) as typeof fetch,
  });
  assert.equal(prepared.offers.length, 2000);
  assert.equal(prepared.priceSortPending, true);
});

test('8. orderCatalogPageCandidates keeps full >1000 pool for pagination', () => {
  // Catalog-only ranking (no live HTTP / cache overlays) — product browse pool must not be capped at 1000.
  const ranked = rankCatalogOffers(catalogOf(1500), { adults: 2 });
  const ordered = orderCatalogPageCandidates(ranked);
  assert.equal(ordered.length, 1500);
  assert.ok(ordered.length > RESULTS_LIVE_PRICING_CANDIDATE_CAP);
  assert.equal(paginateResults(ordered, 150, 10).length, 10);
  assert.equal(getResultsTotalPages(ordered.length, 10), 150);
});

test('9. country / nights / budget filters stay correct without a cap', () => {
  const catalog = [
    ...Array.from({ length: 800 }, (_, i) =>
      makeOffer({
        id: `es-${i}`,
        provider: 'Corendon',
        price: 400,
        destinationCountry: 'Spanje',
        nights: 8,
        departureDate: '2026-09-10',
      }),
    ),
    ...Array.from({ length: 800 }, (_, i) =>
      makeOffer({
        id: `gr-${i}`,
        provider: 'Sunweb',
        price: 900,
        destinationCountry: 'Griekenland',
        nights: 8,
        departureDate: '2026-09-10',
      }),
    ),
  ];
  const spainOnly = evaluateResultsResultsetLimit(catalog, {
    adults: 2,
    countries: ['Spanje'],
  });
  assert.equal(spainOnly.matchCount, 800);
  assert.equal(spainOnly.overLimit, false);

  const budget = evaluateResultsResultsetLimit(catalog, {
    adults: 2,
    budgetMax: 500,
  });
  assert.equal(budget.overLimit, false);
  assert.ok(budget.matchCount >= 800);

  const ranked = rankResultsMatchsetForLimit(catalog, {
    adults: 2,
    countries: ['Spanje'],
    sort: 'price',
  });
  assert.equal(ranked.length, 800);
});

test('10. pagination.ts no longer defines RESULTS_USER_RESULTSET_MAX', () => {
  const paginationSrc = readFileSync(join(process.cwd(), 'lib/search/pagination.ts'), 'utf8');
  assert.equal(paginationSrc.includes('RESULTS_USER_RESULTSET_MAX'), false);
  assert.equal(paginationSrc.includes('isResultsResultsetOverLimit'), false);
  assert.match(paginationSrc, /RESULTS_LIVE_PRICING_CANDIDATE_CAP\s*=\s*150/);
});
