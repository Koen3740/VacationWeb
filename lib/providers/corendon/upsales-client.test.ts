import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CORENDON_ADULT_REFERENCE_DOB,
  CORENDON_DEFAULT_2A_PARTY,
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

const TWO_ADULTS = {
  adults: 2,
  rooms: 1,
  party: [
    { dateOfBirth: '1980-03-12', roomIndex: 0 },
    { dateOfBirth: '1982-08-07', roomIndex: 0 },
  ],
};

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

function ctx(
  params: {
    adults?: number;
    children?: number;
    babies?: number;
    rooms?: number;
    party?: Array<{ dateOfBirth: string | null; roomIndex: number }>;
  } = FOUR_PAX,
): CorendonLiveContext {
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
    params,
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

function okUpsalesBody(overrides: {
  totalPrice?: number;
  tablePp?: number;
  displayedPp?: number | null;
  tripCode?: string;
  date?: string;
} = {}) {
  return JSON.stringify({
    result: {
      extendedTripCode: overrides.tripCode ?? TRIP_CODE,
      displayedPricePerPerson: overrides.displayedPp ?? null,
      prices: {
        totalPrice: overrides.totalPrice ?? 2400,
        displayedPricePerPerson: overrides.displayedPp ?? null,
        priceTableCalculatedPricePerPerson: overrides.tablePp ?? 600,
      },
      selectedTripCudl: {
        selectedTrip: {
          system: { request: { departureDate: overrides.date ?? '2026-08-27' } },
        },
      },
    },
  });
}

test('2A without DOB uses adult reference DOB on the existing upsales route', () => {
  const noDob = buildCorendonLiveContext(
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
    { adults: 2, children: 0, babies: 0, rooms: 1 },
  );
  assert.ok(noDob);
  assert.equal(noDob.pricingRoute, 'upsales');
  assert.deepEqual(noDob.upsalesPax, [
    { birthDate: CORENDON_ADULT_REFERENCE_DOB, roomNr: 1 },
    { birthDate: CORENDON_ADULT_REFERENCE_DOB, roomNr: 1 },
  ]);
  const input = buildCorendonUpsalesInput(noDob, HOP);
  assert.ok(input);
  assert.deepEqual(input.pax, [
    { birthDate: CORENDON_ADULT_REFERENCE_DOB, roomNr: 1 },
    { birthDate: CORENDON_ADULT_REFERENCE_DOB, roomNr: 1 },
  ]);
  assert.equal(JSON.stringify(input).includes('1-1-19860'), false);
  assert.equal(JSON.stringify(noDob).includes('1980-01-01'), false);
  assert.equal(JSON.stringify(noDob).includes('1975-01-01'), false);
});

test('2A without DOB and 2A with user ISO DOBs use the same upsales pricing route', async () => {
  const noDob = ctx({
    adults: 2,
    rooms: 1,
    party: [
      { dateOfBirth: null, roomIndex: 0 },
      { dateOfBirth: null, roomIndex: 0 },
    ],
  });
  const withDob = ctx(TWO_ADULTS);
  assert.equal(noDob.pricingRoute, 'upsales');
  assert.equal(withDob.pricingRoute, 'upsales');
  assert.deepEqual(noDob.upsalesPax, [
    { birthDate: CORENDON_ADULT_REFERENCE_DOB, roomNr: 1 },
    { birthDate: CORENDON_ADULT_REFERENCE_DOB, roomNr: 1 },
  ]);
  assert.deepEqual(withDob.upsalesPax, [
    { birthDate: '1980-03-12', roomNr: 1 },
    { birthDate: '1982-08-07', roomNr: 1 },
  ]);

  const noDobResult = await fetchCorendonLivePrice(noDob, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(okLowestBody(), { status: 200 });
      }
      if (url.includes('/upsales')) {
        const decoded = JSON.parse(
          Buffer.from(new URL(url).searchParams.get('input') ?? '', 'base64').toString('utf8'),
        ) as { pax: Array<{ birthDate: string }> };
        assert.deepEqual(decoded.pax.map((traveller) => traveller.birthDate), [
          CORENDON_ADULT_REFERENCE_DOB,
          CORENDON_ADULT_REFERENCE_DOB,
        ]);
        return new Response(okUpsalesBody({ totalPrice: 1424, tablePp: 710 }), { status: 200 });
      }
      throw new Error(`unexpected url ${url}`);
    },
  });
  assert.equal(noDobResult.ok, true);
  if (noDobResult.ok) {
    assert.equal(noDobResult.source, 'upsales');
    assert.equal(noDobResult.totalPrice, 1424);
    assert.equal(noDobResult.totalPriceField, 'upsales.totalPrice');
    assert.notEqual(noDobResult.totalPrice, 710 * 2);
  }
});

test('2A upsales input uses homepage party DOBs, not placeholder tokens', () => {
  const input = buildCorendonUpsalesInput(ctx(TWO_ADULTS), HOP);
  assert.ok(input);
  assert.deepEqual(input.pax, [
    { birthDate: '1980-03-12', roomNr: 1 },
    { birthDate: '1982-08-07', roomNr: 1 },
  ]);
  assert.equal(input.accoCode, 'COSPY');
  assert.equal(input.priceTableStateHash, TRIP_URL_HASH);
  assert.equal(JSON.stringify(input).includes('1-1-19860'), false);
  assert.equal(JSON.stringify(input).includes('1986-01-01'), false);
});

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

test('2A live price keeps upsales totalPrice 1424, not table-pp × 2', async () => {
  const urls: string[] = [];
  const result = await fetchCorendonLivePrice(ctx(TWO_ADULTS), {
    fetchImpl: async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('lowestpricesacco')) {
        assert.equal(
          new URL(url).searchParams.get('partyComposition'),
          JSON.stringify(CORENDON_DEFAULT_2A_PARTY),
        );
        return new Response(okLowestBody(), { status: 200 });
      }
      if (url.includes('/upsales')) {
        return new Response(okUpsalesBody({ totalPrice: 1424, tablePp: 710 }), { status: 200 });
      }
      throw new Error(`unexpected url ${url}`);
    },
  });

  assert.equal(urls.filter((url) => url.includes('lowestpricesacco')).length, 1);
  assert.equal(urls.filter((url) => url.includes('/upsales')).length, 1);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.source, 'upsales');
    assert.equal(result.pricePerPerson, 712);
    assert.equal(result.pricePerPersonField, 'display.totalDividedByPax');
    assert.notEqual(result.pricePerPerson, 710);
    assert.equal(result.totalPrice, 1424);
    assert.equal(result.totalPriceField, 'upsales.totalPrice');
    assert.notEqual(result.totalPrice, 710 * 2);
  }
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
    assert.equal(result.pricePerPersonField, 'display.totalDividedByPax');
    assert.equal(result.totalPrice, 2400);
    assert.equal(result.totalPriceField, 'upsales.totalPrice');
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

test('Alaaddin 17-11-2026 BRU: table-pp 807 is not live p.p.; total stays 1491', async () => {
  const alaaddin = buildCorendonLiveContext(
    {
      id: 'corendon-11721-BRUAYT-171126-7-DZH',
      provider: 'Corendon',
      hotelName: 'Fly & Go Alaaddin Beach Alanya',
      destinationCountry: 'Turkije',
      departureDate: '2026-11-17',
      nights: 7,
      price: 744,
      pricePerDay: 106,
      imageUrl: 'https://example.com/a.jpg',
      deepLink: 'https://www.corendon.be/vakantie#11721.ALABEF.BRUAYT.171126.7-8-7.DZ-H',
    },
    { adults: 2, children: 0, babies: 0, rooms: 1 },
  );
  assert.ok(alaaddin);
  const hop: CorendonLowestHop = {
    pricePerPerson: 744,
    tripCode: '11721.ALABEF.BRUAYT.171126.7-8-7.DZ-H.BRUAYT2K.AYTBRU2K.!ANCAR_H32_AYT!',
    tripUrlHash:
      '[filters]BEL/BRU.*.*.*.0|||11721.ALABEF.BRUAYT.171126.7-8-7.DZ-H.BRUAYT2K.AYTBRU2K.!ANCAR_H32_AYT!|||true',
    priceTableDate: '20261117',
    durationInDays: 8,
    nights: 7,
  };
  const urls: string[] = [];
  const result = await fetchCorendonLivePrice(alaaddin, {
    fetchImpl: async (input) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('lowestpricesacco')) {
        return new Response(
          JSON.stringify({
            package: {
              lowestPriceTrip: {
                tripDepartureDate: '2026-11-17T00:00:00',
                trip: {
                  price: 744,
                  tripCode: hop.tripCode,
                  tripUrlHash: hop.tripUrlHash,
                  priceTableDate: '20261117',
                  durationInDays: 8,
                },
              },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes('/upsales')) {
        return new Response(
          JSON.stringify({
            result: {
              extendedTripCode: hop.tripCode,
              displayedPricePerPerson: null,
              priceTableCalculatedPricePerPerson: 807,
              priceTableCalculatedPrice: 1614,
              prices: {
                totalPrice: 1491,
                realTimeBlankPrice: 1491,
                tripPrice: 1491,
                displayedPricePerPerson: null,
                priceTableCalculatedPricePerPerson: null,
                priceGuaranteeItem: { priceGuaranteeDifference: 123 },
                roomPrices: [{ price: 1491 }],
              },
              selectedTripCudl: {
                selectedTrip: {
                  system: { request: { departureDate: '2026-11-17' } },
                  trip: { amount: 1491 },
                },
              },
            },
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected url ${url}`);
    },
  });

  assert.equal(urls.filter((url) => url.includes('lowestpricesacco')).length, 1);
  assert.equal(urls.filter((url) => url.includes('/upsales')).length, 1);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.source, 'upsales');
    assert.notEqual(result.pricePerPerson, 807);
    assert.notEqual(result.pricePerPerson, 744);
    assert.equal(result.pricePerPerson, Math.round(1491 / 2));
    assert.equal(result.pricePerPersonField, 'display.totalDividedByPax');
    assert.equal(result.totalPrice, 1491);
    assert.equal(result.totalPriceField, 'upsales.totalPrice');
    assert.notEqual(result.totalPrice, 1614);
    assert.notEqual(result.totalPrice, 807 * 2);
    assert.notEqual(result.totalPrice, result.pricePerPerson * 2);
  }
});

test('upsales uses displayedPricePerPerson and ignores table-pp 807', async () => {
  const result = await fetchCorendonLivePrice(ctx(TWO_ADULTS), {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(okLowestBody(), { status: 200 });
      }
      if (url.includes('/upsales')) {
        return new Response(
          okUpsalesBody({ totalPrice: 1491, tablePp: 807, displayedPp: 746 }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected url ${url}`);
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pricePerPerson, 746);
    assert.equal(result.pricePerPersonField, 'upsales.displayedPricePerPerson');
    assert.notEqual(result.pricePerPerson, 807);
    assert.equal(result.totalPrice, 1491);
    assert.equal(result.totalPriceField, 'upsales.totalPrice');
  }
});

test('table-pp alone is not a live upsales price', async () => {
  const result = await fetchCorendonLivePrice(ctx(TWO_ADULTS), {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(okLowestBody(), { status: 200 });
      }
      return new Response(
        JSON.stringify({
          result: {
            extendedTripCode: TRIP_CODE,
            priceTableCalculatedPricePerPerson: 807,
            priceTableCalculatedPrice: 1614,
            prices: {},
            selectedTripCudl: {
              selectedTrip: {
                system: { request: { departureDate: '2026-08-27' } },
              },
            },
          },
        }),
        { status: 200 },
      );
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'invalid_price');
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
