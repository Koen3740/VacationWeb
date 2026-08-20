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

test('party dob and room assignment parse without storing age categories', () => {
  const params = parseSearchParams({
    adults: '4',
    dob: '1980-03-12,1982-08-07,2011-06-14,2022-01-22',
    rooms: '2',
    partyRooms: '1,1,1,2',
  });

  assert.equal(params.adults, 4);
  assert.equal(params.rooms, 2);
  assert.deepEqual(params.party, [
    { dateOfBirth: '1980-03-12', roomIndex: 0 },
    { dateOfBirth: '1982-08-07', roomIndex: 0 },
    { dateOfBirth: '2011-06-14', roomIndex: 0 },
    { dateOfBirth: '2022-01-22', roomIndex: 1 },
  ]);
  assert.ok(params.party?.every((traveller) => !('category' in traveller)));
});

test('Detail room query is parsed without becoming occupancy', () => {
  const params = parseSearchParams({
    adults: '2',
    dob: '1975-03-12,1978-06-04',
    rooms: '1',
    room: 'DD',
  });
  assert.equal(params.selectedRoom, 'DD');
  assert.equal(params.adults, 2);
  assert.deepEqual(params.party?.map((traveller) => traveller.dateOfBirth), ['1975-03-12', '1978-06-04']);
});

test('hasCarRental=1 parses as true; absent or 0 is off', () => {
  assert.equal(parseSearchParams({ hasCarRental: '1' }).hasCarRental, true);
  assert.equal(parseSearchParams({ hasCarRental: '0' }).hasCarRental, undefined);
  assert.equal(parseSearchParams({ hasCarRental: 'true' }).hasCarRental, undefined);
  assert.equal(parseSearchParams({ country: 'Spanje' }).hasCarRental, undefined);
});
