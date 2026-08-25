import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeCountryName } from './canonical-country';
import { canonicalizeFilterOptions } from './load-filter-options';

test('French country labels map onto existing Dutch VacationWeb names', () => {
  assert.equal(canonicalizeCountryName('Espagne'), 'Spanje');
  assert.equal(canonicalizeCountryName('Turquie'), 'Turkije');
  assert.equal(canonicalizeCountryName('Grèce'), 'Griekenland');
  assert.equal(canonicalizeCountryName('Grece'), 'Griekenland');
  assert.equal(canonicalizeCountryName('Maroc'), 'Marokko');
  assert.equal(canonicalizeCountryName('Spanje'), 'Spanje');
  assert.equal(canonicalizeCountryName('Turkije'), 'Turkije');
});

test('filter-options canonicalization merges French duplicates into Dutch labels', () => {
  const options = canonicalizeFilterOptions({
    countries: ['Spanje', 'Espagne', 'Turquie', 'Turkije', 'Grèce', 'Griekenland', 'Maroc', 'Marokko'],
    regionsByCountry: {
      Espagne: ['Andalucia'],
      Spanje: ['Mallorca'],
    },
    citiesByCountry: {
      Turquie: ['Alanya'],
      Turkije: ['Side'],
    },
    boardTypes: [],
    departureAirports: [],
    countryCounts: {
      Espagne: 3,
      Spanje: 10,
      Grèce: 1,
      Griekenland: 8,
    },
    totalOffers: 22,
  });

  assert.deepEqual(
    options.countries.filter((name) => name === 'Espagne' || name === 'Turquie' || name === 'Grèce' || name === 'Maroc'),
    [],
  );
  assert.ok(options.countries.includes('Spanje'));
  assert.ok(options.countries.includes('Turkije'));
  assert.ok(options.countries.includes('Griekenland'));
  assert.ok(options.countries.includes('Marokko'));
  assert.equal(options.countries.filter((name) => name === 'Spanje').length, 1);
  assert.deepEqual(options.regionsByCountry.Spanje, ['Andalucia', 'Mallorca']);
  assert.deepEqual(options.citiesByCountry?.Turkije, ['Alanya', 'Side']);
  assert.equal(options.countryCounts?.Spanje, 13);
  assert.equal(options.countryCounts?.Griekenland, 9);
  assert.equal(options.countryCounts?.Espagne, undefined);
});
