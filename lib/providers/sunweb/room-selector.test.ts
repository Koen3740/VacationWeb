import assert from 'node:assert/strict';
import test from 'node:test';
import { withSunwebRoomType } from './offer-context';
import { readSunwebRoomQuotes, sunwebDetailParticipants } from './room-selector';
import { SYNTHETIC_ADULT_DOB } from '../synthetic-dob';

const BODY = {
  data: {
    rooms: [
      { id: '2KA123', name: '2-kamerappartement type I', subtitle: 'geschikt voor 2 tot 3 personen max. 2 volwassenen en 1 kind t/m 12 jaar' },
      { id: '3KA125', name: '3-kamerappartement type I', subtitle: 'geschikt voor 2 tot 5 personen' },
      { id: '3KVA25', name: '3-kamer villa type A', subtitle: 'geschikt voor 2 tot 5 personen' },
    ],
    packages: [
      { roomId: '2KA123', totalPrice: 1254.88, price: 627.44, roomNumber: 1 },
      { roomId: '3KA125', totalPrice: 1336.98, price: 668.49, roomNumber: 1 },
      { roomId: '3KVA25', totalPrice: 1434.16, price: 717.08, roomNumber: 1 },
    ],
  },
};

test('room selector keeps the provider party total and drops a per-person figure', () => {
  const rooms = readSunwebRoomQuotes(BODY);
  assert.ok(rooms);
  assert.equal(rooms[0]?.totalPrice, 1254.88);
  assert.equal(rooms[1]?.totalPrice, 1336.98);
  assert.equal(rooms[0]?.capacityText?.includes('max. 2 volwassenen'), true);
  assert.equal(JSON.stringify(rooms).includes('627.44'), false);
});

test('a room with two different totals is listed without a price', () => {
  const rooms = readSunwebRoomQuotes({
    data: {
      rooms: [{ id: '2KA123', name: '2-kamerappartement type I', subtitle: 'geschikt voor 2 personen' }],
      packages: [
        { roomId: '2KA123', totalPrice: 1370.92, roomNumber: 1 },
        { roomId: '2KA123', totalPrice: 1430.92, roomNumber: 1 },
      ],
    },
  });
  assert.equal(rooms?.[0]?.name, '2-kamerappartement type I');
  assert.equal(rooms?.[0]?.totalPrice, undefined);
});

test('detail participants use the adult reference DOB and a child age, never a stored DOB', () => {
  const participants = sunwebDetailParticipants(
    {
      adults: 2,
      children: 1,
      babies: 0,
      rooms: 1,
      party: [
        { age: null, roomIndex: 0 },
        { age: null, roomIndex: 0 },
        { age: 8, roomIndex: 0 },
      ],
    },
    { returnDate: '2026-11-08' },
  );
  assert.deepEqual(participants, [
    { key: 'Participants[0][0]', value: SYNTHETIC_ADULT_DOB },
    { key: 'Participants[0][1]', value: SYNTHETIC_ADULT_DOB },
    { key: 'Participants[0][2]', value: '2018-11-08' },
  ]);
  assert.equal(sunwebDetailParticipants(
    { rooms: 3, party: [{ age: null, roomIndex: 2 }] },
    { returnDate: '2026-11-08' },
  ), null);
});

test('clickout keeps the landing and adds the room id', () => {
  const href = withSunwebRoomType(
    'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
      encodeURIComponent('https://www.sunweb.be/nl/hotel?DepartureDate[0]=2026-11-01&Mealplan=LG'),
    '3KA125',
  );
  assert.ok(href);
  const landing = new URL(decodeURIComponent(new URL(href).searchParams.get('r') ?? ''));
  assert.equal(landing.searchParams.get('RoomType[0]'), '3KA125');
  assert.equal(landing.searchParams.get('Mealplan'), 'LG');
  assert.equal(withSunwebRoomType('https://www.sunweb.be/hotel', 'not a room'), null);
});
