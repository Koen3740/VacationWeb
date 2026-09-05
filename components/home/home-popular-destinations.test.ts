import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPopularDestinationHref } from './home-popular-destination-href';

function hrefQuery(href: string): URLSearchParams {
  return new URL(href, 'https://vacationweb.test').searchParams;
}

test('Canarische Eilanden maps to Spanje country + Canarische Eilanden region', () => {
  const params = hrefQuery(buildPopularDestinationHref('Canarische Eilanden'));
  assert.equal(params.get('country'), 'Spanje');
  assert.equal(params.get('region'), 'Canarische Eilanden');
  assert.notEqual(params.get('country'), 'Canarische Eilanden');
});

test('other popular destinations stay country-only', () => {
  for (const name of ['Spanje', 'Griekenland', 'Turkije', 'Portugal'] as const) {
    const params = hrefQuery(buildPopularDestinationHref(name));
    assert.equal(params.get('country'), name);
    assert.equal(params.get('region'), null);
  }
});
