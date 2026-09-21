import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { extractTransportErrorCode } from '@/lib/http/transport-error-code';
import {
  LIVE_PRICE_ATTEMPT_REASON,
  LIVE_PRICE_ATTEMPT_STATUS,
  clearLivePriceObservabilityForTests,
  formatLivePriceOpsSummary,
  getLivePriceObservabilitySnapshot,
  recordLivePriceAttempt,
  recordLivePriceCircuitOpened,
} from '@/lib/search/live-price-observability';
import { canAttemptLivePrice } from '@/lib/search/live-price-context-gate';
import {
  selectLivePricingCandidateWindow,
  selectLivePricingInitialWorkset,
} from '@/lib/search/live-pricing-workset';
import {
  LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD,
  recordLivePriceCircuitFailure,
  resetLivePriceCircuitForTests,
} from '@/lib/providers/live-price-circuit';
import { clearResultsLivePriceCache } from '@/lib/search/results-live-price-cache';

const CORENDON_FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';

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

function makeCorendon(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return makeOffer({
    id: 'corendon-9514',
    provider: 'Corendon',
    feedSourceId: 'corendon-benl',
    listingHost: 'www.corendon.be',
    deepLink: `https://www.corendon.be/vakantie#${CORENDON_FRAGMENT}`,
    ...overrides,
  });
}

function makeSunweb(overrides: Partial<TravelOffer> = {}): TravelOffer {
  const landing =
    'https://www.sunweb.be/nl/spanje/mallorca/alcudia/hotel-test' +
    '?Accommodation=12345&DepartureDate=2026-08-27&Duration=8&DepartureAirport=BRU' +
    '&Mealplan=AI&TransportType=Flight' +
    '&Participants[0][0]=1990-01-01&Participants[0][1]=1990-01-02';
  return makeOffer({
    id: 'sunweb-12345',
    provider: 'Sunweb',
    deepLink: `https://tc.tradetracker.net/?c=1&r=${encodeURIComponent(landing)}`,
    ...overrides,
  });
}

beforeEach(() => {
  clearLivePriceObservabilityForTests();
  clearResultsLivePriceCache();
  resetLivePriceCircuitForTests();
});

test('extractTransportErrorCode reads UND_ERR_CONNECT_TIMEOUT from cause', () => {
  const err = Object.assign(new Error('connect'), {
    cause: { name: 'ConnectTimeoutError', code: 'UND_ERR_CONNECT_TIMEOUT' },
  });
  assert.equal(extractTransportErrorCode(err), 'UND_ERR_CONNECT_TIMEOUT');
});

test('network_error records transport subtype on observability snapshot', () => {
  recordLivePriceAttempt({
    status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
    reason: LIVE_PRICE_ATTEMPT_REASON.network_error,
    provider: 'Sunweb',
    occupancyCategory: '2A',
    rooms: 1,
    transportErrorCode: 'UND_ERR_CONNECT_TIMEOUT',
  });
  const snap = getLivePriceObservabilitySnapshot();
  assert.equal(snap.error, 1);
  assert.equal(snap.cRate, 1);
  assert.equal(snap.byTransportErrorCode.UND_ERR_CONNECT_TIMEOUT, 1);
  assert.ok(formatLivePriceOpsSummary(snap).includes('cRate='));
  assert.ok(formatLivePriceOpsSummary(snap).includes('UND_ERR_CONNECT_TIMEOUT'));
});

test('network_error without subtype counts as unknown', () => {
  recordLivePriceAttempt({
    status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
    reason: LIVE_PRICE_ATTEMPT_REASON.network_error,
    provider: 'Corendon',
    occupancyCategory: '2A',
    rooms: 1,
  });
  assert.equal(getLivePriceObservabilitySnapshot().byTransportErrorCode.unknown, 1);
});

test('circuit open increments circuitOpenCount once per open', () => {
  for (let i = 0; i < LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD; i += 1) {
    recordLivePriceCircuitFailure('sunweb');
  }
  assert.equal(getLivePriceObservabilitySnapshot().circuitOpenCount, 1);
  recordLivePriceCircuitOpened();
  assert.equal(getLivePriceObservabilitySnapshot().circuitOpenCount, 2);
});

test('canAttemptLivePrice false when Corendon deepLink missing', () => {
  const params: SearchParams = { adults: 2 };
  assert.equal(canAttemptLivePrice(makeCorendon({ deepLink: undefined }), params), false);
  assert.equal(canAttemptLivePrice(makeCorendon(), params), true);
});

test('live window skips missing_context offers and fills from deeper ranks', () => {
  const params: SearchParams = { adults: 2, sort: 'price' };
  const broken = makeCorendon({ id: 'corendon-broken', deepLink: undefined });
  const ok1 = makeCorendon({ id: 'corendon-9514' });
  const ok2Fixed = makeCorendon({
    id: 'corendon-9515',
    deepLink: 'https://www.corendon.be/vakantie#9515.COSPY.BRUCFU.270826.3-4-3.SZ-U',
  });
  const window = selectLivePricingCandidateWindow([broken, ok1, ok2Fixed], params, 2);
  assert.equal(window.some((o) => o.id === 'corendon-broken'), false);
  assert.equal(window.length, 2);
  assert.equal(getLivePriceObservabilitySnapshot().missingContextSkipped >= 1, true);
});

test('workset prefers closed-circuit providers', () => {
  const params: SearchParams = { adults: 2 };
  for (let i = 0; i < LIVE_PRICE_CIRCUIT_FAILURE_THRESHOLD; i += 1) {
    recordLivePriceCircuitFailure('sunweb');
  }
  const sunweb = makeSunweb();
  const corendon = makeCorendon();
  // Ranked: Sunweb first (would normally take slot), then Corendon
  const workset = selectLivePricingInitialWorkset([sunweb, corendon], params, 1);
  assert.equal(workset.length, 1);
  assert.equal(workset[0]?.provider, 'Corendon');
  assert.ok(getLivePriceObservabilitySnapshot().worksetSkippedCircuitOpen >= 1);
});
