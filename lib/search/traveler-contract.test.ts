import assert from 'node:assert/strict';
import test from 'node:test';
import { buildResultsPageHref, buildOfferDetailHref } from './pagination';
import { parseSearchParams } from './parse-search-params';
import { occupancySearchParamsChanged } from './filter-classification';
import {
  deriveOccupancyCounts,
  isBabyAge,
  isValidChildAge,
  legacyAgeFromIso,
  modelFromParty,
  partyFromModel,
  readTravelerQuery,
  writeTravelerQuery,
} from './traveler-contract';

const ISO = /\d{4}-\d{2}-\d{2}/;

function query(href: string): URLSearchParams {
  return new URLSearchParams(href.split('?')[1] ?? '');
}

test('TRAVELLER: child age validation 0..17 (0,1,2,11,12,17 valid; -1,18,1.5,NaN invalid)', () => {
  for (const age of [0, 1, 2, 11, 12, 17]) {
    assert.equal(isValidChildAge(age), true, `age ${age}`);
  }
  for (const age of [-1, 18, 1.5, Number.NaN, '5', null, undefined]) {
    assert.equal(isValidChildAge(age), false, `age ${String(age)}`);
  }
});

test('DERIVED: age < 2 is a baby, age >= 2 is a child', () => {
  assert.equal(isBabyAge(0), true);
  assert.equal(isBabyAge(1), true);
  assert.equal(isBabyAge(2), false);
  assert.equal(isBabyAge(17), false);
  assert.deepEqual(deriveOccupancyCounts(2, [5, 1]), { adults: 2, children: 1, babies: 1 });
  assert.deepEqual(deriveOccupancyCounts(1, []), { adults: 1, children: 0, babies: 0 });
  assert.deepEqual(deriveOccupancyCounts(2, [0, 1, 2, 17]), { adults: 2, children: 2, babies: 2 });
});

test('TRAVELLER: model <-> party round trip keeps adults, ages and rooms', () => {
  const model = { adults: 2, childAges: [5, 1], roomCount: 2, roomAssignments: [0, 1, 1, 0] };
  const party = partyFromModel(model);
  assert.deepEqual(party, [
    { age: null, roomIndex: 0 },
    { age: null, roomIndex: 1 },
    { age: 5, roomIndex: 1 },
    { age: 1, roomIndex: 0 },
  ]);
  assert.deepEqual(modelFromParty(party, 2), model);
});

test('URL: writer emits adults + childAges + derived children/babies and never a DOB', () => {
  const q = new URLSearchParams('dob=1980-01-01,2015-05-05');
  writeTravelerQuery(q, { adults: 2, childAges: [5, 1], roomCount: 1, roomAssignments: [0, 0, 0, 0] });
  assert.equal(q.get('adults'), '2');
  assert.equal(q.get('childAges'), '5,1');
  assert.equal(q.get('children'), '1');
  assert.equal(q.get('babies'), '1');
  assert.equal(q.get('dob'), null);
  assert.equal(q.get('rooms'), null);
  assert.equal(q.get('partyRooms'), null);
  assert.equal(ISO.test(q.toString()), false);
});

test('URL: adults-only writes empty childAges and no children/babies', () => {
  const q = new URLSearchParams();
  writeTravelerQuery(q, { adults: 1, childAges: [], roomCount: 1, roomAssignments: [0] });
  assert.equal(q.get('adults'), '1');
  assert.equal(q.get('childAges'), '');
  assert.equal(q.get('children'), null);
  assert.equal(q.get('babies'), null);
});

test('URL: multiple rooms write rooms + partyRooms (adults first, 1-based)', () => {
  const q = new URLSearchParams();
  writeTravelerQuery(q, { adults: 2, childAges: [6], roomCount: 2, roomAssignments: [0, 1, 1] });
  assert.equal(q.get('rooms'), '2');
  assert.equal(q.get('partyRooms'), '1,2,2');
});

test('URL: reader reads the current contract', () => {
  const parsed = readTravelerQuery({ adults: '2', childAges: '6,9,1', rooms: '1' });
  assert.ok(parsed);
  assert.equal(parsed.source, 'childAges');
  assert.equal(parsed.adults, 2);
  assert.deepEqual(parsed.childAges, [6, 9, 1]);
});

test('URL: reader maps invalid ages to unknown (null), never throws', () => {
  const parsed = readTravelerQuery({ adults: '2', childAges: '-1,18,x,7' });
  assert.ok(parsed);
  assert.deepEqual(parsed.childAges, [null, null, null, 7]);
});

test('URL: legacy dob= is still readable (age derived as of today, no DOB kept)', () => {
  const today = new Date(2026, 9, 3);
  assert.equal(legacyAgeFromIso('2015-10-04', today), 10);
  assert.equal(legacyAgeFromIso('2015-10-03', today), 11);
  assert.equal(legacyAgeFromIso('2030-01-01', today), null);
  const parsed = readTravelerQuery(
    { dob: ',,2015-10-03,2025-10-03', adults: '2', partyRooms: '1,1,1,1' },
    today,
  );
  assert.ok(parsed);
  assert.equal(parsed.source, 'legacy-dob');
  assert.equal(parsed.adults, 2);
  assert.deepEqual(parsed.childAges, [11, 1]);
});

test('URL: legacy counts-only links keep counts but ages stay unknown', () => {
  const parsed = readTravelerQuery({ adults: '2', children: '1', babies: '1' });
  assert.ok(parsed);
  assert.equal(parsed.source, 'legacy-counts');
  assert.deepEqual(parsed.childAges, [null, null]);
});

test('URL: parseSearchParams exposes adults, childAges, children, babies without DOB', () => {
  const params = parseSearchParams({ adults: '2', childAges: '5,1', departureStart: '2026-09-01' });
  assert.equal(params.adults, 2);
  assert.deepEqual(params.childAges, [5, 1]);
  assert.equal(params.children, 1);
  assert.equal(params.babies, 1);
  assert.equal(JSON.stringify(params).includes('dateOfBirth'), false);
  assert.equal('returnDate' in params, false);
});

test('URL: pagination, sorting and filters keep the traveller state and carry no DOB', () => {
  const params = parseSearchParams({
    adults: '2',
    childAges: '6,9,1',
    rooms: '2',
    partyRooms: '1,1,2,2,1',
    departureStart: '2026-09-01',
    country: 'Spanje',
    sort: 'price',
    stars: '4,5',
  });
  const href = buildResultsPageHref({ ...params, page: 3 }, 3);
  const q = query(href);
  assert.equal(q.get('adults'), '2');
  assert.equal(q.get('childAges'), '6,9,1');
  assert.equal(q.get('children'), '2');
  assert.equal(q.get('babies'), '1');
  assert.equal(q.get('rooms'), '2');
  assert.equal(q.get('partyRooms'), '1,1,2,2,1');
  assert.equal(q.get('sort'), 'price');
  assert.equal(q.get('stars'), params.stars?.join(','));
  assert.ok((params.stars?.length ?? 0) === 2);
  assert.equal(q.get('dob'), null);
  const withoutTripDates = new URLSearchParams(q);
  withoutTripDates.delete('departureStart');
  withoutTripDates.delete('departureEnd');
  assert.equal(ISO.test(withoutTripDates.toString()), false);
  // The built link parses back into the same traveller state.
  const again = parseSearchParams(Object.fromEntries(q.entries()));
  assert.deepEqual(again.childAges, [6, 9, 1]);
  assert.equal(again.adults, 2);
  assert.equal(again.children, 2);
  assert.equal(again.babies, 1);
});

test('URL: detail link built from search params carries no DOB', () => {
  const params = parseSearchParams({ adults: '2', childAges: '5', departureStart: '2026-09-01' });
  const href = buildOfferDetailHref('offer-1', params);
  const q = query(href);
  assert.equal(q.get('adults'), '2');
  assert.equal(q.get('childAges'), '5');
  assert.equal(q.get('dob'), null);
});

test('URL: a changed child age counts as an occupancy change (page1Ids are dropped)', () => {
  assert.equal(
    occupancySearchParamsChanged(
      new URLSearchParams('adults=2&childAges=5'),
      new URLSearchParams('adults=2&childAges=8'),
    ),
    true,
  );
  assert.equal(
    occupancySearchParamsChanged(
      new URLSearchParams('adults=2&childAges=5&sort=price'),
      new URLSearchParams('adults=2&childAges=5'),
    ),
    false,
  );
});