import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CORENDON_FE_HOST,
  CORENDON_FE_VERSION,
  CORENDON_TWO_ROOM_2A_PARTY,
} from './constants';
import type { CorendonLowestHop } from './lowestpricesacco-client';
import type { CorendonLiveContext } from './offer-context';
import { buildCorendonLiveContext } from './offer-context';
import {
  buildCorendonUpsalesInput,
  buildCorendonUpsalesUrl,
  fetchCorendonLivePrice,
} from './upsales-client';

const FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
const TRIP_CODE = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU';
const TRIP_URL_HASH = `[filters]BEL/BRU.*.*.*.0|||${TRIP_CODE}|||true`;

const FOUR_PAX = {
  adults: 4,
  rooms: 2,
  party: [
    { dateOfBirth: '1990-01-15', roomIndex: 0 },
    { dateOfBirth: '1988-03-03', roomIndex: 0 },
    { dateOfBirth: '2014-06-14', roomIndex: 1 },
    { dateOfBirth: '2018-01-22', roomIndex: 1 },
  ],
};

function ctx(): CorendonLiveContext {
  const built = buildCorendonLiveContext(
    {
      id: 'corendon-9514',
      provider: 'Corendon',
      hotelName: 'Spyridoula Apartments',
      destinationCountry: 'Griekenland',
      departureDate: '2026-08-27',
      nights: 4,
      price: 458,
      pricePerDay: 115,
      imageUrl: 'https://example.com/a.jpg',
      deepLink: `https://www.corendon.be/vakantie#${FRAGMENT}`,
    },
    FOUR_PAX,
  );
  assert.ok(built);
  return built;
}

const HOP: CorendonLowestHop = {
  pricePerPerson: 876,
  tripCode: TRIP_CODE,
  tripUrlHash: TRIP_URL_HASH,
  priceTableDate: '20260827',
  durationInDays: 5,
  nights: 4,
};

function okLowestBody() {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: '2026-08-27T00:00:00',
        trip: {
          price: 876,
          tripCode: TRIP_CODE,
          tripUrlHash: TRIP_URL_HASH,
          priceTableDate: '20260827',
          durationInDays: 5,
        },
      },
    },
  });
}

function okUpsalesBody(overrides: { totalPrice?: number; pp?: number; tripCode?: string; date?: string } = {}) {
  return JSON.stringify({
    result: {
      extendedTripCode: overrides.tripCode ?? TRIP_CODE,
      prices: {
        totalPrice: overrides.totalPrice ?? 2400,
        priceTableCalculatedPricePerPerson: overrides.pp ?? 600,
      },
      selectedTripCudl: {
        selectedTrip: {
          system: { request: { departureDate: overrides.date ?? '2026-08-27' } },
        },
      },
    },
  });
}

test('upsales input uses party DOBs and lowest hop hash, not placeholder tokens', () => {
  const input = buildCorendonUpsalesInput(ctx(), HOP);
  assert.ok(input);
  assert.deepEqual(input.pax, [
    { birthDate: '1990-01-15', roomNr: 1 },
    { birthDate: '1988-03-03', roomNr: 1 },
    { birthDate: '2014-06-14', roomNr: 2 },
    { birthDate: '2018-01-22', roomNr: 2 },
  ]);
  assert.equal(input.accoCode, 'COSPY');
  assert.equal(input.priceTableStateHash, TRIP_URL_HASH);
  assert.equal(input.offer, '20260827|5_4|5|4|4|876|876|0');
  assert.equal(JSON.stringify(input).includes('1-1-19860'), false);
});

test('upsales URL is the proven FE path with host + version', () => {
  const url = new URL(buildCorendonUpsalesUrl(ctx(), HOP) ?? '');
  assert.equal(url.pathname, '/fe/api/prices/upsales');
  assert.equal(url.searchParams.get('version'), CORENDON_FE_VERSION);
  assert.equal(url.searchParams.get('originalHost'), CORENDON_FE_HOST);
  assert.equal(url.searchParams.get('browserHost'), CORENDON_FE_HOST);
  const decoded = JSON.parse(
    Buffer.from(url.searchParams.get('input') ?? '', 'base64').toString('utf8'),
  ) as { pax: unknown };
  assert.deepEqual(decoded.pax, buildCorendonUpsalesInput(ctx(), HOP)?.pax);
});

test('4 pax / 2 rooms live price is upsales, not the 2A lowest €', async () => {
  const urls: string[] = [];
  const result = await fetchCorendonLivePrice(ctx(), {
    fetchImpl: async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('lowestpricesacco')) {
        assert.equal(
          new URL(url).searchParams.get('partyComposition'),
          JSON.stringify(CORENDON_TWO_ROOM_2A_PARTY),
        );
        return new Response(okLowestBody(), { status: 200 });
      }
      if (url.includes('/upsales')) {
        return new Response(okUpsalesBody(), { status: 200 });
      }
      throw new Error(`unexpected url ${url}`);
    },
  });

  assert.equal(urls.some((url) => url.includes('lowestpricesacco')), true);
  assert.equal(urls.some((url) => url.includes('/upsales')), true);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.source, 'upsales');
    assert.equal(result.pricePerPerson, 600);
    assert.notEqual(result.pricePerPerson, 876);
  }
});

test('upsales failure does not present the lowest 2A price', async () => {
  const failed = await fetchCorendonLivePrice(ctx(), {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(okLowestBody(), { status: 200 });
      }
      return new Response('err', { status: 500 });
    },
  });
  assert.equal(failed.ok, false);
  if (!failed.ok) {
    assert.equal(failed.reason, 'http_error');
  }

  const missingHop = await fetchCorendonLivePrice(ctx(), {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(
          JSON.stringify({
            package: {
              lowestPriceTrip: {
                tripDepartureDate: '2026-08-27T00:00:00',
                trip: { price: 876, tripCode: TRIP_CODE },
              },
            },
          }),
          { status: 200 },
        );
      }
      throw new Error('upsales must not run without hop');
    },
  });
  assert.equal(missingHop.ok, false);
  if (!missingHop.ok) {
    assert.equal(missingHop.reason, 'invalid_context');
  }
});

test('stale upsales airport/date is not a live price', async () => {
  const result = await fetchCorendonLivePrice(ctx(), {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(okLowestBody(), { status: 200 });
      }
      return new Response(
        okUpsalesBody({ tripCode: '9514.COSPY.AMSCFU.270826.3-4-3.SZ-U' }),
        { status: 200 },
      );
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'stale_context');
  }
});
