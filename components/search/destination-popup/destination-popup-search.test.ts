import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  filterCountriesByQuery,
  getCountryFlagCode,
  loadDestinationCountries,
  normalizeDestinationSearchText,
  type DestinationCountryOption,
} from '@/components/search/destination-popup/destination-popup-utils';

const ROOT = process.cwd();

const LIST: DestinationCountryOption[] = [
  'Bulgarije',
  'Curaçao',
  'Griekenland',
  'Italië',
  'Kaapverdische Eilanden',
  'Kroatië',
  'Marokko',
  'Spanje',
  'Turkije',
].map((name) => ({ name, count: 10 }));

const names = (query: string) => filterCountriesByQuery(LIST, query).map((country) => country.name);

test('destination search: accent-insensitive normalisation', () => {
  assert.equal(normalizeDestinationSearchText('  Curaçao '), 'curacao');
  assert.equal(normalizeDestinationSearchText('ITALIË'), 'italie');
});

test('destination search narrows live by prefix (name or word), not by substring', () => {
  assert.deepEqual(names('K'), ['Kaapverdische Eilanden', 'Kroatië']);
  assert.deepEqual(names('KR'), ['Kroatië']);
  assert.deepEqual(names('kroa'), ['Kroatië']);
  assert.deepEqual(names('eil'), ['Kaapverdische Eilanden']);
  assert.deepEqual(names('cura'), ['Curaçao']);
  assert.deepEqual(names('italie'), ['Italië']);
  assert.deepEqual(names('sp'), ['Spanje']);
  // No substring hits: "k" must not match Marokko / Turkije.
  assert.equal(names('k').includes('Marokko'), false);
  assert.deepEqual(names(''), LIST.map((country) => country.name));
});

test('unavailable destinations give no results (popup shows the not-available message)', () => {
  assert.deepEqual(names('Kreta'), []);
  assert.deepEqual(names('KRE'), []);
  assert.deepEqual(names('xyz'), []);
});

test('only destinations with offers are listed when counts are known', () => {
  const countries = loadDestinationCountries({ Spanje: 5, Griekenland: 0 });
  assert.deepEqual(countries.map((country) => country.name), ['Spanje']);
  // Without counts (preview) the catalog country list is kept as-is.
  assert.ok(loadDestinationCountries({}).length > 0);
});

test('destination popup copy: bestemmingen wording, short unavailable message, flags, no instructions', () => {
  const popup = readFileSync(join(ROOT, 'components/search/destination-popup/destination-popup.tsx'), 'utf8');
  assert.ok(popup.includes('Kies één of meerdere bestemmingen.'));
  assert.ok(popup.includes('Deze bestemming is momenteel niet beschikbaar.'));
  assert.ok(popup.includes('DestinationPopupFlag'));
  assert.equal(/\blanden\b/.test(popup), false, 'no "landen" wording');
  assert.equal(popup.includes('tik om toe te voegen'), false);
  assert.equal(popup.includes('Je kiest hier op land'), false);
  const chip = readFileSync(join(ROOT, 'components/search/destination-popup/destination-country-chip.tsx'), 'utf8');
  assert.ok(chip.includes('DestinationPopupFlag'));
});

test('countries without a flag asset get the popup globe fallback (not an empty square)', () => {
  for (const country of ['Argentinië', 'Canada', 'Macedonië']) {
    assert.equal(getCountryFlagCode(country), undefined, country);
  }
  assert.ok(getCountryFlagCode('Griekenland'));
  const wrapper = readFileSync(join(ROOT, 'components/search/destination-popup/destination-popup-flag.tsx'), 'utf8');
  assert.ok(wrapper.includes('data-flag-fallback'));
  assert.ok(wrapper.includes('<svg'));
  assert.ok(wrapper.includes('h-3 w-4'), 'same 16×12 box as the flags');
  // /bestemmingen keeps using the shared icon unchanged.
  const shared = readFileSync(join(ROOT, 'components/search/destination-popup/destination-country-flag-icon.tsx'), 'utf8');
  assert.equal(shared.includes('data-flag-fallback'), false);
});

test('destination search placeholder is "Zoek een bestemming" + ellipsis character (not three dots)', () => {
  const popup = readFileSync(join(ROOT, 'components/search/destination-popup/destination-popup.tsx'), 'utf8');
  assert.ok(popup.includes('placeholder="Zoek een bestemming\u2026"'));
  assert.equal(popup.includes('placeholder="Zoek een bestemming..."'), false);
});
