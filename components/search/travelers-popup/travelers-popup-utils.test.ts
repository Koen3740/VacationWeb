import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_TOTAL_TRAVELERS,
  addTraveller,
  assignTravellerRoom,
  calendarDateFromParts,
  createDefaultTravelersState,
  derivedAgeYears,
  isValidIsoDateOfBirth,
  normalizeTravelersState,
  parseTravelersFromQuery,
  partyHasStoredCategory,
  removeTraveller,
  serializeTravelersToQuery,
  setRoomCount,
  setTravellerCount,
  setTravellerDateOfBirth,
  travelersStateToParty,
  type TravelersState,
} from './travelers-popup-utils';

const TODAY = new Date(2026, 7, 18);

function partyOfFour(): TravelersState {
  return normalizeTravelersState({
    travellers: [
      { id: 't-1', dateOfBirth: '1980-03-12' },
      { id: 't-2', dateOfBirth: '1982-08-07' },
      { id: 't-3', dateOfBirth: '2011-06-14' },
      { id: 't-4', dateOfBirth: '2022-01-22' },
    ],
    roomCount: 2,
    roomAssignments: [0, 0, 0, 1],
  });
}

test('A. 2 travellers + 1 room + 2 dates of birth round-trip in query', () => {
  const state = normalizeTravelersState({
    travellers: [
      { id: 't-1', dateOfBirth: '1980-03-12' },
      { id: 't-2', dateOfBirth: '1982-08-07' },
    ],
    roomCount: 1,
    roomAssignments: [0, 0],
  });

  const query = serializeTravelersToQuery(state);
  assert.equal(query.adults, '2');
  assert.equal(query.dob, '1980-03-12,1982-08-07');
  assert.equal(query.rooms, undefined);
  assert.equal(query.partyRooms, undefined);

  const parsed = parseTravelersFromQuery(query);
  assert.ok(parsed);
  assert.equal(parsed.travellers.length, 2);
  assert.equal(parsed.roomCount, 1);
  assert.deepEqual(
    parsed.travellers.map((traveller) => traveller.dateOfBirth),
    ['1980-03-12', '1982-08-07'],
  );
  assert.deepEqual(parsed.roomAssignments, [0, 0]);
});

test('B. 4 travellers + 2 rooms keep assignment in query', () => {
  const query = serializeTravelersToQuery(partyOfFour());
  assert.equal(query.adults, '4');
  assert.equal(query.rooms, '2');
  assert.equal(query.dob, '1980-03-12,1982-08-07,2011-06-14,2022-01-22');
  assert.equal(query.partyRooms, '1,1,1,2');

  const parsed = parseTravelersFromQuery(query);
  assert.ok(parsed);
  assert.equal(parsed.roomCount, 2);
  assert.deepEqual(parsed.roomAssignments, [0, 0, 0, 1]);
  assert.deepEqual(
    travelersStateToParty(parsed).map((traveller) => traveller.roomIndex),
    [0, 0, 0, 1],
  );
});

test('C. changing traveller count grows and shrinks without inventing dates', () => {
  const started = createDefaultTravelersState();
  const three = setTravellerCount(started, 3);
  assert.equal(three.travellers.length, 3);
  assert.equal(three.travellers[2].dateOfBirth, null);
  assert.deepEqual(
    three.travellers.map((traveller) => traveller.dateOfBirth),
    [null, null, null],
  );

  const withDob = setTravellerDateOfBirth(three, 0, '1980-03-12');
  const two = setTravellerCount(withDob, 2);
  assert.equal(two.travellers.length, 2);
  assert.equal(two.travellers[0].dateOfBirth, '1980-03-12');
  assert.equal(two.roomCount, 1);
});

test('D. changing room count clamps to travellers and collapses to room 1', () => {
  const four = setTravellerCount(createDefaultTravelersState(), 4);
  const twoRooms = setRoomCount(four, 2);
  assert.equal(twoRooms.roomCount, 2);
  const assigned = assignTravellerRoom(twoRooms, 3, 1);
  assert.deepEqual(assigned.roomAssignments, [0, 0, 0, 1]);

  assert.equal(setRoomCount(assigned, 9).roomCount, 4);
  const oneRoom = setRoomCount(assigned, 1);
  assert.equal(oneRoom.roomCount, 1);
  assert.deepEqual(oneRoom.roomAssignments, [0, 0, 0, 0]);
});

test('E. add and remove traveller keep remaining dates and clamp rooms', () => {
  const withDob = setTravellerDateOfBirth(createDefaultTravelersState(), 0, '1980-03-12');
  const added = addTraveller(withDob);
  assert.equal(added.travellers.length, 3);
  assert.equal(added.travellers[0].dateOfBirth, '1980-03-12');
  assert.equal(added.travellers[2].dateOfBirth, null);

  const removed = removeTraveller(added, 1);
  assert.equal(removed.travellers.length, 2);
  assert.equal(removed.travellers[0].dateOfBirth, '1980-03-12');
  assert.equal(removed.travellers[1].dateOfBirth, null);

  let maxed = createDefaultTravelersState();
  for (let index = 0; index < 20; index += 1) {
    maxed = addTraveller(maxed);
  }
  assert.equal(maxed.travellers.length, MAX_TOTAL_TRAVELERS);
  assert.equal(addTraveller(maxed).travellers.length, MAX_TOTAL_TRAVELERS);
});

test('G. legacy occupancy query without dob stays readable and does not invent dates', () => {
  const parsed = parseTravelersFromQuery({
    adults: '2',
    children: '1',
    babies: '0',
    rooms: '1',
  });
  assert.ok(parsed);
  assert.equal(parsed.travellers.length, 3);
  assert.equal(parsed.roomCount, 1);
  assert.ok(parsed.travellers.every((traveller) => traveller.dateOfBirth === null));
});

test('H. travellers store dateOfBirth only — no provider age category', () => {
  const state = partyOfFour();
  for (const traveller of state.travellers) {
    assert.deepEqual(Object.keys(traveller).sort(), ['dateOfBirth', 'id']);
    assert.equal('category' in traveller, false);
    assert.equal('ageBand' in traveller, false);
  }

  const query = serializeTravelersToQuery(state);
  assert.equal('children' in query, false);
  assert.equal('babies' in query, false);
  assert.ok(!JSON.stringify(query).includes('child'));
  assert.ok(!JSON.stringify(query).includes('baby'));
  assert.equal(partyHasStoredCategory(state), false);

  const party = travelersStateToParty(state);
  for (const traveller of party) {
    assert.deepEqual(Object.keys(traveller).sort(), ['dateOfBirth', 'roomIndex']);
  }
});

test('date of birth validation rejects impossible and future dates', () => {
  assert.equal(isValidIsoDateOfBirth('1980-03-12', TODAY), true);
  assert.equal(isValidIsoDateOfBirth('2026-08-18', TODAY), true);
  assert.equal(isValidIsoDateOfBirth('2026-08-19', TODAY), false);
  assert.equal(isValidIsoDateOfBirth('2021-02-29', TODAY), false);
  assert.equal(isValidIsoDateOfBirth('2020-02-29', TODAY), true);
  assert.equal(isValidIsoDateOfBirth('1980-13-01', TODAY), false);
  assert.equal(calendarDateFromParts(2020, 2, 31, TODAY), null);
  assert.equal(calendarDateFromParts(2026, 8, 19, TODAY), null);
  assert.equal(calendarDateFromParts(1980, 3, 12, TODAY), '1980-03-12');
});

test('legacy session rooms migrate to traveller count with null dates', () => {
  const migrated = normalizeTravelersState({
    rooms: [{ adults: 2, children: 1, babies: 1 }],
  });
  assert.equal(migrated.travellers.length, 4);
  assert.ok(migrated.travellers.every((traveller) => traveller.dateOfBirth === null));
  assert.equal(migrated.roomCount, 1);
});

test('derived age is display-only and not written to query', () => {
  assert.equal(derivedAgeYears('2011-06-14', TODAY), 15);
  const query = serializeTravelersToQuery(partyOfFour());
  assert.equal(Object.prototype.hasOwnProperty.call(query, 'age'), false);
});
