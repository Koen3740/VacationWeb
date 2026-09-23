import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CORENDON_DEFAULT_2A_PARTY,
  CORENDON_FE_HOST,
  CORENDON_FE_VERSION,
} from './constants';
import {
  buildCorendonLowestpricesaccoUrl,
  buildCorendonPriceTableHashPayload,
  fetchCorendonLowestpricesaccoPrice,
} from './lowestpricesacco-client';
import type { CorendonLiveContext } from './offer-context';

const FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
const FILTERED_HASH_PAYLOAD = `[filters]BEL/BRU.*.*.*.0|||${FRAGMENT}|||true`;

function ctx(overrides: Partial<CorendonLiveContext> = {}): CorendonLiveContext {
  return {
    accommodationId: '9514',
    departureIso: '2026-08-27',
    feHost: CORENDON_FE_HOST,
    fragment: {
      raw: FRAGMENT,
      hotelId: '9514',
      accommodationCode: 'COSPY',
      airportRoute: 'BRUCFU',
      dateYymmdd: '270826',
      durationNights: '3-4-3',
      roomBoard: 'SZ-U',
    },
    ...overrides,
  };
}

function okBody(overrides: {
  price?: number;
  tripCode?: string;
  departureDate?: string;
} = {}) {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: overrides.departureDate ?? '2026-08-27T00:00:00',
        trip: {
          price: overrides.price ?? 876,
          tripCode:
            overrides.tripCode ??
            '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
        },
      },
    },
  });
}

test('buildCorendonPriceTableHashPayload: pins departure airport like Corendon site', () => {
  assert.equal(buildCorendonPriceTableHashPayload(ctx().fragment), FILTERED_HASH_PAYLOAD);
  assert.equal(
    buildCorendonPriceTableHashPayload({
      raw: '8188.RHATP.CGNRHO.211026.7.DZG-F..',
      hotelId: '8188',
      accommodationCode: 'RHATP',
      airportRoute: 'CGNRHO',
      dateYymmdd: '211026',
      durationNights: '7',
      roomBoard: 'DZG-F',
    }),
    '[filters]DEU/CGN.*.*.*.0|||8188.RHATP.CGNRHO.211026.7.DZG-F..|||true',
  );
  assert.equal(
    buildCorendonPriceTableHashPayload({
      raw: '10716.KOIKO.AMSKGS.041026.7.3B1-X..',
      hotelId: '10716',
      accommodationCode: 'KOIKO',
      airportRoute: 'AMSKGS',
      dateYymmdd: '041026',
      durationNights: '7',
      roomBoard: '3B1-X',
    }),
    '[filters]NLD/AMS.*.*.*.0|||10716.KOIKO.AMSKGS.041026.7.3B1-X..|||true',
  );
});

test('buildCorendonLowestpricesaccoUrl: proven query shape with filtered priceTableHash', () => {
  const url = new URL(buildCorendonLowestpricesaccoUrl(ctx()));
  assert.equal(url.pathname, '/fe/api/prices/lowestpricesacco');
  assert.equal(url.searchParams.get('version'), CORENDON_FE_VERSION);
  assert.equal(url.searchParams.get('originalHost'), CORENDON_FE_HOST);
  assert.equal(url.searchParams.get('browserHost'), CORENDON_FE_HOST);
  assert.equal(url.searchParams.get('accommodationId'), '9514');
  assert.equal(url.searchParams.get('useFiltersFromHash'), 'true');
  assert.equal(url.searchParams.get('searchQuery'), '');
  assert.equal(
    url.searchParams.get('partyComposition'),
    JSON.stringify(CORENDON_DEFAULT_2A_PARTY),
  );
  assert.equal(
    url.searchParams.get('priceTableHash'),
    Buffer.from(FILTERED_HASH_PAYLOAD, 'utf8').toString('base64'),
  );
});

test('fetch: valid live price on acco+date+airport match', async () => {
  const result = await fetchCorendonLowestpricesaccoPrice(ctx(), {
    fetchImpl: async () => new Response(okBody(), { status: 200 }),
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pricePerPerson, 876);
    assert.ok(result.tripCode.startsWith('9514.'));
    assert.ok(result.tripCode.includes('.BRUCFU.'));
  }
});

test('fetch: HTTP 204 is not a live price', async () => {
  const result = await fetchCorendonLowestpricesaccoPrice(ctx(), {
    fetchImpl: async () => new Response(null, { status: 204 }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, 'empty');
});

test('fetch: stale date/airport is not a live price', async () => {
  const staleDate = await fetchCorendonLowestpricesaccoPrice(ctx(), {
    fetchImpl: async () =>
      new Response(okBody({ departureDate: '2026-09-01T00:00:00' }), { status: 200 }),
  });
  assert.equal(staleDate.ok, false);
  if (!staleDate.ok) assert.equal(staleDate.reason, 'stale_context');

  const staleAirport = await fetchCorendonLowestpricesaccoPrice(ctx(), {
    fetchImpl: async () =>
      new Response(
        okBody({ tripCode: '9514.COSPY.AMSCFU.270826.3-4-3.SZ-U' }),
        { status: 200 },
      ),
  });
  assert.equal(staleAirport.ok, false);
  if (!staleAirport.ok) assert.equal(staleAirport.reason, 'stale_context');
});

test('fetch: invalid / missing trip price is not live', async () => {
  const noTrip = await fetchCorendonLowestpricesaccoPrice(ctx(), {
    fetchImpl: async () => new Response(JSON.stringify({ package: {} }), { status: 200 }),
  });
  assert.equal(noTrip.ok, false);
  if (!noTrip.ok) assert.equal(noTrip.reason, 'no_trip');

  const zero = await fetchCorendonLowestpricesaccoPrice(ctx(), {
    fetchImpl: async () => new Response(okBody({ price: 0 }), { status: 200 }),
  });
  assert.equal(zero.ok, false);
  if (!zero.ok) assert.equal(zero.reason, 'invalid_price');
});

test('fetch: http/network failure is not live', async () => {
  const http = await fetchCorendonLowestpricesaccoPrice(ctx(), {
    fetchImpl: async () => new Response('err', { status: 500 }),
  });
  assert.equal(http.ok, false);
  if (!http.ok) assert.equal(http.reason, 'http_error');

  const network = await fetchCorendonLowestpricesaccoPrice(ctx(), {
    fetchImpl: async () => {
      throw new Error('network down');
    },
  });
  assert.equal(network.ok, false);
  if (!network.ok) assert.equal(network.reason, 'network_error');
});
