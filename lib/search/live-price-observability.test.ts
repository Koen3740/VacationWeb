import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { SearchParams, TravelOffer } from '@/types/travel';
import {
  clearLivePriceInflightForTests,
  priceLiveRequiredMatchset,
  pricePage1WithPrijsvrijReceipts,
} from '@/lib/providers/prijsvrij';
import { PRIJSVRIJ_PROVIDER_NAME } from '@/lib/providers/prijsvrij/constants';
import { clearPrijsvrijReceiptTokenCache } from '@/lib/providers/prijsvrij/receipt-auth';
import { clearResultsLivePriceCache } from '@/lib/search/results-live-price-cache';
import {
  hasValidPresentablePrice,
  isResultsVisibleOffer,
  isUnpricedResultsOffer,
} from '@/lib/search/presentable-price';
import {
  LIVE_PRICE_ATTEMPT_REASON,
  LIVE_PRICE_ATTEMPT_STATUS,
  classifyLivePriceFailure,
  clearLivePriceObservabilityForTests,
  getLivePriceObservabilitySnapshot,
  isRetryableTechnicalLivePriceFailure,
  livePriceTelemetryContainsPersonalData,
  recordLivePriceAttempt,
  type LivePriceAttemptEvent,
} from '@/lib/search/live-price-observability';

const CORENDON_FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';

const FOUR_PAX: SearchParams = {
  adults: 4,
  rooms: 2,
  party: [
    { dateOfBirth: '1990-01-15', roomIndex: 0 },
    { dateOfBirth: '1988-03-03', roomIndex: 0 },
    { dateOfBirth: '2014-06-14', roomIndex: 1 },
    { dateOfBirth: '2018-01-22', roomIndex: 1 },
  ],
};

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    departureDate: '2026-08-27',
    departureAirport: 'BRU',
    nights: 4,
    flightIncluded: 'true',
    price: 458,
    pricePerDay: 115,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://example.com',
    ...overrides,
  };
}

function makeCorendonOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return makeOffer({
    id: 'corendon-9514',
    provider: 'Corendon',
    feedSourceId: 'corendon-benl',
    listingHost: 'www.corendon.be',
    deepLink: `https://www.corendon.be/vakantie#${CORENDON_FRAGMENT}`,
    ...overrides,
  });
}

function okLowestBody(price = 876): string {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: '2026-08-27T00:00:00',
        trip: {
          price,
          tripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
          tripUrlHash:
            '[filters]BEL/BRU.*.*.*.0|||9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU|||true',
          priceTableDate: '20260827',
          durationInDays: 5,
        },
      },
    },
  });
}

function okUpsalesBody(pricePerPerson = 600): string {
  return JSON.stringify({
    result: {
      extendedTripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
      prices: {
        totalPrice: pricePerPerson * 4,
        priceTableCalculatedPricePerPerson: pricePerPerson,
      },
      selectedTripCudl: {
        selectedTrip: {
          system: { request: { departureDate: '2026-08-27' } },
        },
      },
    },
  });
}

function makeLiveFetch(options: {
  lowestStatus?: number;
  throwOnLowest?: boolean;
} = {}): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('lowestpricesacco')) {
      if (options.throwOnLowest) {
        throw new Error('socket hang up');
      }
      const status = options.lowestStatus ?? 200;
      if (status === 204) {
        return new Response(null, { status: 204 });
      }
      return new Response(okLowestBody(), { status });
    }
    if (url.includes('/upsales')) {
      return new Response(okUpsalesBody(), { status: 200 });
    }
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 't'.repeat(40) }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };
}

beforeEach(() => {
  clearPrijsvrijReceiptTokenCache();
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
  clearLivePriceObservabilityForTests();
});

test('status definitions are strict and not interchangeable', () => {
  assert.equal(LIVE_PRICE_ATTEMPT_STATUS.SUCCESS, 'SUCCESS');
  assert.equal(LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE, 'UNAVAILABLE');
  assert.equal(LIVE_PRICE_ATTEMPT_STATUS.UNPRICED, 'UNPRICED');
  assert.equal(LIVE_PRICE_ATTEMPT_STATUS.ERROR, 'ERROR');
  assert.notEqual(LIVE_PRICE_ATTEMPT_STATUS.SUCCESS, LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE);
  assert.notEqual(LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE, LIVE_PRICE_ATTEMPT_STATUS.UNPRICED);
  assert.notEqual(LIVE_PRICE_ATTEMPT_STATUS.UNPRICED, LIVE_PRICE_ATTEMPT_STATUS.ERROR);
  assert.deepEqual(classifyLivePriceFailure({ reason: 'empty', httpStatus: 204 }), {
    status: LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE,
    reason: LIVE_PRICE_ATTEMPT_REASON.http_204,
  });
  assert.deepEqual(classifyLivePriceFailure({ reason: 'exception' }), {
    status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
    reason: LIVE_PRICE_ATTEMPT_REASON.exception,
  });
  assert.deepEqual(classifyLivePriceFailure({ reason: 'unavailable_trip' }), {
    status: LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE,
    reason: LIVE_PRICE_ATTEMPT_REASON.unavailable_trip,
  });
  assert.deepEqual(classifyLivePriceFailure({ reason: 'stale_context' }), {
    status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
    reason: LIVE_PRICE_ATTEMPT_REASON.stale_context,
  });
  assert.equal(isRetryableTechnicalLivePriceFailure({ reason: 'timeout' }), true);
  assert.equal(isRetryableTechnicalLivePriceFailure({ reason: 'network_error' }), true);
  assert.equal(isRetryableTechnicalLivePriceFailure({ reason: 'exception' }), true);
  assert.equal(isRetryableTechnicalLivePriceFailure({ reason: 'http_error', httpStatus: 503 }), true);
  assert.equal(isRetryableTechnicalLivePriceFailure({ reason: 'http_error', httpStatus: 429 }), true);
  assert.equal(isRetryableTechnicalLivePriceFailure({ reason: 'http_error', httpStatus: 404 }), false);
  assert.equal(isRetryableTechnicalLivePriceFailure({ reason: 'empty', httpStatus: 204 }), false);
  assert.equal(isRetryableTechnicalLivePriceFailure({ reason: 'unavailable_trip' }), false);
  assert.equal(isRetryableTechnicalLivePriceFailure({ reason: 'circuit_open' }), false);
  assert.deepEqual(classifyLivePriceFailure({ reason: 'circuit_open' }), {
    status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
    reason: LIVE_PRICE_ATTEMPT_REASON.circuit_open,
  });
  assert.notEqual(
    classifyLivePriceFailure({ reason: 'empty', httpStatus: 204 }).status,
    LIVE_PRICE_ATTEMPT_STATUS.UNPRICED,
  );
});

test('proven 2A Corendon live price → SUCCESS', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeCorendonOffer()],
    { adults: 2, rooms: 1 },
    { fetchImpl: makeLiveFetch() },
  );
  const [priced] = await priceLiveRequiredMatchset(
    [makeCorendonOffer()],
    { adults: 2, rooms: 1 },
    { fetchImpl: makeLiveFetch() },
  );

  assert.equal(page.length, 1);
  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.livePriceSource, 'upsales');
  assert.equal(isResultsVisibleOffer(priced), true);
  assert.equal(hasValidPresentablePrice(priced), true);

  const snapshot = getLivePriceObservabilitySnapshot();
  assert.equal(snapshot.attempts, 1);
  assert.equal(snapshot.success, 1);
  assert.equal(snapshot.unavailable, 0);
  assert.equal(snapshot.unpriced, 0);
  assert.equal(snapshot.error, 0);
  assert.equal(snapshot.byProvider.Corendon?.SUCCESS, 1);
  assert.equal(snapshot.uniqueOffersByProvider.Corendon?.SUCCESS, 1);
  assert.equal(snapshot.byOccupancyCategory['2A / 1R']?.SUCCESS, 1);
  assert.equal(snapshot.recent[0]?.reason, LIVE_PRICE_ATTEMPT_REASON.proven_live_price);
  assert.equal(snapshot.recent[0]?.listingHost, 'www.corendon.be');
  assert.equal(snapshot.recent[0]?.feedSourceId, 'corendon-benl');
  assert.equal(snapshot.recent[0]?.departureAirport, 'BRU');
});

test('204 / proven unavailable → UNAVAILABLE and Results hides the offer', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeCorendonOffer()],
    { adults: 2, rooms: 1 },
    { fetchImpl: makeLiveFetch({ lowestStatus: 204 }) },
  );

  assert.equal(page.length, 0);
  const snapshot = getLivePriceObservabilitySnapshot();
  assert.equal(snapshot.attempts, 1);
  assert.equal(snapshot.unavailable, 1);
  assert.equal(snapshot.success, 0);
  assert.equal(snapshot.unpriced, 0);
  assert.equal(snapshot.error, 0);
  assert.equal(snapshot.recent[0]?.status, LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE);
  assert.equal(snapshot.recent[0]?.reason, LIVE_PRICE_ATTEMPT_REASON.http_204);
});

test('4 travellers / 2 rooms: Corendon upsales SUCCESS; Prijsvrij stays UNPRICED', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeCorendonOffer(),
      makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 999 }),
    ],
    FOUR_PAX,
    { fetchImpl: makeLiveFetch() },
  );

  assert.equal(page.length, 1);
  const cor = page.find((offer) => offer.provider === 'Corendon');
  const pv = page.find((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME);
  assert.ok(cor);
  assert.equal(pv, undefined);
  assert.equal(cor.livePriceStatus, 'proven');
  assert.equal(cor.livePriceSource, 'upsales');
  assert.equal(hasValidPresentablePrice(cor), true);

  const snapshot = getLivePriceObservabilitySnapshot();
  assert.equal(snapshot.success, 1);
  assert.equal(snapshot.unpriced, 1);
  assert.equal(snapshot.unavailable, 0);
  assert.equal(snapshot.error, 0);
  assert.equal(snapshot.byProvider.Corendon?.SUCCESS, 1);
  assert.equal(snapshot.byProvider[PRIJSVRIJ_PROVIDER_NAME]?.UNPRICED, 1);
  assert.equal(snapshot.byOccupancyCategory['2A+2C / 2R']?.SUCCESS, 1);
  assert.equal(snapshot.byOccupancyCategory['2A+2C / 2R']?.UNPRICED, 1);
  assert.equal(JSON.stringify(snapshot).includes('1990-01-15'), false);
});

test('technical exception → ERROR', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeCorendonOffer()],
    { adults: 2, rooms: 1 },
    { fetchImpl: makeLiveFetch({ throwOnLowest: true }) },
  );

  assert.equal(page.length, 0);
  const snapshot = getLivePriceObservabilitySnapshot();
  assert.equal(snapshot.attempts, 1);
  assert.equal(snapshot.error, 1);
  assert.equal(snapshot.unavailable, 0);
  assert.equal(snapshot.unpriced, 0);
  assert.equal(snapshot.recent[0]?.status, LIVE_PRICE_ATTEMPT_STATUS.ERROR);
  assert.equal(snapshot.recent[0]?.reason, LIVE_PRICE_ATTEMPT_REASON.network_error);
});

test('telemetry does not store DOBs or other personal data', () => {
  const event: LivePriceAttemptEvent = {
    status: LIVE_PRICE_ATTEMPT_STATUS.UNPRICED,
    reason: LIVE_PRICE_ATTEMPT_REASON.occupancy_unsupported,
    provider: 'Corendon',
    listingHost: 'www.corendon.be',
    feedSourceId: 'corendon-benl',
    departureAirport: 'BRU',
    occupancyCategory: '2A+2C / 2R',
    rooms: 2,
  };
  recordLivePriceAttempt(event);
  recordLivePriceAttempt({
    ...event,
    occupancyCategory: '1990-01-15',
    status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
  });

  const snapshot = getLivePriceObservabilitySnapshot();
  const serialized = JSON.stringify(snapshot);
  assert.equal(serialized.includes('1990-01-15'), false);
  assert.equal(serialized.includes('dateOfBirth'), false);
  assert.equal(serialized.includes('geboortedatum'), false);
  assert.equal(livePriceTelemetryContainsPersonalData(snapshot), false);
  assert.equal(livePriceTelemetryContainsPersonalData(FOUR_PAX), true);
  assert.equal(snapshot.attempts, 1);
});
