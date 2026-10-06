import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import {
  isTravelersStateComplete,
  travelersStateToParty,
  type TravelersState,
} from '@/components/search/travelers-popup/travelers-popup-utils';
import { tripDobReferenceForOffer } from '@/lib/providers/synthetic-dob';
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

const CORENDON_TRIP = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU';

const TWO_A_STATE: TravelersState = { adults: 2, childAges: [], roomCount: 1, roomAssignments: [0, 0] };

const TWO_A_ONE_C_STATE: TravelersState = {
  adults: 2,
  childAges: [10],
  roomCount: 1,
  roomAssignments: [0, 0, 0],
};

const MISSING_CHILD_AGE_STATE: TravelersState = {
  adults: 2,
  childAges: [null],
  roomCount: 1,
  roomAssignments: [0, 0, 0],
};

function detailParamsFromTravelers(state: TravelersState) {
  const occupancy = searchParamsOccupancyFromParty(
    travelersStateToParty(state),
    state.roomCount,
  );
  const href = buildOfferDetailHref('corendon-9514', {
    adults: undefined,
    children: undefined,
    babies: undefined,
    rooms: undefined,
    ...occupancy,
  });
  expectNoDob(href);
  return parseSearchParams(Object.fromEntries(new URL(href, 'https://vacationmap.be').searchParams));
}

function expectNoDob(href: string): void {
  assert.equal(/dob=|\d{4}-\d{2}-\d{2}/.test(decodeURIComponent(href)), false);
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
    params.party?.map((traveller) => traveller.age),
    [null, null, 10],
  );
  assert.deepEqual(params.childAges, [10]);
  assert.deepEqual(
    params.party?.map((traveller) => traveller.roomIndex),
    [0, 0, 0],
  );
});

test('F. Corendon 2A+1C Detail params use the existing upsales occupancy', () => {
  const params = detailParamsFromTravelers(TWO_A_ONE_C_STATE);
  // Return date = departure 2026-08-27 + (4 nights - 1) = 2026-08-30 (Corendon semantics).
  const occupancy = resolveCorendonLiveOccupancy(params, tripDobReferenceForOffer(makeOffer()));
  assert.equal(occupancy.ok, true);
  if (occupancy.ok) {
    assert.equal(occupancy.pricingRoute, 'upsales');
    assert.equal(occupancy.roomCount, 1);
    if (occupancy.pricingRoute === 'upsales') {
      assert.equal(occupancy.pax.length, 3);
      assert.deepEqual(
        occupancy.pax.map((traveller) => traveller.birthDate),
        ['1986-01-01', '1986-01-01', '2016-08-30'],
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

test('negative: a child without an age is not invented and the state is not searchable', () => {
  assert.equal(isTravelersStateComplete(MISSING_CHILD_AGE_STATE), false);
  assert.equal(isTravelersStateComplete(TWO_A_ONE_C_STATE), true);
  const party = travelersStateToParty(MISSING_CHILD_AGE_STATE);
  assert.equal(party.length, 2);
  assert.ok(party.every((traveller) => traveller.age === null));
});
