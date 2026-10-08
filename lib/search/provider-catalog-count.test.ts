import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  countCatalogMatchset,
  countCatalogMatchsetForSearch,
  selectDisplayedResultsCount,
  usesCatalogResultsDisplayCount,
} from '@/lib/search/results-pool-count';
import type { TravelOffer } from '@/types/travel';

function offer(id: string, provider: string): TravelOffer {
  return {
    id,
    provider,
    hotelName: `Hotel ${id}`,
    destinationCountry: 'Spanje',
    departureDate: '2026-10-10',
    departureAirport: 'BRU',
    nights: 8,
    flightIncluded: 'true',
    price: 400,
    pricePerDay: 50,
    currency: 'EUR',
    imageUrl: '/images/results-card-placeholder.png',
    deepLink: `https://example.com/${id}`,
    livePriceStatus: 'catalog',
  };
}

describe('provider-filtered catalog count is the current search, not the global matchset', () => {
  const globalMatchset = [
    ...Array.from({ length: 80 }, (_, index) => offer(`eliza-${index}`, 'Eliza was here')),
    ...Array.from({ length: 8114 }, (_, index) => offer(`other-${index}`, 'Sunweb')),
  ];

  it('global catalogCount stays 8194; Eliza subset is its own catalogCount', () => {
    assert.equal(countCatalogMatchset(globalMatchset), 8194);
    assert.equal(countCatalogMatchsetForSearch(globalMatchset, { provider: undefined }), 8194);
    assert.equal(
      countCatalogMatchsetForSearch(globalMatchset, { provider: 'Eliza was here' }),
      80,
    );
    assert.notEqual(
      countCatalogMatchsetForSearch(globalMatchset, { provider: 'Eliza was here' }),
      countCatalogMatchset(globalMatchset),
    );
  });

  it('150-rule uses the scoped catalogCount, not the global 8194', () => {
    const scoped = countCatalogMatchsetForSearch(globalMatchset, {
      provider: 'Eliza was here',
    });
    assert.equal(usesCatalogResultsDisplayCount(8194), true);
    assert.equal(usesCatalogResultsDisplayCount(scoped), false);
    assert.equal(selectDisplayedResultsCount(scoped, 42), 42);
    assert.notEqual(selectDisplayedResultsCount(scoped, 42), 8194);
  });

  it('provider catalog > 150 still displays that provider catalog, not Proven-B', () => {
    const matchset = [
      ...Array.from({ length: 200 }, (_, index) => offer(`eliza-${index}`, 'Eliza was here')),
      ...Array.from({ length: 8000 }, (_, index) => offer(`other-${index}`, 'Sunweb')),
    ];
    const scoped = countCatalogMatchsetForSearch(matchset, { provider: 'Eliza was here' });
    assert.equal(scoped, 200);
    assert.equal(usesCatalogResultsDisplayCount(scoped), true);
    assert.equal(selectDisplayedResultsCount(scoped, 90), 200);
  });

  it('heading and catalog live scope before display count / page work', () => {
    const heading = readFileSync('components/results/presentable-results-count.tsx', 'utf8');
    const catalogLive = readFileSync('components/results/catalog-live-section.tsx', 'utf8');
    assert.match(heading, /countCatalogMatchsetForSearch\(prepared\.offers,\s*countParams\)/);
    assert.doesNotMatch(heading, /omitProviderFilter\(filteringParams\)/);
    assert.match(
      catalogLive,
      /scopeOffersToProviderFilter\(prepared\.offers,\s*filteringParams\)/,
    );
    assert.match(
      catalogLive,
      /scheduleCappedMatchsetLiveAfterPage\(filtered/,
    );
  });
});
