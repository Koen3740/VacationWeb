import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import {
  applySunwebOccupancyToLandingUrl,
  buildSunwebLiveContext,
  buildSunwebOccupancyClickOutHref,
  extractSunwebAccommodationId,
  isSunwebFourTravellerTwoRoomSearch,
  parseSunwebLandingQuery,
  resolveSunwebFeHost,
  resolveSunwebLiveOccupancy,
  unwrapSunwebProductUrl,
} from './offer-context';

export const SUNWEB_LANDING =
  'https://www.sunweb.be/nl/vakantie/griekenland/kos/kos-stad/appartementen-bristol-seaview' +
  '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
  '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-09-26' +
  '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30';

export const SUNWEB_PRODUCT_URL =
  'https://www.sunweb.be/nl/vakantie/reizen?tt=1393_1754875_511747_&r=' +
  encodeURIComponent(SUNWEB_LANDING);

const FOUR_PAX_TWO_ROOMS = {
  adults: 2,
  children: 2,
  rooms: 2,
  party: [
    { age: null, roomIndex: 0 },
    { age: null, roomIndex: 0 },
    { age: 12, roomIndex: 1 },
    { age: 8, roomIndex: 1 },
  ],
};

// makeOffer(): departure 2026-09-26, 8 days (Sunweb nights field = days, matches Duration[0]=8):
// return = last travel day = departure + (8 - 1) = 2026-10-03.
const RETURN_REF = { returnDate: '2026-10-03' };

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'sunweb-84012-2026-09-26-8-BRU-Logies-427',
    provider: 'Sunweb',
    hotelName: 'Appartementen Bristol Seaview',
    destinationCountry: 'Griekenland',
    departureDate: '2026-09-26',
    nights: 8,
    price: 427,
    pricePerDay: 61,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: SUNWEB_PRODUCT_URL,
    ...overrides,
  };
}

test('extractSunwebAccommodationId: feed id and variant suffix', () => {
  assert.equal(extractSunwebAccommodationId('sunweb-84012'), '84012');
  assert.equal(
    extractSunwebAccommodationId('sunweb-84012-2026-09-26-8-BRU-Logies-427'),
    '84012',
  );
  assert.equal(extractSunwebAccommodationId('sunweb-a'), null);
  assert.equal(extractSunwebAccommodationId('eliza-84012'), null);
});

test('unwrapSunwebProductUrl: TradeTracker r= landing is canonical', () => {
  assert.equal(unwrapSunwebProductUrl(SUNWEB_PRODUCT_URL), SUNWEB_LANDING);
  assert.equal(unwrapSunwebProductUrl(SUNWEB_LANDING), SUNWEB_LANDING);
});

test('resolveSunwebFeHost: only proven sunweb.be host', () => {
  assert.equal(resolveSunwebFeHost(SUNWEB_PRODUCT_URL), 'www.sunweb.be');
  assert.equal(resolveSunwebFeHost('https://www.sunweb.nl/vakantie'), null);
  assert.equal(resolveSunwebFeHost('https://www.elizawashere.be/vakantie'), null);
});

test('parseSunwebLandingQuery: airport/date/duration/meal from productURL, not feed airport', () => {
  const parsed = parseSunwebLandingQuery(SUNWEB_PRODUCT_URL, '84012');
  assert.ok(parsed);
  assert.equal(parsed.accoId, '84012');
  assert.equal(parsed.departureAirport, 'BRU');
  assert.equal(parsed.departureDate, '2026-09-26');
  assert.equal(parsed.duration, '8');
  assert.equal(parsed.mealplan, 'LG');
  assert.equal(parsed.transportType, 'Flight');
  assert.equal(parsed.month, '2026-09');

  const noAirport =
    'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight' +
    '&Mealplan[0]=LG&DepartureDate[0]=2026-09-26';
  assert.equal(parseSunwebLandingQuery(noAirport, '84012'), null);
});

test('occupancy: proven 2A / 2A+1C / 4p-2r; unproven shapes stay invalid', () => {
  const twoAdults = resolveSunwebLiveOccupancy({ adults: 2 });
  assert.equal(twoAdults.ok, true);
  if (twoAdults.ok) {
    assert.equal(twoAdults.mode, 'feed-two-adults');
  }
  assert.equal(resolveSunwebLiveOccupancy({ adults: 2, rooms: 2 }).ok, false);
  assert.equal(resolveSunwebLiveOccupancy({ adults: 2, children: 2, rooms: 2 }).ok, false);
  assert.equal(resolveSunwebLiveOccupancy({ adults: 4, rooms: 2 }).ok, false);
  assert.equal(resolveSunwebLiveOccupancy({ adults: 2, children: 1 }).ok, false);

  // Without a trip reference the gate is ok but no child DOB can be derived (fail closed in the builders).
  const noReference = resolveSunwebLiveOccupancy(FOUR_PAX_TWO_ROOMS);
  assert.equal(noReference.ok && noReference.mode === 'party' ? noReference.participants.length : -1, 0);

  const occupancy = resolveSunwebLiveOccupancy(FOUR_PAX_TWO_ROOMS, RETURN_REF);
  assert.equal(occupancy.ok, true);
  if (!occupancy.ok || occupancy.mode !== 'party') {
    return;
  }
  assert.deepEqual(occupancy.participants, [
    { key: 'Participants[0][0]', value: '1986-01-01' },
    { key: 'Participants[0][1]', value: '1986-01-01' },
    { key: 'Participants[1][0]', value: '2014-10-03' },
    { key: 'Participants[1][1]', value: '2018-10-03' },
  ]);

  assert.equal(
    resolveSunwebLiveOccupancy({
      ...FOUR_PAX_TWO_ROOMS,
      party: [
        { age: null, roomIndex: 0 },
        { age: null, roomIndex: 0 },
        { age: 12, roomIndex: 0 },
        { age: 8, roomIndex: 0 },
      ],
    }).ok,
    false,
  );
  assert.equal(
    resolveSunwebLiveOccupancy({
      ...FOUR_PAX_TWO_ROOMS,
      party: [
        { age: null, roomIndex: 0 },
        { age: null, roomIndex: 0 },
        { age: 18, roomIndex: 1 }, // 18+ is not a child age
        { age: 8, roomIndex: 1 },
      ],
    }).ok,
    false,
  );
});

test('isSunwebFourTravellerTwoRoomSearch: live-required shape without inventing DOBs', () => {
  assert.equal(isSunwebFourTravellerTwoRoomSearch({ adults: 2 }), false);
  assert.equal(isSunwebFourTravellerTwoRoomSearch({ adults: 2, rooms: 2 }), false);
  assert.equal(isSunwebFourTravellerTwoRoomSearch({ adults: 2, children: 2, rooms: 2 }), true);
  assert.equal(isSunwebFourTravellerTwoRoomSearch({ adults: 4, rooms: 2 }), true);
  assert.equal(isSunwebFourTravellerTwoRoomSearch(FOUR_PAX_TWO_ROOMS), true);
});

test('applySunwebOccupancyToLandingUrl replaces feed 2A Participants', () => {
  const occupancy = resolveSunwebLiveOccupancy(FOUR_PAX_TWO_ROOMS, RETURN_REF);
  assert.ok(occupancy.ok && occupancy.mode === 'party');
  if (!occupancy.ok || occupancy.mode !== 'party') {
    return;
  }
  const landing = applySunwebOccupancyToLandingUrl(SUNWEB_LANDING, occupancy.participants);
  assert.ok(landing);
  const url = new URL(landing);
  assert.equal(url.searchParams.get('Participants[0][0]'), '1986-01-01');
  assert.equal(url.searchParams.get('Participants[0][1]'), '1986-01-01');
  assert.equal(url.searchParams.get('Participants[1][0]'), '2014-10-03');
  assert.equal(url.searchParams.get('Participants[1][1]'), '2018-10-03');
  assert.equal(url.searchParams.get('Participants[0][2]'), null);
});

test('buildSunwebLiveContext: mapping + occupancy gate uses synthetic party DOBs not feed 2A', () => {
  const ok = buildSunwebLiveContext(makeOffer(), FOUR_PAX_TWO_ROOMS);
  assert.ok(ok);
  assert.equal(ok.accoId, '84012');
  assert.equal(ok.feHost, 'www.sunweb.be');
  assert.equal(ok.query.departureAirport, 'BRU');
  assert.equal(ok.query.departureDate, '2026-09-26');
  assert.equal(ok.query.participants[0].value, '1986-01-01');
  assert.equal(ok.query.participants[3].value, '2018-10-03');
  const landing = new URL(ok.landingUrl);
  assert.equal(landing.searchParams.get('Participants[0][0]'), '1986-01-01');
  assert.equal(landing.searchParams.get('Participants[1][1]'), '2018-10-03');
  assert.equal(landing.searchParams.get('Participants[0][1]'), '1986-01-01');
  assert.ok(!ok.landingUrl.includes('1996-07-30'));

  const twoAdults = buildSunwebLiveContext(makeOffer(), { adults: 2 });
  assert.ok(twoAdults);
  assert.equal(twoAdults.query.participants[0]?.value, '1996-07-30');
  assert.equal(twoAdults.query.participants[1]?.value, '1996-07-30');
  assert.equal(
    buildSunwebLiveContext(makeOffer({ deepLink: 'https://www.sunweb.be/x' }), FOUR_PAX_TWO_ROOMS),
    null,
  );
});

test('buildSunwebOccupancyClickOutHref: TT wrap keeps tt= and TEST B Participants', () => {
  const href = buildSunwebOccupancyClickOutHref(makeOffer(), FOUR_PAX_TWO_ROOMS);
  assert.ok(href);
  const outer = new URL(href);
  assert.equal(outer.searchParams.get('tt'), '1393_1754875_511747_');
  const landing = new URL(unwrapSunwebProductUrl(href));
  assert.equal(landing.hostname, 'www.sunweb.be');
  assert.equal(landing.searchParams.get('Duration[0]'), '8');
  assert.equal(landing.searchParams.get('TransportType[0]'), 'Flight');
  assert.equal(landing.searchParams.get('Mealplan[0]'), 'LG');
  assert.equal(landing.searchParams.get('DepartureAirport[0]'), 'BRU');
  assert.equal(landing.searchParams.get('DepartureDate[0]'), '2026-09-26');
  assert.equal(landing.searchParams.get('Participants[0][0]'), '1986-01-01');
  assert.equal(landing.searchParams.get('Participants[0][1]'), '1986-01-01');
  assert.equal(landing.searchParams.get('Participants[1][0]'), '2014-10-03');
  assert.equal(landing.searchParams.get('Participants[1][1]'), '2018-10-03');
  assert.equal(landing.searchParams.get('Participants[0][2]'), null);
  assert.ok(!href.includes('1996-07-30'));
  assert.ok(!unwrapSunwebProductUrl(href).includes('1996-07-30'));
});

test('buildSunwebOccupancyClickOutHref: 2A and unusable landing fail closed', () => {
  assert.equal(buildSunwebOccupancyClickOutHref(makeOffer(), { adults: 2, rooms: 1 }), null);
  assert.equal(
    buildSunwebOccupancyClickOutHref(
      makeOffer({ deepLink: 'https://www.sunweb.be/x' }),
      FOUR_PAX_TWO_ROOMS,
    ),
    null,
  );
});
