import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AIRPORT_COUNTRY_ORDER,
  CANONICAL_AIRPORTS,
  assertCanonicalAirportRegistryInvariants,
  getPublicPickerCountryGroups,
  listPublicPickerIataCodes,
} from './canonical-airports';

const REQUIRED_BY_COUNTRY: Record<string, readonly string[]> = {
  BE: ['BRU', 'CRL', 'ANR', 'OST', 'LGG'],
  NL: ['AMS', 'EIN', 'RTM', 'GRQ', 'MST'],
  DE: ['DUS', 'CGN', 'NRN'],
  FR: ['LIL'],
  LU: ['LUX'],
};

test('canonical registry invariants: valid IATA, country, no duplicates', () => {
  assert.doesNotThrow(() => assertCanonicalAirportRegistryInvariants());
  for (const airport of CANONICAL_AIRPORTS) {
    assert.match(airport.iata, /^[A-Z]{3}$/);
    assert.ok(AIRPORT_COUNTRY_ORDER.includes(airport.countryCode));
    assert.ok(airport.displayNameNl.trim().length > 0);
    assert.equal(airport.enabled, true);
  }
  const iatas = CANONICAL_AIRPORTS.map((airport) => airport.iata);
  assert.equal(new Set(iatas).size, iatas.length);
});

test('required airports exist for BE NL DE FR LU', () => {
  const byIata = new Map(CANONICAL_AIRPORTS.map((airport) => [airport.iata, airport]));
  for (const [country, codes] of Object.entries(REQUIRED_BY_COUNTRY)) {
    for (const code of codes) {
      const airport = byIata.get(code);
      assert.ok(airport, `missing ${code}`);
      assert.equal(airport.countryCode, country);
      assert.equal(airport.enabled, true);
    }
  }
});

test('public picker country grouping order and membership', () => {
  const groups = getPublicPickerCountryGroups();
  assert.deepEqual(
    groups.map((group) => group.countryCode),
    ['BE', 'NL', 'DE', 'FR', 'LU'],
  );
  assert.deepEqual(
    groups.map((group) => group.displayNameNl),
    ['België', 'Nederland', 'Duitsland', 'Frankrijk', 'Luxemburg'],
  );
  assert.deepEqual(
    groups.find((group) => group.countryCode === 'BE')?.airports.map((a) => a.iata),
    ['BRU', 'CRL', 'ANR', 'OST', 'LGG'],
  );
  assert.deepEqual(
    groups.find((group) => group.countryCode === 'DE')?.airports.map((a) => a.iata),
    ['DUS', 'CGN', 'NRN'],
  );
  assert.deepEqual(listPublicPickerIataCodes(), [
    'BRU',
    'CRL',
    'ANR',
    'OST',
    'LGG',
    'AMS',
    'EIN',
    'RTM',
    'GRQ',
    'MST',
    'DUS',
    'CGN',
    'NRN',
    'LIL',
    'LUX',
  ]);
});

test('registry is not limited to historic filter-options snapshot gaps', () => {
  const codes = new Set(listPublicPickerIataCodes());
  assert.ok(codes.has('LGG'));
  assert.ok(codes.has('ANR'));
  assert.ok(codes.has('OST'));
});
