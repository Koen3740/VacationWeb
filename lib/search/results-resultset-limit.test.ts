import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getResultsTotalPages,
  limitLivePricingCandidatePool,
  paginateResults,
  RESULTS_LIVE_PRICING_CANDIDATE_CAP,
  RESULTS_PAGE_SIZE_DEFAULT,
  RESULTS_USER_RESULTSET_MAX,
} from '@/lib/search/pagination';
import {
  prepareResultsOffers,
  rankCatalogOffers,
  slicePriceSortPoolPage,
} from '@/lib/search/prepare-results-offers';
import {
  evaluateResultsResultsetLimit,
  rankResultsMatchsetForLimit,
} from '@/lib/search/results-resultset-limit';
import { orderCatalogPageCandidates } from '@/lib/search/results-catalog-page';
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

test('9000 matches → refinement state, not a 150-result user set', () => {
  const catalog = catalogOf(9000);
  const evaluation = evaluateResultsResultsetLimit(catalog, { adults: 2 });
  assert.equal(evaluation.matchCount, 9000);
  assert.equal(evaluation.overLimit, true);
  assert.notEqual(evaluation.matchCount, RESULTS_LIVE_PRICING_CANDIDATE_CAP);
});

test('1001 matches → refinement state', () => {
  const evaluation = evaluateResultsResultsetLimit(catalogOf(1001), { adults: 2 });
  assert.equal(evaluation.matchCount, 1001);
  assert.equal(evaluation.overLimit, true);
});

test('1000 matches → normal Results flow (not over limit)', () => {
  const evaluation = evaluateResultsResultsetLimit(catalogOf(1000), { adults: 2 });
  assert.equal(evaluation.matchCount, RESULTS_USER_RESULTSET_MAX);
  assert.equal(evaluation.overLimit, false);
});

test('999 matches → normal Results flow', () => {
  const evaluation = evaluateResultsResultsetLimit(catalogOf(999), { adults: 2 });
  assert.equal(evaluation.matchCount, 999);
  assert.equal(evaluation.overLimit, false);
});

test('limit check uses full filter+rank before cap; price sort included', () => {
  const catalog = catalogOf(1500);
  const ranked = rankResultsMatchsetForLimit(catalog, { adults: 2, sort: 'price' });
  assert.equal(ranked.length, 1500);
  assert.equal(rankCatalogOffers(catalog, { adults: 2, sort: 'price' }).length, 1500);
});

test('9000-match refinement path must not trigger thousands of live-pricing HTTP calls', async () => {
  const catalog = catalogOf(9000);
  const evaluation = evaluateResultsResultsetLimit(catalog, { adults: 2, sort: 'price' });
  assert.equal(evaluation.overLimit, true);

  const http = { posts: 0, urls: [] as string[] };
  const fetchImpl = (async () => {
    http.posts += 1;
    return new Response('{}', { status: 204 });
  }) as typeof fetch;

  if (!evaluation.overLimit) {
    await prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, { fetchImpl });
  }

  assert.equal(http.posts, 0, 'over-limit searches must skip prepareResultsOffers live pricing');
});

test('999 matches: pagination not capped at 150; live window stays separate', async () => {
  const catalog = catalogOf(999);
  const evaluation = evaluateResultsResultsetLimit(catalog, { adults: 2 });
  assert.equal(evaluation.overLimit, false);

  const prepared = await prepareResultsOffers(catalog, { adults: 2 });
  assert.equal(prepared.offers.length, 999);
  assert.ok(prepared.offers.length > RESULTS_LIVE_PRICING_CANDIDATE_CAP);

  const page = slicePriceSortPoolPage(prepared.offers, 1, RESULTS_PAGE_SIZE_DEFAULT, {
    provisional: false,
    params: { adults: 2 },
  });
  assert.equal(page.paginationTotal, 999);
  assert.notEqual(page.paginationTotal, RESULTS_LIVE_PRICING_CANDIDATE_CAP);
  assert.equal(getResultsTotalPages(page.paginationTotal, 10), 100);
});

test('1000 matches: normal pagination total equals full ranked set', async () => {
  const catalog = catalogOf(1000);
  const prepared = await prepareResultsOffers(catalog, { adults: 2 });
  assert.equal(prepared.offers.length, 1000);
  const ordered = orderCatalogPageCandidates(prepared.offers, { adults: 2 });
  assert.ok(ordered.length > RESULTS_LIVE_PRICING_CANDIDATE_CAP);
  assert.equal(paginateResults(prepared.offers, 16, 10).length, 10);
});

test('price-sort live window stays ≤150 under the 1000 user limit', async () => {
  const catalog = catalogOf(999);
  const ranked = rankCatalogOffers(catalog, { adults: 2, sort: 'price' });
  const liveWindow = limitLivePricingCandidatePool(ranked);
  assert.equal(liveWindow.length, RESULTS_LIVE_PRICING_CANDIDATE_CAP);

  const prepared = await prepareResultsOffers(catalog, { adults: 2, sort: 'price' }, {
    fetchImpl: (async () => new Response('{}', { status: 204 })) as typeof fetch,
  });
  assert.equal(prepared.offers.length, 999);
  assert.equal(prepared.priceSortPending, true);
});

test('provider diversity preserved below the 1000 user limit', async () => {
  const catalog = catalogOf(999);
  const prepared = await prepareResultsOffers(catalog, { adults: 2 });
  const providers = new Set(prepared.offers.map((offer) => offer.provider));
  assert.ok(providers.has('Corendon'));
  assert.ok(providers.has('Sunweb'));
  assert.ok(providers.has('Eliza was here'));
});
