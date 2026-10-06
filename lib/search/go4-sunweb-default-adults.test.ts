/**
 * DEC-019 (replaces the GO4 default-age-35 adult DOBs): Sunweb adults are a count only and get
 * the fixed synthetic DOB 1986-01-01 for Results, Detail and click-out alike.
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

function twoAdultsParty(overrides: Partial<SearchParams> = {}): SearchParams {
  return {
    adults: 2,
    children: 0,
    babies: 0,
    rooms: 1,
    departureStart: '2026-10-01',
    departureEnd: '2026-10-31',
    party: [
      { age: null, roomIndex: 0 },
      { age: null, roomIndex: 0 },
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

test('DEC-019 Sunweb: 2 adults get the synthetic adult DOB (no age-35 default, no real DOB)', () => {
  const occupancy = resolveSunwebLiveOccupancy(twoAdultsParty());
  assert.equal(occupancy.ok && occupancy.mode, 'party');
  assert.deepEqual(occupancy.ok && occupancy.mode === 'party' ? occupancy.participants : null, [
    { key: 'Participants[0][0]', value: '1986-01-01' },
    { key: 'Participants[0][1]', value: '1986-01-01' },
  ]);
});

test('DEC-019 Sunweb: 2A without a party keeps the feed-two-adults route', () => {
  const params: SearchParams = { adults: 2, children: 0, babies: 0, rooms: 1, departureStart: '2026-10-01' };
  const occupancy = resolveSunwebLiveOccupancy(params);
  assert.equal(occupancy.ok && occupancy.mode, 'feed-two-adults');
});

test('DEC-019 withSunwebResultsLiveParams: a known party is returned unchanged', () => {
  const params = twoAdultsParty();
  assert.equal(withSunwebResultsLiveParams(params, '2026-10-10'), params);
});

test('DEC-019 withSunwebResultsLiveParams: party-less 2A/1R becomes a two-adult party (feed link without Participants stays priceable)', () => {
  const params: SearchParams = { adults: 2, children: 0, babies: 0, rooms: 1, sort: 'price' };
  const live = withSunwebResultsLiveParams(params);
  assert.deepEqual(live.party, [
    { age: null, roomIndex: 0 },
    { age: null, roomIndex: 0 },
  ]);
  assert.equal(params.party, undefined);
  const offer = makeSunwebOffer();
  assert.equal(canAttemptLivePrice(offer, params), true);
  const ctx = buildSunwebLiveContext(offer, live);
  assert.ok(ctx);
  assert.equal(ctx!.query.participants.length, 2);
  assert.equal(ctx!.query.participants[0]?.value, '1986-01-01');
  assert.equal(ctx!.query.participants[1]?.value, '1986-01-01');
});

test('DEC-019 withSunwebResultsLiveParams: other party-less shapes are not changed', () => {
  const threeAdults: SearchParams = { adults: 3, children: 0, babies: 0, rooms: 1 };
  assert.equal(withSunwebResultsLiveParams(threeAdults), threeAdults);
  const oneChild: SearchParams = { adults: 2, children: 1, babies: 0, rooms: 1 };
  assert.equal(withSunwebResultsLiveParams(oneChild), oneChild);
});

test('DEC-019 other occupancies are unchanged: 3 adults / 2 adults in 2 rooms stay invalid', () => {
  const threeAdults: SearchParams = {
    adults: 3,
    children: 0,
    babies: 0,
    rooms: 1,
    party: [
      { age: null, roomIndex: 0 },
      { age: null, roomIndex: 0 },
      { age: null, roomIndex: 0 },
    ],
  };
  assert.equal(resolveSunwebLiveOccupancy(threeAdults).ok, false);
  const twoRooms: SearchParams = {
    adults: 2,
    children: 0,
    babies: 0,
    rooms: 2,
    party: [
      { age: null, roomIndex: 0 },
      { age: null, roomIndex: 1 },
    ],
  };
  assert.equal(resolveSunwebLiveOccupancy(twoRooms).ok, false);
});

test('DEC-019 requiresSunwebResultsLivePrice / gate: true for Results 2A', () => {
  const params = twoAdultsParty();
  assert.equal(requiresSunwebResultsLivePrice(params), true);
  assert.equal(isLivePriceProviderOffer(makeSunwebOffer(), params), true);
});

test('DEC-019 canAttemptLivePrice: Sunweb 2A builds a context with the synthetic adult DOB', () => {
  const params = twoAdultsParty();
  const offer = makeSunwebOffer();
  const ctx = buildSunwebLiveContext(offer, params);
  assert.ok(ctx, 'expected live context with synthetic DOBs');
  assert.equal(ctx!.query.participants[0]?.value, '1986-01-01');
  assert.equal(ctx!.query.participants[1]?.value, '1986-01-01');
  assert.equal(canAttemptLivePrice(offer, params), true);
});

test('DEC-019 click-out: 2A target URL only carries the synthetic adult DOB', () => {
  const params = twoAdultsParty();
  const href = buildSunwebOccupancyClickOutHref(makeSunwebOffer(), params);
  assert.ok(href);
  const target = decodeURIComponent(href!);
  assert.match(target, /Participants\[0\]\[0\]=1986-01-01/);
  assert.match(target, /Participants\[0\]\[1\]=1986-01-01/);
  const dates = target.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  assert.deepEqual([...new Set(dates)].sort(), ['1986-01-01', '2026-10-10']);
});
