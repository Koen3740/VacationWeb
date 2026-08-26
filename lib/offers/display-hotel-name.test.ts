import assert from 'node:assert/strict';
import test from 'node:test';
import { displayHotelName } from './display-hotel-name';

test('decodes and repairs Villa&#039 / Villa#039 style names', () => {
  assert.equal(
    displayHotelName({ hotelName: "Appartementen Villa&#039;s Elpiniki" }),
    "Appartementen Villa's Elpiniki",
  );
  assert.equal(
    displayHotelName({ hotelName: "Appartementen Villa#039;s Elpiniki" }),
    "Appartementen Villa's Elpiniki",
  );
});

test('technical Villa8#039 falls back to provider accommodation name', () => {
  assert.equal(
    displayHotelName({
      hotelName: 'Villa8#039',
      accommodation: "Villa d'Este",
    }),
    "Villa d'Este",
  );
});

test('technical codes fall back to accommodation or descriptionShort', () => {
  assert.equal(
    displayHotelName({
      hotelName: 'Villa8',
      accommodation: 'Villa Miramar',
    }),
    'Villa Miramar',
  );
  assert.equal(
    displayHotelName({
      hotelName: '1898',
      descriptionShort: '8 daagse vliegvakantie naar Hotel 1898 Barcelona in barcelona, spanje',
    }),
    'Hotel 1898 Barcelona',
  );
  assert.equal(displayHotelName({ hotelName: '' }), 'Accommodatie');
});
