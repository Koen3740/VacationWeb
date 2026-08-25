import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { travelersStateToParty } from '@/components/search/travelers-popup/travelers-popup-utils';
import { resolveCorendonLiveOccupancy } from '@/lib/providers/corendon/offer-context';
import { searchParamsOccupancyFromParty } from '@/lib/search/occupancy-category';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import { buildOfferDetailHref } from '@/lib/search/pagination';
import { hasProvenLiveTotalPrice } from '@/lib/search/presentable-price';
import { priceOfferForDetail } from '@/lib/search/price-offer-for-detail';
import {
  clearResultsLivePriceCache,
  livePriceCacheKey,
} from '@/lib/search/results-live-price-cache';
import { clearLivePriceInflightForTests } from '@/lib/providers/prijsvrij/page1-receipt-pricing';
import type { TravelOffer } from '@/types/travel';

const TODAY = new Date(2026, 7, 23);
const CORENDON_TRIP = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU';

const TWO_A_STATE = {
  travellers: [
    { id: 't-1', dateOfBirth: null as string | null },
    { id: 't-2', dateOfBirth: null as string | null },
  ],
  roomCount: 1,
  roomAssignments: [0, 0],
};

const TWO_A_ONE_C_STATE = {
  travellers: [
    { id: 't-1', dateOfBirth: '1980-03-12' },
    { id: 't-2', dateOfBirth: '1982-08-07' },
    { id: 't-3', dateOfBirth: '2016-01-01' },
  ],
  roomCount: 1,
  roomAssignments: [0, 0, 0],
};

const MISSING_CHILD_DOB_STATE = {
  travellers: [
    { id: 't-1', dateOfBirth: '1980-03-12' },
    { id: 't-2', dateOfBirth: '1982-08-07' },
    { id: 't-3', dateOfBirth: null as string | null },
  ],
  roomCount: 1,
  roomAssignments: [0, 0, 0],
};

function detailParamsFromTravelers(state: {
  travellers: Array<{ id: string; dateOfBirth: string | null }>;
  roomCount: number;
  roomAssignments: number[];
}) {
  const occupancy = searchParamsOccupancyFromParty(
    travelersStateToParty(state),
    state.roomCount,
    TODAY,
  );
  const href = buildOfferDetailHref('corendon-9514', {
    adults: undefined,
    children: undefined,
    babies: undefined,
    rooms: undefined,
    ...occupancy,
  });
  return parseSearchParams(Object.fromEntries(new URL(href, 'https://vacationmap.be').searchParams));
}

function makeOffer(): TravelOffer {
  return {
    id: 'corendon-9514',
    provider: 'Corendon',
    hotelName: 'Spyridoula Apartments',
    destinationCountry: 'Griekenland',
    departureDate: '2026-08-27',
    nights: 4,
    flightIncluded: 'true',
    price: 458,
    pricePerDay: 115,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U',
  };
}

function okLowestBody() {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: '2026-08-27T00:00:00',
        trip: {
          price: 710,
          tripCode: CORENDON_TRIP,
          tripUrlHash: `[filters]BEL/BRU.*.*.*.0|||${CORENDON_TRIP}|||true`,
          priceTableDate: '20260827',
          durationInDays: 5,
        },
      },
    },
  });
}

function okUpsalesBody(totalPrice: number) {
  return JSON.stringify({
    result: {
      extendedTripCode: CORENDON_TRIP,
      displayedPricePerPerson: null,
      prices: {
        totalPrice,
        realTimeBlankPrice: totalPrice,
      },
      selectedTripCudl: {
        selectedTrip: {
          system: { request: { departureDate: '2026-08-27' } },
        },
      },
    },
  });
}

beforeEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
});

test('A. Detail 2A serializes adults=2 children=0 babies=0 rooms=1', () => {
  const params = detailParamsFromTravelers(TWO_A_STATE);
  assert.equal(params.adults, 2);
  assert.equal(params.children, 0);
  assert.equal(params.babies, 0);
  assert.equal(params.rooms ?? 1, 1);
  assert.equal(params.party?.length, 2);
  const occupancy = resolveCorendonLiveOccupancy(params);
  assert.equal(occupancy.ok, true);
  if (occupancy.ok) {
    assert.equal(occupancy.pricingRoute, 'upsales');
  }
});

test('B/C. Detail 2A+1C serializes adults=2 children=1 and keeps room 1', () => {
  const params = detailParamsFromTravelers(TWO_A_ONE_C_STATE);
  assert.equal(params.adults, 2);
  assert.equal(params.children, 1);
  assert.equal(params.babies, 0);
  assert.equal(params.rooms ?? 1, 1);
  assert.equal(params.party?.length, 3);
  assert.deepEqual(
    params.party?.map((traveller) => traveller.dateOfBirth),
    ['1980-03-12', '1982-08-07', '2016-01-01'],
  );
  assert.deepEqual(
    params.party?.map((traveller) => traveller.roomIndex),
    [0, 0, 0],
  );
});

test('F. Corendon 2A+1C Detail params use the existing upsales occupancy', () => {
  const params = detailParamsFromTravelers(TWO_A_ONE_C_STATE);
  const occupancy = resolveCorendonLiveOccupancy(params);
  assert.equal(occupancy.ok, true);
  if (occupancy.ok) {
    assert.equal(occupancy.pricingRoute, 'upsales');
    assert.equal(occupancy.roomCount, 1);
    if (occupancy.pricingRoute === 'upsales') {
      assert.equal(occupancy.pax.length, 3);
      assert.deepEqual(
        occupancy.pax.map((traveller) => traveller.birthDate),
        ['1980-03-12', '1982-08-07', '2016-01-01'],
      );
      assert.ok(occupancy.pax.every((traveller) => traveller.roomNr === 1));
    }
  }
});

test('E. 2A and 2A+1C use different live-price cache keys', () => {
  const twoA = detailParamsFromTravelers(TWO_A_STATE);
  const twoAOneC = detailParamsFromTravelers(TWO_A_ONE_C_STATE);
  assert.notEqual(livePriceCacheKey('corendon-9514', twoA), livePriceCacheKey('corendon-9514', twoAOneC));
});

test('D. Detail 2A+1C keeps provider total 1893, not pp × 3', async () => {
  const params = detailParamsFromTravelers(TWO_A_ONE_C_STATE);
  const priced = await priceOfferForDetail(makeOffer(), params, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(okLowestBody(), { status: 200 });
      }
      if (url.includes('/upsales')) {
        return new Response(okUpsalesBody(1893), { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    },
  });
  assert.equal(priced.livePriceSource, 'upsales');
  assert.equal(priced.price, Math.round(1893 / 3));
  assert.equal(priced.liveTotalPrice, 1893);
  assert.equal(priced.liveTotalPriceField, 'upsales.totalPrice');
  assert.equal(hasProvenLiveTotalPrice(priced), true);
});

test('negative: missing child DOB does not invent a child or a proven total', async () => {
  const params = detailParamsFromTravelers(MISSING_CHILD_DOB_STATE);
  assert.notEqual(params.adults, 3);
  assert.notEqual(params.children, 1);
  assert.equal(params.party?.[2]?.dateOfBirth, null);
  const occupancy = resolveCorendonLiveOccupancy(params);
  assert.equal(occupancy.ok, false);
  const twoA = detailParamsFromTravelers(TWO_A_STATE);
  assert.notEqual(livePriceCacheKey('corendon-9514', twoA), livePriceCacheKey('corendon-9514', params));
  const priced = await priceOfferForDetail(makeOffer(), params, {
    fetchImpl: async () => {
      throw new Error('live HTTP must not run for invalid 2A+1C occupancy');
    },
  });
  assert.equal(priced.livePriceStatus, 'unpriced');
  assert.equal(priced.liveTotalPrice, undefined);
  assert.equal(hasProvenLiveTotalPrice(priced), false);
});
