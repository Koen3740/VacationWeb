import assert from 'node:assert/strict';
import test from 'node:test';
import { sortOffers } from './filtering';
import {
  getResultsTotalPages,
  limitRankedResultsForPagination,
  paginateResults,
  RESULTS_PAGE_SIZE_DEFAULT,
  RESULTS_USER_PAGINATION_CAP,
} from './pagination';
import type { TravelOffer } from '../feeds/canonical/travel-offer';

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'price'>,
): TravelOffer {
  return {
    provider: 'Sunweb',
    hotelName: 'Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    pricePerDay: Math.round(overrides.price / 8),
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://example.com',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    stars: 3,
    ...overrides,
  };
}

function ranked921(): TravelOffer[] {
  return Array.from({ length: 921 }, (_, index) =>
    makeOffer({
      id: `offer-${index}`,
      price: 100 + index,
      stars: (index % 5) + 1,
    }),
  );
}

test('A. 921 matches: ranking stays complete; user pagination is 150 / 15 pages', () => {
  const matchset = ranked921();
  const ranked = sortOffers(matchset, 'price');
  assert.equal(ranked.length, 921);
  const userPool = limitRankedResultsForPagination(ranked);
  assert.equal(userPool.length, RESULTS_USER_PAGINATION_CAP);
  assert.equal(getResultsTotalPages(userPool.length, RESULTS_PAGE_SIZE_DEFAULT), 15);
  assert.equal(paginateResults(userPool, 16, RESULTS_PAGE_SIZE_DEFAULT).length, 0);
});

test('B. price low→high: top 150 come from the full 921', () => {
  const ranked = sortOffers(ranked921(), 'price');
  const userPool = limitRankedResultsForPagination(ranked);
  assert.equal(userPool[0].id, 'offer-0');
  assert.equal(userPool[149].id, 'offer-149');
  assert.ok(!userPool.some((offer) => offer.id === 'offer-920'));
  assert.equal(ranked[920].id, 'offer-920');
});

test('C. price high→low: top 150 come from the full 921', () => {
  const ranked = sortOffers(ranked921(), 'price-desc');
  const userPool = limitRankedResultsForPagination(ranked);
  assert.equal(userPool[0].id, 'offer-920');
  assert.equal(userPool[149].id, 'offer-771');
  assert.ok(!userPool.some((offer) => offer.id === 'offer-0'));
  assert.equal(ranked[920].id, 'offer-0');
});

test('D. stars: top 150 after existing ranking of all 921', () => {
  const ranked = sortOffers(ranked921(), 'stars');
  assert.equal(ranked.length, 921);
  const userPool = limitRankedResultsForPagination(ranked);
  assert.equal(userPool.length, 150);
  assert.ok(userPool.every((offer) => (offer.stars ?? 0) === 5));
  assert.ok(ranked.slice(150).some((offer) => (offer.stars ?? 0) < 5));
});

test('M. page 16 does not exist; 150-cap is after sort', () => {
  const ranked = sortOffers(ranked921(), 'price');
  const userPool = limitRankedResultsForPagination(ranked);
  assert.equal(getResultsTotalPages(921, 10), 93, 'raw match count must not be used as pagination');
  assert.equal(getResultsTotalPages(userPool.length, 10), 15);
  assert.deepEqual(paginateResults(userPool, 15, 10).map((offer) => offer.id), [
    'offer-140',
    'offer-141',
    'offer-142',
    'offer-143',
    'offer-144',
    'offer-145',
    'offer-146',
    'offer-147',
    'offer-148',
    'offer-149',
  ]);
  assert.deepEqual(paginateResults(userPool, 16, 10), []);
});
