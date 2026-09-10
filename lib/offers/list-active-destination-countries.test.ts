import assert from 'node:assert/strict';
import test from 'node:test';
import { listActiveDestinationCountries } from './list-active-destination-countries';
import type { FilterOptions } from '@/types/travel';

function options(partial: Partial<FilterOptions>): FilterOptions {
  return {
    countries: [],
    regionsByCountry: {},
    boardTypes: [],
    departureAirports: [],
    ...partial,
  };
}

test('lists only countries with a positive active offer count', () => {
  const countries = listActiveDestinationCountries(
    options({
      countries: ['Spanje', 'Griekenland', 'Tunesië', 'Gambia'],
      countryCounts: {
        Spanje: 120,
        Griekenland: 40,
        Tunesië: 0,
        // Gambia missing from counts → excluded
      },
    }),
  );

  assert.deepEqual(countries, ['Griekenland', 'Spanje']);
  assert.equal(countries.includes('Tunesië'), false);
  assert.equal(countries.includes('Gambia'), false);
});

test('sorts countries with Dutch locale order', () => {
  const countries = listActiveDestinationCountries(
    options({
      countries: ['Turkije', 'Egypte', 'Albanië'],
      countryCounts: { Turkije: 1, Egypte: 2, Albanië: 3 },
    }),
  );

  assert.deepEqual(countries, ['Albanië', 'Egypte', 'Turkije']);
});
