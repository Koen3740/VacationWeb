import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import {
  CORENDON_ADULT_REFERENCE_DOB,
  CORENDON_TWO_ROOM_2A_PARTY,
} from './constants';
import {
  buildCorendonLiveContext,
  corendonFragmentDateToIso,
  extractCorendonAccommodationId,
  parseCorendonUrlFragment,
  resolveCorendonLiveOccupancy,
  unwrapCorendonProductUrl,
} from './offer-context';

const FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
const DIRECT_URL = `https://www.corendon.be/vakantie#${FRAGMENT}`;

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'corendon-9514',
    provider: 'Corendon',
    hotelName: 'Spyridoula Apartments',
    destinationCountry: 'Griekenland',
    departureDate: '2026-08-27',
    nights: 4,
    price: 458,
    pricePerDay: 115,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: DIRECT_URL,
    ...overrides,
  };
}

test('extractCorendonAccommodationId: feed id and variant suffix', () => {
  assert.equal(extractCorendonAccommodationId('corendon-9514'), '9514');
  assert.equal(extractCorendonAccommodationId('corendon-9514-2026-08-27-4'), '9514');
  assert.equal(extractCorendonAccommodationId('corendon-5007-EINPMI-041027-3-DZIU'), '5007');
  assert.equal(extractCorendonAccommodationId('corendon-a'), null);
  assert.equal(extractCorendonAccommodationId('prijsvrij-9514'), null);
});

test('unwrapCorendonProductUrl: TradeTracker u/r and direct URL', () => {
  const wrappedU =
    'https://tc.tradetracker.net/?c=1&u=' + encodeURIComponent(DIRECT_URL);
  const wrappedR =
    'https://www.prijsvrij.be/vakantie/?r=' + encodeURIComponent(DIRECT_URL);
  assert.equal(unwrapCorendonProductUrl(DIRECT_URL), DIRECT_URL);
  assert.equal(unwrapCorendonProductUrl(wrappedU), DIRECT_URL);
  assert.equal(unwrapCorendonProductUrl(wrappedR), DIRECT_URL);
});

test('parseCorendonUrlFragment: hotel, airport, DDMMYY date, duration', () => {
  const parsed = parseCorendonUrlFragment(DIRECT_URL);
  assert.ok(parsed);
  assert.equal(parsed.hotelId, '9514');
  assert.equal(parsed.accommodationCode, 'COSPY');
  assert.equal(parsed.airportRoute, 'BRUCFU');
  assert.equal(parsed.dateYymmdd, '270826');
  assert.equal(parsed.durationNights, '3-4-3');
  assert.equal(parsed.roomBoard, 'SZ-U');
  assert.equal(corendonFragmentDateToIso(parsed.dateYymmdd), '2026-08-27');
});

test('parseCorendonUrlFragment: empty airport route is not a live-price fragment', () => {
  const parsed = parseCorendonUrlFragment(
    'https://www.corendon.be/nederland/noord-holland/amsterdam/hotel#9953.NLVIL..011226.1.DZ2-F..',
  );
  assert.equal(parsed, null);
});

test('occupancy: 2A 1-room or proven 2-room; children without party DOBs invalid', () => {
  assert.equal(resolveCorendonLiveOccupancy({}).ok, true);
  assert.equal(resolveCorendonLiveOccupancy({ adults: 2 }).ok, true);
  assert.equal(resolveCorendonLiveOccupancy({ adults: 2, rooms: 2 }).ok, true);
  const twoAdultsNoDob = resolveCorendonLiveOccupancy({
    adults: 2,
    children: 0,
    babies: 0,
    rooms: 1,
    party: [
      { dateOfBirth: null, roomIndex: 0 },
      { dateOfBirth: null, roomIndex: 0 },
    ],
  });
  assert.equal(twoAdultsNoDob.ok, true);
  if (twoAdultsNoDob.ok) {
    assert.equal(twoAdultsNoDob.pricingRoute, 'upsales');
    assert.equal(twoAdultsNoDob.roomCount, 1);
    if (twoAdultsNoDob.pricingRoute === 'upsales') {
      assert.deepEqual(twoAdultsNoDob.pax, [
        { birthDate: CORENDON_ADULT_REFERENCE_DOB, roomNr: 1 },
        { birthDate: CORENDON_ADULT_REFERENCE_DOB, roomNr: 1 },
      ]);
    }
  }
  const twoAdultsNoParty = resolveCorendonLiveOccupancy({
    adults: 2,
    children: 0,
    babies: 0,
    rooms: 1,
  });
  assert.equal(twoAdultsNoParty.ok, true);
  if (twoAdultsNoParty.ok) {
    assert.equal(twoAdultsNoParty.pricingRoute, 'upsales');
    if (twoAdultsNoParty.pricingRoute === 'upsales') {
      assert.deepEqual(twoAdultsNoParty.pax, [
        { birthDate: CORENDON_ADULT_REFERENCE_DOB, roomNr: 1 },
        { birthDate: CORENDON_ADULT_REFERENCE_DOB, roomNr: 1 },
      ]);
    }
  }
  const twoRoomsNoDob = resolveCorendonLiveOccupancy({
    adults: 2,
    children: 0,
    babies: 0,
    rooms: 2,
  });
  assert.equal(twoRoomsNoDob.ok, true);
  if (twoRoomsNoDob.ok) {
    assert.equal(twoRoomsNoDob.pricingRoute, 'lowest');
    assert.equal('pax' in twoRoomsNoDob, false);
  }
  const twoAdultsIso = resolveCorendonLiveOccupancy({
    party: [
      { dateOfBirth: '1980-03-12', roomIndex: 0 },
      { dateOfBirth: '1982-08-07', roomIndex: 0 },
    ],
  });
  assert.equal(twoAdultsIso.ok, true);
  if (twoAdultsIso.ok) {
    assert.equal(twoAdultsIso.pricingRoute, 'upsales');
    assert.equal(twoAdultsIso.roomCount, 1);
    if (twoAdultsIso.pricingRoute === 'upsales') {
      assert.deepEqual(twoAdultsIso.pax, [
        { birthDate: '1980-03-12', roomNr: 1 },
        { birthDate: '1982-08-07', roomNr: 1 },
      ]);
    }
  }
  const twoAdultsTwoRooms = resolveCorendonLiveOccupancy({
    party: [
      { dateOfBirth: '1975-03-12', roomIndex: 0 },
      { dateOfBirth: '1978-06-04', roomIndex: 1 },
    ],
  });
  assert.equal(twoAdultsTwoRooms.ok, true);
  if (twoAdultsTwoRooms.ok) {
    assert.equal(twoAdultsTwoRooms.pricingRoute, 'upsales');
    assert.equal(twoAdultsTwoRooms.roomCount, 2);
  }
  const oneMissingDob = resolveCorendonLiveOccupancy({
    party: [
      { dateOfBirth: '1980-03-12', roomIndex: 0 },
      { dateOfBirth: null, roomIndex: 0 },
    ],
  });
  assert.equal(oneMissingDob.ok, true);
  if (oneMissingDob.ok) {
    assert.equal(oneMissingDob.pricingRoute, 'lowest');
  }
  assert.equal(resolveCorendonLiveOccupancy({ adults: 2, children: 1 }).ok, false);
  assert.equal(resolveCorendonLiveOccupancy({ adults: 2, babies: 1 }).ok, false);
  assert.equal(resolveCorendonLiveOccupancy({ adults: 3 }).ok, false);
  assert.equal(resolveCorendonLiveOccupancy({ adults: 4, rooms: 2 }).ok, false);
  const twoAdultsPlusChildNoDob = resolveCorendonLiveOccupancy({
    adults: 2,
    children: 1,
    babies: 0,
    rooms: 1,
    party: [
      { dateOfBirth: null, roomIndex: 0 },
      { dateOfBirth: null, roomIndex: 0 },
    ],
  });
  assert.equal(twoAdultsPlusChildNoDob.ok, true);
  if (twoAdultsPlusChildNoDob.ok) {
    assert.equal(twoAdultsPlusChildNoDob.pricingRoute, 'lowest');
    assert.equal('pax' in twoAdultsPlusChildNoDob, false);
  }
  const twoAdultsOneChildMissingChildDob = resolveCorendonLiveOccupancy({
    adults: 2,
    children: 1,
    party: [
      { dateOfBirth: '1980-03-12', roomIndex: 0 },
      { dateOfBirth: '1982-08-07', roomIndex: 0 },
      { dateOfBirth: null, roomIndex: 0 },
    ],
  });
  assert.equal(twoAdultsOneChildMissingChildDob.ok, false);
  const twoAdultsOneChild = resolveCorendonLiveOccupancy({
    adults: 2,
    children: 1,
    party: [
      { dateOfBirth: '1986-01-01', roomIndex: 0 },
      { dateOfBirth: '1986-01-01', roomIndex: 0 },
      { dateOfBirth: '2016-01-01', roomIndex: 0 },
    ],
  });
  assert.equal(twoAdultsOneChild.ok, true);
  if (twoAdultsOneChild.ok) {
    assert.equal(twoAdultsOneChild.pricingRoute, 'upsales');
    assert.equal(twoAdultsOneChild.roomCount, 1);
    if (twoAdultsOneChild.pricingRoute === 'upsales') {
      assert.deepEqual(twoAdultsOneChild.pax, [
        { birthDate: '1986-01-01', roomNr: 1 },
        { birthDate: '1986-01-01', roomNr: 1 },
        { birthDate: '2016-01-01', roomNr: 1 },
      ]);
    }
  }
});

test('occupancy: 4 travellers / 2 rooms with party DOBs uses upsales route', () => {
  const occupancy = resolveCorendonLiveOccupancy({
    adults: 4,
    rooms: 2,
    party: [
      { dateOfBirth: '1990-01-15', roomIndex: 0 },
      { dateOfBirth: '1988-03-03', roomIndex: 0 },
      { dateOfBirth: '2014-06-14', roomIndex: 1 },
      { dateOfBirth: '2018-01-22', roomIndex: 1 },
    ],
  });
  assert.equal(occupancy.ok, true);
  if (!occupancy.ok) {
    return;
  }
  assert.equal(occupancy.pricingRoute, 'upsales');
  assert.equal(occupancy.roomCount, 2);
  if (occupancy.pricingRoute !== 'upsales') {
    return;
  }
  assert.deepEqual(occupancy.pax, [
    { birthDate: '1990-01-15', roomNr: 1 },
    { birthDate: '1988-03-03', roomNr: 1 },
    { birthDate: '2014-06-14', roomNr: 2 },
    { birthDate: '2018-01-22', roomNr: 2 },
  ]);
  assert.equal(
    resolveCorendonLiveOccupancy({
      adults: 4,
      rooms: 2,
      party: [
        { dateOfBirth: '1990-01-15', roomIndex: 0 },
        { dateOfBirth: '1988-03-03', roomIndex: 0 },
        { dateOfBirth: '2014-06-14', roomIndex: 0 },
        { dateOfBirth: '2018-01-22', roomIndex: 0 },
      ],
    }).ok,
    false,
  );
});

test('buildCorendonLiveContext: mapping + date + occupancy', () => {
  const ok = buildCorendonLiveContext(makeOffer(), { adults: 2 });
  assert.ok(ok);
  assert.equal(ok.accommodationId, '9514');
  assert.equal(ok.departureIso, '2026-08-27');
  assert.equal(ok.fragment.airportRoute, 'BRUCFU');
  assert.equal(ok.fragment.durationNights, '3-4-3');
  assert.equal(ok.feHost, 'www.corendon.be');
  assert.equal(ok.pricingRoute, 'upsales');
  assert.deepEqual(ok.upsalesPax, [
    { birthDate: CORENDON_ADULT_REFERENCE_DOB, roomNr: 1 },
    { birthDate: CORENDON_ADULT_REFERENCE_DOB, roomNr: 1 },
  ]);

  const twoAdultsIso = buildCorendonLiveContext(makeOffer(), {
    adults: 2,
    party: [
      { dateOfBirth: '1980-03-12', roomIndex: 0 },
      { dateOfBirth: '1982-08-07', roomIndex: 0 },
    ],
  });
  assert.ok(twoAdultsIso);
  assert.equal(twoAdultsIso.pricingRoute, 'upsales');
  assert.deepEqual(twoAdultsIso.upsalesPax, [
    { birthDate: '1980-03-12', roomNr: 1 },
    { birthDate: '1982-08-07', roomNr: 1 },
  ]);

  const fourPax = buildCorendonLiveContext(makeOffer(), {
    adults: 4,
    rooms: 2,
    party: [
      { dateOfBirth: '1990-01-15', roomIndex: 0 },
      { dateOfBirth: '1988-03-03', roomIndex: 0 },
      { dateOfBirth: '2014-06-14', roomIndex: 1 },
      { dateOfBirth: '2018-01-22', roomIndex: 1 },
    ],
  });
  assert.ok(fourPax);
  assert.equal(fourPax.pricingRoute, 'upsales');
  assert.deepEqual(fourPax.partyComposition, CORENDON_TWO_ROOM_2A_PARTY);
  assert.deepEqual(fourPax.upsalesPax, [
    { birthDate: '1990-01-15', roomNr: 1 },
    { birthDate: '1988-03-03', roomNr: 1 },
    { birthDate: '2014-06-14', roomNr: 2 },
    { birthDate: '2018-01-22', roomNr: 2 },
  ]);

  const fr = buildCorendonLiveContext(
    makeOffer({
      deepLink: 'https://fr.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U',
    }),
    { adults: 2 },
  );
  assert.ok(fr);
  assert.equal(fr.feHost, 'fr.corendon.be');

  assert.equal(buildCorendonLiveContext(makeOffer(), { adults: 2, children: 1 }), null);
  const twoAdultsOneChild = buildCorendonLiveContext(makeOffer(), {
    adults: 2,
    children: 1,
    party: [
      { dateOfBirth: '1986-01-01', roomIndex: 0 },
      { dateOfBirth: '1986-01-01', roomIndex: 0 },
      { dateOfBirth: '2016-01-01', roomIndex: 0 },
    ],
  });
  assert.ok(twoAdultsOneChild);
  assert.equal(twoAdultsOneChild.pricingRoute, 'upsales');
  assert.equal(twoAdultsOneChild.upsalesPax?.length, 3);
  assert.equal(
    buildCorendonLiveContext(makeOffer({ id: 'corendon-9999' }), { adults: 2 }),
    null,
  );
  assert.equal(
    buildCorendonLiveContext(makeOffer({ deepLink: 'https://www.corendon.be/vakantie' }), { adults: 2 }),
    null,
  );
  assert.equal(
    buildCorendonLiveContext(makeOffer({ provider: 'Sunweb' }), { adults: 2 }),
    null,
  );
});
