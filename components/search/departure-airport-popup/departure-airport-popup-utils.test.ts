import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getCountriesWithSelectedAirports,
  getPublicPickerCountryGroups,
  toggleCountryExpanded,
} from '../../../components/search/departure-airport-popup/departure-airport-popup-utils';

test('getCountriesWithSelectedAirports expands only countries with a selected airport', () => {
  const groups = getPublicPickerCountryGroups();
  const expanded = getCountriesWithSelectedAirports(['BRU', 'AMS'], groups);
  assert.deepEqual([...expanded], ['BE', 'NL']);
});

test('toggleCountryExpanded opens and closes without affecting other countries', () => {
  let expanded = getCountriesWithSelectedAirports(['BRU'], getPublicPickerCountryGroups());
  expanded = toggleCountryExpanded(expanded, 'NL');
  assert.ok(expanded.has('BE'));
  assert.ok(expanded.has('NL'));
  expanded = toggleCountryExpanded(expanded, 'BE');
  assert.ok(!expanded.has('BE'));
  assert.ok(expanded.has('NL'));
});

test('collapse state is independent from selection membership', () => {
  const groups = getPublicPickerCountryGroups();
  const expanded = toggleCountryExpanded(new Set(), 'BE');
  assert.equal(expanded.has('BE'), true);
  const withSelection = getCountriesWithSelectedAirports(['CRL'], groups);
  assert.ok(withSelection.has('BE'));
  const collapsed = toggleCountryExpanded(withSelection, 'BE');
  assert.equal(collapsed.has('BE'), false);
  assert.deepEqual(getCountriesWithSelectedAirports(['CRL'], groups), withSelection);
});
