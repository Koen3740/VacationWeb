import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  MAX_TOTAL_TRAVELERS,
  addChild,
  assignTravellerRoom,
  canDecreaseAdults,
  createDefaultTravelersState,
  getTotalTravelers,
  getTravelersTotals,
  isTravelersStateComplete,
  normalizeTravelersState,
  parseTravelersFromQuery,
  removeChild,
  setAdultCount,
  setChildAge,
  setChildCount,
  setRoomCount,
  travelersStateToParty,
  writeTravelersToQuery,
  type TravelersState,
} from './travelers-popup-utils';
import {
  deriveOccupancyCounts,
  isBabyAge,
  isValidChildAge,
} from '../../../lib/search/traveler-contract';

const ROOT = process.cwd();

function stateOf(adults: number, childAges: Array<number | null>, roomCount = 1, roomAssignments: number[] = []) {
  return normalizeTravelersState({ adults, childAges, roomCount, roomAssignments });
}

function partyOfFour(): TravelersState {
  return stateOf(2, [15, 4], 2, [0, 0, 0, 1]);
}

function queryOf(state: TravelersState): URLSearchParams {
  const query = new URLSearchParams();
  writeTravelersToQuery(query, state);
  return query;
}

test('TRAVELLER: 1 adult and 2 adults are valid; adults >= 1', () => {
  const one = stateOf(1, []);
  assert.equal(one.adults, 1);
  assert.equal(getTotalTravelers(one), 1);
  assert.equal(canDecreaseAdults(one), false);
  assert.equal(setAdultCount(one, 0).adults, 1);
  const two = stateOf(2, []);
  assert.equal(two.adults, 2);
  assert.equal(isTravelersStateComplete(two), true);
  assert.equal(createDefaultTravelersState().adults, 2);
  assert.equal(normalizeTravelersState({ adults: 0, childAges: [] }).adults, 1);
});

test('TRAVELLER: child ages 0, 1, 2, 11, 12, 17 are accepted', () => {
  for (const age of [0, 1, 2, 11, 12, 17]) {
    assert.equal(isValidChildAge(age), true, String(age));
    const state = setChildAge(addChild(stateOf(2, [])), 0, age);
    assert.deepEqual(state.childAges, [age]);
    assert.equal(isTravelersStateComplete(state), true);
  }
});

test('TRAVELLER: invalid ages -1 and 18 (and non-integers) are rejected', () => {
  for (const age of [-1, 18, 2.5, Number.NaN]) {
    assert.equal(isValidChildAge(age), false, String(age));
    const state = setChildAge(addChild(stateOf(2, [])), 0, age);
    assert.deepEqual(state.childAges, [null]);
    assert.equal(isTravelersStateComplete(state), false);
  }
  assert.deepEqual(normalizeTravelersState({ adults: 2, childAges: [-1, 18] }).childAges, [null, null]);
});

test('DERIVED: age 0 and 1 are babies, 2 and 17 are children', () => {
  assert.equal(isBabyAge(0), true);
  assert.equal(isBabyAge(1), true);
  assert.equal(isBabyAge(2), false);
  assert.equal(isBabyAge(17), false);
  assert.deepEqual(deriveOccupancyCounts(2, [0]), { adults: 2, children: 0, babies: 1 });
  assert.deepEqual(deriveOccupancyCounts(2, [1]), { adults: 2, children: 0, babies: 1 });
  assert.deepEqual(deriveOccupancyCounts(2, [2]), { adults: 2, children: 1, babies: 0 });
  assert.deepEqual(deriveOccupancyCounts(2, [17]), { adults: 2, children: 1, babies: 0 });
  // Koen's example: adults=2, childAges=[5,1] => children=1, babies=1
  assert.deepEqual(deriveOccupancyCounts(2, [5, 1]), { adults: 2, children: 1, babies: 1 });
  assert.deepEqual(getTravelersTotals(stateOf(2, [5, 1])), { adults: 2, children: 1, babies: 1 });
});

test('A. adults + child ages round-trip in the query (no DOB, derived children/babies)', () => {
  const state = stateOf(2, [5, 1]);
  const query = queryOf(state);
  assert.equal(query.get('adults'), '2');
  assert.equal(query.get('childAges'), '5,1');
  assert.equal(query.get('children'), '1');
  assert.equal(query.get('babies'), '1');
  assert.equal(query.get('rooms'), null);
  assert.equal(query.get('partyRooms'), null);
  assert.equal(query.get('dob'), null);

  const parsed = parseTravelersFromQuery(Object.fromEntries(query));
  assert.ok(parsed);
  assert.equal(parsed.adults, 2);
  assert.deepEqual(parsed.childAges, [5, 1]);
  assert.equal(parsed.roomCount, 1);
});

test('B. 4 travellers + 2 rooms keep assignment in query', () => {
  const query = queryOf(partyOfFour());
  assert.equal(query.get('adults'), '2');
  assert.equal(query.get('childAges'), '15,4');
  assert.equal(query.get('rooms'), '2');
  assert.equal(query.get('partyRooms'), '1,1,1,2');

  const parsed = parseTravelersFromQuery(Object.fromEntries(query));
  assert.ok(parsed);
  assert.equal(parsed.roomCount, 2);
  assert.deepEqual(parsed.roomAssignments, [0, 0, 0, 1]);
  assert.deepEqual(
    travelersStateToParty(parsed).map((traveller) => traveller.roomIndex),
    [0, 0, 0, 1],
  );
  assert.deepEqual(
    travelersStateToParty(parsed).map((traveller) => traveller.age),
    [null, null, 15, 4],
  );
});

test('C. changing adults and children counts grows and shrinks without inventing ages', () => {
  const started = createDefaultTravelersState();
  const withChildren = setChildCount(started, 2);
  assert.deepEqual(withChildren.childAges, [null, null]);
  assert.equal(isTravelersStateComplete(withChildren), false);
  const aged = setChildAge(setChildAge(withChildren, 0, 7), 1, 1);
  assert.equal(isTravelersStateComplete(aged), true);
  const one = setChildCount(aged, 1);
  assert.deepEqual(one.childAges, [7]);
  assert.equal(setAdultCount(one, 4).adults, 4);
  assert.equal(getTotalTravelers(setAdultCount(one, 4)), 5);
});

test('D. changing room count clamps to travellers and collapses to room 1', () => {
  const four = setChildCount(stateOf(2, []), 2);
  const twoRooms = setRoomCount(four, 2);
  assert.equal(twoRooms.roomCount, 2);
  const assigned = assignTravellerRoom(twoRooms, 3, 1);
  assert.deepEqual(assigned.roomAssignments, [0, 0, 0, 1]);

  assert.equal(setRoomCount(assigned, 9).roomCount, 4);
  const oneRoom = setRoomCount(assigned, 1);
  assert.equal(oneRoom.roomCount, 1);
  assert.deepEqual(oneRoom.roomAssignments, [0, 0, 0, 0]);
});

test('E. add and remove child keep the other ages and clamp the maximum', () => {
  let state = stateOf(2, [3, 9]);
  state = removeChild(state, 0);
  assert.deepEqual(state.childAges, [9]);
  let maxed = createDefaultTravelersState();
  for (let index = 0; index < 20; index += 1) {
    maxed = addChild(maxed);
  }
  assert.equal(getTotalTravelers(maxed), MAX_TOTAL_TRAVELERS);
  assert.equal(getTotalTravelers(addChild(maxed)), MAX_TOTAL_TRAVELERS);
  assert.equal(getTotalTravelers(setAdultCount(maxed, 9)), MAX_TOTAL_TRAVELERS);
});

test('G. legacy count-only query stays readable; children have an unknown age (not searchable)', () => {
  const parsed = parseTravelersFromQuery({ adults: '2', children: '1', babies: '0', rooms: '1' });
  assert.ok(parsed);
  assert.equal(parsed.adults, 2);
  assert.deepEqual(parsed.childAges, [null]);
  assert.equal(isTravelersStateComplete(parsed), false);
  assert.equal(parsed.roomCount, 1);
});

test('legacy dob= query is converted to ages and the DOBs are dropped', () => {
  const year = new Date().getFullYear();
  const parsed = parseTravelersFromQuery({
    adults: '3',
    dob: `1980-03-12,1982-08-07,${year - 9}-01-01`,
  });
  assert.ok(parsed);
  assert.equal(parsed.adults, 2);
  assert.deepEqual(parsed.childAges, [9]);
  assert.equal(JSON.stringify(parsed).includes('1980'), false);
});

test('H. state holds adults + ages only: no dateOfBirth, no category', () => {
  const state = partyOfFour();
  assert.deepEqual(Object.keys(state).sort(), ['adults', 'childAges', 'roomAssignments', 'roomCount']);
  const party = travelersStateToParty(state);
  for (const traveller of party) {
    assert.deepEqual(Object.keys(traveller).sort(), ['age', 'roomIndex']);
  }
  assert.equal(JSON.stringify(state).includes('dateOfBirth'), false);
});

test('legacy session rooms migrate to adults and children with unknown ages', () => {
  const migrated = normalizeTravelersState({
    rooms: [{ adults: 2, children: 1, babies: 1 }],
  });
  assert.equal(migrated.adults, 2);
  assert.deepEqual(migrated.childAges, [null, null]);
  assert.equal(migrated.roomCount, 1);
});

test('legacy sessionStorage travellers[].dateOfBirth do not crash and are not kept', () => {
  const year = new Date().getFullYear();
  const migrated = normalizeTravelersState({
    travellers: [
      { id: 't-1', dateOfBirth: '1980-03-12' },
      { id: 't-2', dateOfBirth: '1982-08-07' },
      { id: 't-3', dateOfBirth: `${year - 6}-01-01` },
      { id: 't-4', dateOfBirth: null },
    ],
    roomCount: 2,
    roomAssignments: [0, 0, 0, 1],
  });
  assert.equal(migrated.adults, 3);
  assert.deepEqual(migrated.childAges, [6]);
  assert.equal(migrated.roomCount, 2);
  const serialized = JSON.stringify(migrated);
  assert.equal(serialized.includes('1980'), false);
  assert.equal(serialized.includes('dateOfBirth'), false);
  assert.doesNotThrow(() => normalizeTravelersState({ travellers: 'broken' }));
  assert.doesNotThrow(() => normalizeTravelersState(42));
});

test('popup UI: adults stepper + child age selects, no date-of-birth fields', () => {
  const src = readFileSync(join(ROOT, 'components/search/travelers-popup/travelers-popup.tsx'), 'utf8');
  assert.ok(src.includes('Volwassenen'));
  assert.ok(src.includes('Leeftijd'));
  assert.equal(/dateOfBirth|MONTHS|Geboortedatum|geboortedatum|parseDobParts|type="date"/.test(src), false);
  assert.equal(/Kinderen/.test(src), true);
});
