import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  RESULTS_LIVE_PRICE_TTL_MS,
  applyResultsLivePriceOverlays,
  clearResultsLivePriceCache,
  getResultsLivePriceOverlay,
  hasResultsLivePriceOverlay,
  livePriceCacheKey,
  setResultsLivePriceNowMsForTests,
  setResultsLivePriceOverlay,
} from './results-live-price-cache';
import type { TravelOffer } from '../../types/travel';

afterEach(() => {
  clearResultsLivePriceCache();
  setResultsLivePriceNowMsForTests(null);
});

const occupancy = { adults: 2, children: 0, babies: 0, rooms: 1 } as const;

const proven = {
  price: 410,
  pricePerDay: 51,
  livePriceStatus: 'proven' as const,
  livePriceSource: 'receipt' as const,
};

test('cache key includes listing and party without breaking occupancy-only keys', () => {
  assert.equal(livePriceCacheKey('prijsvrij-1-2026-08-20-8-400-AI', occupancy), '2|0|0|1|prijsvrij-1-2026-08-20-8-400-AI');
  assert.notEqual(
    livePriceCacheKey('prijsvrij-1-2026-08-20-8-400-AI', occupancy),
    livePriceCacheKey('prijsvrij-1-2026-08-21-8-400-AI', occupancy),
  );
  assert.notEqual(
    livePriceCacheKey('a', occupancy),
    livePriceCacheKey('a', { ...occupancy, adults: 3 }),
  );
  assert.notEqual(
    livePriceCacheKey('a', occupancy),
    livePriceCacheKey('a', { ...occupancy, rooms: 2 }),
  );
  assert.notEqual(
    livePriceCacheKey('corendon-1', { ...occupancy, listingKey: 'www.corendon.be|corendon-benl' }),
    livePriceCacheKey('corendon-1', { ...occupancy, listingKey: 'www.corendon.nl|corendon-nl' }),
  );
  assert.notEqual(
    livePriceCacheKey('corendon-1', occupancy),
    livePriceCacheKey('corendon-1', {
      ...occupancy,
      party: [{ dateOfBirth: '1975-03-12', roomIndex: 0 }, { dateOfBirth: '1978-06-04', roomIndex: 0 }],
    }),
  );
});

test('same offer + same occupancy is a hit; different occupancy or offer is a miss', () => {
  setResultsLivePriceOverlay('pv-1', occupancy, proven);
  assert.equal(hasResultsLivePriceOverlay('pv-1', occupancy), true);
  assert.equal(getResultsLivePriceOverlay('pv-1', occupancy)?.price, 410);
  assert.equal(hasResultsLivePriceOverlay('pv-1', { ...occupancy, children: 1 }), false);
  assert.equal(hasResultsLivePriceOverlay('pv-2', occupancy), false);
});

test('expired overlay is a miss and is dropped', () => {
  const t0 = 1_000_000;
  setResultsLivePriceNowMsForTests(t0);
  setResultsLivePriceOverlay('pv-1', occupancy, proven);
  setResultsLivePriceNowMsForTests(t0 + RESULTS_LIVE_PRICE_TTL_MS);
  assert.equal(hasResultsLivePriceOverlay('pv-1', occupancy), true);
  setResultsLivePriceNowMsForTests(t0 + RESULTS_LIVE_PRICE_TTL_MS + 1);
  assert.equal(hasResultsLivePriceOverlay('pv-1', occupancy), false);
  assert.equal(getResultsLivePriceOverlay('pv-1', occupancy), undefined);
});

test('overlay application uses cached live price for ranking inputs', () => {
  const offer = {
    id: 'pv-1',
    provider: 'Prijsvrij',
    hotelName: 'H',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 900,
    pricePerDay: 112,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://example.com',
  } as TravelOffer;
  setResultsLivePriceOverlay('pv-1', occupancy, proven);
  const [overlaid] = applyResultsLivePriceOverlays([offer], occupancy);
  assert.equal(overlaid.price, 410);
  assert.equal(overlaid.livePriceStatus, 'proven');
});

test('Corendon occupancy-unpriced overlay applies from the base cache key', () => {
  const offer = {
    id: 'corendon-1',
    provider: 'Corendon',
    hotelName: 'H',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 458,
    pricePerDay: 57,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U',
  } as TravelOffer;
  const fourPax = {
    adults: 2,
    children: 2,
    rooms: 2,
    party: [
      { dateOfBirth: '1990-01-15', roomIndex: 0 },
      { dateOfBirth: '1988-03-03', roomIndex: 0 },
      { dateOfBirth: '2014-06-14', roomIndex: 1 },
      { dateOfBirth: '2018-01-22', roomIndex: 1 },
    ],
  };
  setResultsLivePriceOverlay(offer.id, fourPax, {
    price: 458,
    pricePerDay: 57,
    livePriceStatus: 'unpriced',
  });
  const [overlaid] = applyResultsLivePriceOverlays([offer], fourPax);
  assert.equal(overlaid.livePriceStatus, 'unpriced');
  assert.equal(overlaid.livePriceSource, undefined);
});
