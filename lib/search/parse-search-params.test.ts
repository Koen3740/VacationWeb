import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSearchParams } from './parse-search-params';

test('parseSearchParams keeps occupancy and departure for Detail', () => {
  const params = parseSearchParams({
    adults: '2',
    children: '1',
    babies: '0',
    rooms: '1',
    departureStart: '2026-09-01',
    departureEnd: '2026-09-08',
    country: 'Spanje',
  });

  assert.equal(params.adults, 2);
  assert.equal(params.children, 1);
  assert.equal(params.rooms, 1);
  assert.equal(params.departureStart, '2026-09-01');
  assert.equal(params.country, 'Spanje');
  assert.equal(params.sort, 'value');
  assert.equal(params.party, undefined);
});

test('G. existing URL without dob remains readable and does not invent dates', () => {
  const params = parseSearchParams({
    adults: '2',
    children: '1',
    rooms: '1',
    departureStart: '2026-09-01',
    nights: '7,8',
    departureAirport: 'BRU',
  });

  assert.equal(params.adults, 2);
  assert.equal(params.children, 1);
  assert.equal(params.rooms, 1);
  assert.equal(params.departureStart, '2026-09-01');
  assert.deepEqual(params.nights, [7, 8]);
  assert.equal(params.departureAirport, 'BRU');
  assert.equal(params.party, undefined);
});

function isoYearsAgo(years: number): string {
  return `${new Date().getFullYear() - years}-01-01`;
}

test('childAges, adults and room assignment parse into party without a DOB', () => {
  const params = parseSearchParams({
    adults: '2',
    childAges: '15,4',
    rooms: '2',
    partyRooms: '1,1,1,2',
  });

  assert.equal(params.adults, 2);
  assert.equal(params.children, 2);
  assert.equal(params.babies, 0);
  assert.deepEqual(params.childAges, [15, 4]);
  assert.equal(params.rooms, 2);
  assert.deepEqual(params.party, [
    { age: null, roomIndex: 0 },
    { age: null, roomIndex: 0 },
    { age: 15, roomIndex: 0 },
    { age: 4, roomIndex: 1 },
  ]);
  assert.ok(params.party?.every((traveller) => !('category' in traveller) && !('dateOfBirth' in traveller)));
});

test('children and babies are derived from childAges (0,1 => baby; 2,17 => child)', () => {
  const params = parseSearchParams({ adults: '2', childAges: '0,1,2,17' });
  assert.deepEqual([params.adults, params.children, params.babies], [2, 2, 2]);
  const fromUrl = parseSearchParams({ adults: '2', children: '9', babies: '9', childAges: '5,1' });
  assert.deepEqual([fromUrl.adults, fromUrl.children, fromUrl.babies], [2, 1, 1]);
});

test('invalid child ages (-1, 18, text) make the party incomplete and are not invented', () => {
  for (const childAges of ['-1', '18', 'abc', '5,']) {
    const params = parseSearchParams({ adults: '2', childAges });
    if (childAges === '5,') {
      assert.deepEqual(params.childAges, [5]);
    } else {
      assert.equal(params.party, undefined, childAges);
      assert.equal(params.childAges, undefined, childAges);
    }
  }
});

test('legacy dob= links are still readable: age as of today, no DOB kept', () => {
  const params = parseSearchParams({
    adults: '4',
    dob: `1980-03-12,1982-08-07,${isoYearsAgo(11)},${isoYearsAgo(1)}`,
    rooms: '2',
    partyRooms: '1,1,1,2',
  });

  assert.equal(params.adults, 2);
  assert.equal(params.children, 1);
  assert.equal(params.babies, 1);
  assert.equal(params.rooms, 2);
  assert.deepEqual(params.childAges, [11, 1]);
  assert.deepEqual(params.party, [
    { age: null, roomIndex: 0 },
    { age: null, roomIndex: 0 },
    { age: 11, roomIndex: 0 },
    { age: 1, roomIndex: 1 },
  ]);
  assert.equal(JSON.stringify(params).includes('1980-03-12'), false);
});

test('Detail room query is parsed without becoming occupancy', () => {
  const params = parseSearchParams({
    adults: '2',
    childAges: '',
    rooms: '1',
    room: 'DD',
  });
  assert.equal(params.selectedRoom, 'DD');
  assert.equal(params.adults, 2);
  assert.deepEqual(params.party?.map((traveller) => traveller.age), [null, null]);
});

test('hasCarRental=1 parses as true; absent or 0 is off', () => {
  assert.equal(parseSearchParams({ hasCarRental: '1' }).hasCarRental, true);
  assert.equal(parseSearchParams({ hasCarRental: '0' }).hasCarRental, undefined);
  assert.equal(parseSearchParams({ hasCarRental: 'true' }).hasCarRental, undefined);
  assert.equal(parseSearchParams({ country: 'Spanje' }).hasCarRental, undefined);
});

test('past-only departure window is retained as unbookable for Results filter rejection', () => {
  const params = parseSearchParams({
    departureStart: '2020-01-01',
    departureEnd: '2020-01-15',
    country: 'Spanje',
  });
  assert.equal(params.departureStart, '2020-01-01');
  assert.equal(params.departureEnd, '2020-01-15');
});

test('departure window that includes tomorrow+ is clamped when start is in the past', () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  const minIso = `${y}-${m}-${d}`;

  const end = new Date(tomorrow);
  end.setDate(end.getDate() + 10);
  const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

  const params = parseSearchParams({
    departureStart: '2020-01-01',
    departureEnd: endIso,
  });
  assert.equal(params.departureStart, minIso);
  assert.equal(params.departureEnd, endIso);
});

test('region query aliases canonicalize onto existing Dutch labels', () => {
  assert.equal(parseSearchParams({ region: 'Côte Égéenne' }).region, 'Egeïsche Kust');
  assert.equal(parseSearchParams({ region: 'Andalusie' }).region, 'Andalusië');
});
