import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CORENDON_DEFAULT_2A_PARTY,
  CORENDON_FE_HOST,
  CORENDON_FE_VERSION,
} from './constants';
import {
  buildCorendonLowestpricesaccoUrl,
  fetchCorendonLowestpricesaccoPrice,
} from './lowestpricesacco-client';
import type { CorendonLiveContext } from './offer-context';

const FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';

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

test('buildCorendonLowestpricesaccoUrl: proven query shape', () => {
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
    Buffer.from(FRAGMENT, 'utf8').toString('base64'),
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
