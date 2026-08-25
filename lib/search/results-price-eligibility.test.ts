import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { TravelOffer } from '@/types/travel';
import {
  LIVE_PRICE_ATTEMPT_REASON,
  LIVE_PRICE_ATTEMPT_STATUS,
  clearLivePriceObservabilityForTests,
  recordOfferLivePriceAttempt,
} from '@/lib/search/live-price-observability';
import {
  classifyResultsPriceEligibility,
  clearResultsPriceEligibilityForTests,
  measureResultsPriceEligibility,
} from '@/lib/search/results-price-eligibility';
import {
  CORENDON_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
  PRIJSVRIJ_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
} from '@/lib/search/presentable-price';

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 400,
    pricePerDay: 50,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://example.com',
    ...overrides,
  };
}

beforeEach(() => {
  clearResultsPriceEligibilityForTests();
  clearLivePriceObservabilityForTests();
});

test('eligibility counts unique offers, not repeated rows', () => {
  const proven = makeOffer({
    id: 'corendon-1',
    provider: CORENDON_PROVIDER_NAME,
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    price: 626,
    liveTotalPrice: 1893,
    liveTotalPriceField: 'upsales.totalPrice',
  });
  const snapshot = measureResultsPriceEligibility([proven, { ...proven }], { adults: 2, rooms: 1 });
  assert.equal(snapshot.uniqueOffers, 1);
  assert.equal(snapshot.byProvider[CORENDON_PROVIDER_NAME]?.beforeGate, 1);
  assert.equal(snapshot.byProvider[CORENDON_PROVIDER_NAME]?.SUCCESS, 1);
  assert.equal(snapshot.shown, 1);
  assert.equal(snapshot.excluded, 0);
});

test('UNPRICED / UNAVAILABLE / feed without proof are excluded from Results', () => {
  const offers = [
    makeOffer({
      id: 'cor-ok',
      provider: CORENDON_PROVIDER_NAME,
      livePriceStatus: 'proven',
      livePriceSource: 'upsales',
      price: 626,
      liveTotalPrice: 1893,
      liveTotalPriceField: 'upsales.totalPrice',
    }),
    makeOffer({
      id: 'cor-unpriced',
      provider: CORENDON_PROVIDER_NAME,
      livePriceStatus: 'unpriced',
      price: 458,
    }),
    makeOffer({
      id: 'cor-unavail',
      provider: CORENDON_PROVIDER_NAME,
      livePriceStatus: 'unavailable',
      price: 458,
    }),
    makeOffer({
      id: 'sun-feed',
      provider: SUNWEB_PROVIDER_NAME,
      livePriceStatus: 'catalog',
      livePriceSource: 'feed',
      price: 400,
    }),
    makeOffer({
      id: 'eliza-ok',
      provider: ELIZA_PROVIDER_NAME,
      livePriceStatus: 'proven',
      livePriceSource: 'getPromotedPrice',
      price: 672,
      liveTotalPrice: 1901,
      liveTotalPriceField: 'getPromotedPrice.totalPrice',
    }),
    makeOffer({
      id: 'pv-unpriced',
      provider: PRIJSVRIJ_PROVIDER_NAME,
      livePriceStatus: 'unpriced',
      price: 999,
    }),
  ];
  const snapshot = measureResultsPriceEligibility(offers, { adults: 2, rooms: 1 });
  assert.equal(classifyResultsPriceEligibility(offers[1]), 'UNPRICED');
  assert.equal(classifyResultsPriceEligibility(offers[2]), 'UNAVAILABLE');
  assert.equal(classifyResultsPriceEligibility(offers[3]), 'NO_PROVEN_PRICE');
  assert.equal(snapshot.byProvider[CORENDON_PROVIDER_NAME]?.beforeGate, 3);
  assert.equal(snapshot.byProvider[CORENDON_PROVIDER_NAME]?.SUCCESS, 1);
  assert.equal(snapshot.byProvider[CORENDON_PROVIDER_NAME]?.UNPRICED, 1);
  assert.equal(snapshot.byProvider[CORENDON_PROVIDER_NAME]?.UNAVAILABLE, 1);
  assert.equal(snapshot.byProvider[CORENDON_PROVIDER_NAME]?.excluded, 2);
  assert.equal(snapshot.byProvider[SUNWEB_PROVIDER_NAME]?.NO_PROVEN_PRICE, 1);
  assert.equal(snapshot.byProvider[SUNWEB_PROVIDER_NAME]?.shown, 0);
  assert.equal(snapshot.byProvider[ELIZA_PROVIDER_NAME]?.SUCCESS, 1);
  assert.equal(snapshot.byProvider[PRIJSVRIJ_PROVIDER_NAME]?.UNPRICED, 1);
  assert.equal(snapshot.byProvider[PRIJSVRIJ_PROVIDER_NAME]?.shown, 0);
  assert.equal(snapshot.shown, 2);
  assert.equal(snapshot.excluded, 4);
});

test('ERROR unique-offer counts come from attempts, not from repeating the same holiday', () => {
  const offer = makeOffer({ id: 'corendon-err', provider: CORENDON_PROVIDER_NAME });
  recordOfferLivePriceAttempt(offer, { adults: 2, rooms: 1 }, {
    status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
    reason: LIVE_PRICE_ATTEMPT_REASON.network_error,
  });
  recordOfferLivePriceAttempt(offer, { adults: 2, rooms: 1 }, {
    status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
    reason: LIVE_PRICE_ATTEMPT_REASON.network_error,
  });
  const snapshot = measureResultsPriceEligibility(
    [{ ...offer, livePriceStatus: 'unavailable' }],
    { adults: 2, rooms: 1 },
  );
  assert.equal(snapshot.errorAttempts, 2);
  assert.equal(snapshot.errorUniqueByProvider[CORENDON_PROVIDER_NAME], 1);
  assert.equal(snapshot.byProvider[CORENDON_PROVIDER_NAME]?.UNAVAILABLE, 1);
});
