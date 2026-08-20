import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import {
  applyElizaOccupancyToLandingUrl,
  buildElizaLiveContext,
  buildElizaOccupancyClickOutHref,
  extractElizaAccommodationId,
  isElizaFourTravellerTwoRoomSearch,
  parseElizaLandingQuery,
  resolveElizaFeHost,
  resolveElizaLiveOccupancy,
  unwrapElizaProductUrl,
} from './offer-context';

export const ELIZA_LANDING =
  'https://www.elizawashere.be/spanje/andalusie/ronda/casita-paradise-island' +
  '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
  '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-11-19' +
  '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30';

export const ELIZA_PRODUCT_URL =
  'https://www.elizawashere.be/reizen?tt=1327_2084000_511747_&r=' +
  encodeURIComponent(ELIZA_LANDING);

const FOUR_PAX_TWO_ROOMS = {
  adults: 2,
  children: 2,
  rooms: 2,
  party: [
    { dateOfBirth: '1990-01-15', roomIndex: 0 },
    { dateOfBirth: '1988-03-03', roomIndex: 0 },
    { dateOfBirth: '2014-06-14', roomIndex: 1 },
    { dateOfBirth: '2018-01-22', roomIndex: 1 },
  ],
};

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'eliza-6270665',
    provider: 'Eliza was here',
    hotelName: 'Casita Paradise Island',
    destinationCountry: 'Spanje',
    departureDate: '2026-11-19',
    nights: 7,
    price: 599,
    pricePerDay: 86,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: ELIZA_PRODUCT_URL,
    ...overrides,
  };
}

test('extractElizaAccommodationId: feed id and variant suffix', () => {
  assert.equal(extractElizaAccommodationId('eliza-6270665'), '6270665');
  assert.equal(extractElizaAccommodationId('eliza-6270665-2026-11-19'), '6270665');
  assert.equal(extractElizaAccommodationId('eliza-a'), null);
  assert.equal(extractElizaAccommodationId('sunweb-6270665'), null);
});

test('unwrapElizaProductUrl: TradeTracker r= landing is canonical', () => {
  assert.equal(unwrapElizaProductUrl(ELIZA_PRODUCT_URL), ELIZA_LANDING);
  assert.equal(unwrapElizaProductUrl(ELIZA_LANDING), ELIZA_LANDING);
});

test('resolveElizaFeHost: only proven elizawashere.be host', () => {
  assert.equal(resolveElizaFeHost(ELIZA_PRODUCT_URL), 'www.elizawashere.be');
  assert.equal(resolveElizaFeHost('https://www.elizawashere.nl/reizen'), null);
  assert.equal(resolveElizaFeHost('https://www.sunweb.be/vakantie'), null);
});

test('parseElizaLandingQuery: airport/date/duration/meal/occupancy from productURL', () => {
  const parsed = parseElizaLandingQuery(ELIZA_PRODUCT_URL, '6270665');
  assert.ok(parsed);
  assert.equal(parsed.accoId, '6270665');
  assert.equal(parsed.departureAirport, 'BRU');
  assert.equal(parsed.departureDate, '2026-11-19');
  assert.equal(parsed.duration, '8');
  assert.equal(parsed.mealplan, 'LG');
  assert.equal(parsed.transportType, 'Flight');
  assert.equal(parsed.month, '2026-11');
  assert.equal(parsed.participants.length, 2);
  assert.equal(parsed.participants[0].value, '1996-07-30');
});

test('parseElizaLandingQuery: feed property airport is not used; missing URL airport fails', () => {
  const noAirport =
    'https://www.elizawashere.be/spanje/x?Duration[0]=8&TransportType[0]=Flight' +
    '&Mealplan[0]=LG&DepartureDate[0]=2026-11-19' +
    '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30';
  assert.equal(parseElizaLandingQuery(noAirport, '6270665'), null);
});

test('occupancy: default 2A only; 4p/2r needs party DOBs', () => {
  assert.equal(resolveElizaLiveOccupancy({}).ok, true);
  assert.equal(resolveElizaLiveOccupancy({ adults: 2 }).ok, true);
  const twoAdults = resolveElizaLiveOccupancy({ adults: 2, rooms: 1 });
  assert.equal(twoAdults.ok, true);
  if (twoAdults.ok) {
    assert.equal(twoAdults.mode, 'feed-two-adults');
  }
  assert.equal(resolveElizaLiveOccupancy({ adults: 2, children: 1 }).ok, false);
  assert.equal(resolveElizaLiveOccupancy({ adults: 2, babies: 1 }).ok, false);
  assert.equal(resolveElizaLiveOccupancy({ adults: 2, rooms: 2 }).ok, false);
  assert.equal(resolveElizaLiveOccupancy({ adults: 3 }).ok, false);
  assert.equal(resolveElizaLiveOccupancy({ adults: 2, children: 2, rooms: 2 }).ok, false);
  const four = resolveElizaLiveOccupancy(FOUR_PAX_TWO_ROOMS);
  assert.equal(four.ok, true);
  if (four.ok && four.mode === 'four-travellers-two-rooms') {
    assert.equal(four.participants[0].value, '1990-01-15');
    assert.equal(four.participants[3].value, '2018-01-22');
    assert.equal(four.participants[2].key, 'Participants[1][0]');
  }
  assert.equal(isElizaFourTravellerTwoRoomSearch(FOUR_PAX_TWO_ROOMS), true);
  assert.equal(isElizaFourTravellerTwoRoomSearch({ adults: 2 }), false);
});

test('buildElizaLiveContext: mapping + occupancy gate', () => {
  const ok = buildElizaLiveContext(makeOffer(), { adults: 2 });
  assert.ok(ok);
  assert.equal(ok.accoId, '6270665');
  assert.equal(ok.query.departureAirport, 'BRU');
  assert.equal(ok.query.departureDate, '2026-11-19');
  assert.equal(ok.query.duration, '8');
  assert.equal(ok.feHost, 'www.elizawashere.be');
  assert.equal(ok.query.participants[0].value, '1996-07-30');

  assert.equal(buildElizaLiveContext(makeOffer(), { adults: 2, children: 1 }), null);
  assert.equal(
    buildElizaLiveContext(makeOffer({ deepLink: 'https://www.elizawashere.be/x' }), { adults: 2 }),
    null,
  );
});

test('applyElizaOccupancyToLandingUrl replaces feed 2A Participants', () => {
  const occupancy = resolveElizaLiveOccupancy(FOUR_PAX_TWO_ROOMS);
  assert.ok(occupancy.ok && occupancy.mode === 'four-travellers-two-rooms');
  if (!occupancy.ok || occupancy.mode !== 'four-travellers-two-rooms') {
    return;
  }
  const landing = applyElizaOccupancyToLandingUrl(ELIZA_LANDING, occupancy.participants);
  assert.ok(landing);
  const url = new URL(landing);
  assert.equal(url.searchParams.get('Participants[0][0]'), '1990-01-15');
  assert.equal(url.searchParams.get('Participants[0][1]'), '1988-03-03');
  assert.equal(url.searchParams.get('Participants[1][0]'), '2014-06-14');
  assert.equal(url.searchParams.get('Participants[1][1]'), '2018-01-22');
  assert.equal(url.searchParams.get('Participants[0][2]'), null);
  assert.ok(!landing.includes('1996-07-30'));
});

test('buildElizaLiveContext: 4p/2r uses party DOBs not feed 2A', () => {
  const ok = buildElizaLiveContext(makeOffer(), FOUR_PAX_TWO_ROOMS);
  assert.ok(ok);
  assert.equal(ok.query.departureAirport, 'BRU');
  assert.equal(ok.query.departureDate, '2026-11-19');
  assert.equal(ok.query.participants[0].value, '1990-01-15');
  assert.equal(ok.query.participants[3].value, '2018-01-22');
  const landing = new URL(ok.landingUrl);
  assert.equal(landing.searchParams.get('Participants[0][0]'), '1990-01-15');
  assert.equal(landing.searchParams.get('Participants[1][1]'), '2018-01-22');
  assert.ok(!ok.landingUrl.includes('1996-07-30'));
  assert.equal(buildElizaLiveContext(makeOffer(), { adults: 2, children: 2, rooms: 2 }), null);
});

test('buildElizaOccupancyClickOutHref: TT wrap keeps tt= and TEST B Participants', () => {
  const href = buildElizaOccupancyClickOutHref(makeOffer(), FOUR_PAX_TWO_ROOMS);
  assert.ok(href);
  const outer = new URL(href);
  assert.equal(outer.searchParams.get('tt'), '1327_2084000_511747_');
  const landing = new URL(unwrapElizaProductUrl(href));
  assert.equal(landing.hostname, 'www.elizawashere.be');
  assert.equal(landing.searchParams.get('Duration[0]'), '8');
  assert.equal(landing.searchParams.get('TransportType[0]'), 'Flight');
  assert.equal(landing.searchParams.get('Mealplan[0]'), 'LG');
  assert.equal(landing.searchParams.get('DepartureAirport[0]'), 'BRU');
  assert.equal(landing.searchParams.get('DepartureDate[0]'), '2026-11-19');
  assert.equal(landing.searchParams.get('Participants[0][0]'), '1990-01-15');
  assert.equal(landing.searchParams.get('Participants[0][1]'), '1988-03-03');
  assert.equal(landing.searchParams.get('Participants[1][0]'), '2014-06-14');
  assert.equal(landing.searchParams.get('Participants[1][1]'), '2018-01-22');
  assert.ok(!href.includes('1996-07-30'));
  assert.ok(!unwrapElizaProductUrl(href).includes('1996-07-30'));
});

test('buildElizaOccupancyClickOutHref: 2A and unusable landing fail closed', () => {
  assert.equal(buildElizaOccupancyClickOutHref(makeOffer(), { adults: 2, rooms: 1 }), null);
  assert.equal(
    buildElizaOccupancyClickOutHref(
      makeOffer({ deepLink: 'https://www.elizawashere.be/x' }),
      FOUR_PAX_TWO_ROOMS,
    ),
    null,
  );
});
