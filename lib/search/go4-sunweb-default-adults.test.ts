/**
 * GO4: Sunweb Results default adult DOBs when search DOBs are missing.
 * Detail / click-out must remain untouched (no synthetic DOBs).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TravelOffer } from '@/lib/feeds/canonical/travel-offer';
import type { SearchParams } from '@/types/travel';
import {
  buildSunwebLiveContext,
  buildSunwebOccupancyClickOutHref,
  requiresSunwebResultsLivePrice,
  resolveSunwebLiveOccupancy,
  SUNWEB_RESULTS_DEFAULT_ADULT_AGE_YEARS,
  withSunwebResultsDefaultAdultDobs,
  withSunwebResultsLiveParams,
} from '@/lib/providers/sunweb';
import {
  canAttemptLivePrice,
  isLivePriceProviderOffer,
} from '@/lib/search/live-price-context-gate';

const LANDING =
  'https://www.sunweb.be/nl/vakantie/tunesie/hammamet/hotel-example' +
  '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=AI' +
  '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-10-10';
// Feed deepLink WITHOUT Participants — the Pending case from GO3.
const PRODUCT_URL =
  'https://tc.tradetracker.net/?c=1&m=1&a=1&r=' + encodeURIComponent(LANDING);

function twoAdultsMissingDob(overrides: Partial<SearchParams> = {}): SearchParams {
  return {
    adults: 2,
    children: 0,
    babies: 0,
    rooms: 1,
    departureStart: '2026-10-01',
    departureEnd: '2026-10-31',
    party: [
      { dateOfBirth: null, roomIndex: 0 },
      { dateOfBirth: null, roomIndex: 0 },
    ],
    ...overrides,
  };
}

function makeSunwebOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'sunweb-6155492-2026-10-10-8-BRU-AllInclusive',
    provider: 'Sunweb',
    hotelName: 'Hotel Example',
    destinationCountry: 'Tunesië',
    departureDate: '2026-10-10',
    nights: 8,
    price: 539,
    pricePerDay: 67,
    deepLink: PRODUCT_URL,
    ...overrides,
  } as TravelOffer;
}

test('GO4 withSunwebResultsDefaultAdultDobs: injects age-35 DOBs for 2A missing DOB', () => {
  const params = twoAdultsMissingDob();
  const next = withSunwebResultsDefaultAdultDobs(params, '2026-10-10');
  assert.notEqual(next, params);
  assert.ok(next.party);
  assert.equal(next.party!.length, 2);
  assert.equal(next.party![0]!.dateOfBirth, '1991-10-10');
  assert.equal(next.party![1]!.dateOfBirth, '1991-10-10');
  assert.equal(SUNWEB_RESULTS_DEFAULT_ADULT_AGE_YEARS, 35);
  // pure: original unchanged
  assert.equal(params.party![0]!.dateOfBirth, null);
});

test('GO4 withSunwebResultsDefaultAdultDobs: also covers empty party / adults-only 2A', () => {
  const params: SearchParams = {
    adults: 2,
    children: 0,
    babies: 0,
    rooms: 1,
    departureStart: '2026-10-01',
  };
  const next = withSunwebResultsDefaultAdultDobs(params, '2026-10-03');
  assert.equal(next.party?.[0]?.dateOfBirth, '1991-10-03');
  assert.equal(resolveSunwebLiveOccupancy(next).ok, true);
  if (resolveSunwebLiveOccupancy(next).ok) {
    const occ = resolveSunwebLiveOccupancy(next);
    assert.equal(occ.ok && occ.mode, 'party');
  }
});

test('GO4 withSunwebResultsDefaultAdultDobs: real ISO DOBs are never replaced', () => {
  const params = twoAdultsMissingDob({
    party: [
      { dateOfBirth: '1988-05-01', roomIndex: 0 },
      { dateOfBirth: '1990-12-15', roomIndex: 0 },
    ],
  });
  const next = withSunwebResultsDefaultAdultDobs(params, '2026-10-10');
  assert.equal(next, params);
  assert.equal(next.party![0]!.dateOfBirth, '1988-05-01');
  assert.equal(next.party![1]!.dateOfBirth, '1990-12-15');
});

test('GO4 withSunwebResultsDefaultAdultDobs: not injected for children / other occupancy', () => {
  const withChild: SearchParams = {
    adults: 2,
    children: 1,
    babies: 0,
    rooms: 1,
    party: [
      { dateOfBirth: null, roomIndex: 0 },
      { dateOfBirth: null, roomIndex: 0 },
      { dateOfBirth: null, roomIndex: 0 },
    ],
  };
  assert.equal(withSunwebResultsDefaultAdultDobs(withChild, '2026-10-10'), withChild);

  const threeAdults: SearchParams = {
    adults: 3,
    children: 0,
    babies: 0,
    rooms: 1,
    party: [
      { dateOfBirth: null, roomIndex: 0 },
      { dateOfBirth: null, roomIndex: 0 },
      { dateOfBirth: null, roomIndex: 0 },
    ],
  };
  assert.equal(withSunwebResultsDefaultAdultDobs(threeAdults, '2026-10-10'), threeAdults);

  const twoRooms: SearchParams = {
    adults: 2,
    children: 0,
    babies: 0,
    rooms: 2,
    party: [
      { dateOfBirth: null, roomIndex: 0 },
      { dateOfBirth: null, roomIndex: 1 },
    ],
  };
  assert.equal(withSunwebResultsDefaultAdultDobs(twoRooms, '2026-10-10'), twoRooms);
});

test('GO4 requiresSunwebResultsLivePrice: true for Results 2A with missing DOBs', () => {
  const params = twoAdultsMissingDob();
  // Without helper, occupancy is invalid for null party DOBs:
  assert.equal(resolveSunwebLiveOccupancy(params).ok, false);
  // Results gate now applies defaults:
  assert.equal(requiresSunwebResultsLivePrice(params), true);
  assert.equal(isLivePriceProviderOffer(makeSunwebOffer(), params), true);
});

test('GO4 canAttemptLivePrice: Sunweb 2A missing DOB becomes attemptable when context buildable', () => {
  const params = twoAdultsMissingDob();
  const offer = makeSunwebOffer();
  // Context with defaults must be non-null for this feed URL shape (trip fields present,
  // Participants injected via party mode).
  const liveParams = withSunwebResultsLiveParams(params, offer.departureDate);
  const ctx = buildSunwebLiveContext(offer, liveParams);
  assert.ok(ctx, 'expected live context with default DOBs');
  assert.equal(ctx!.query.participants[0]?.value, '1991-10-10');
  assert.equal(ctx!.query.participants[1]?.value, '1991-10-10');
  assert.equal(canAttemptLivePrice(offer, params), true);
});

test('GO4 Detail/click-out path unaffected: no synthetic DOBs without Results helper', () => {
  const params = twoAdultsMissingDob();
  const offer = makeSunwebOffer();
  // Click-out uses raw params — still fail-closed without real party DOBs.
  assert.equal(buildSunwebOccupancyClickOutHref(offer, params), null);
  // Raw build without Results defaults stays null (feed has no Participants).
  assert.equal(buildSunwebLiveContext(offer, params), null);
});
