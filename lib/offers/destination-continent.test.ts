import assert from 'node:assert/strict';
import test from 'node:test';
import {
  groupCountriesByContinent,
  resolveDestinationContinent,
} from './destination-continent';

test('resolves continents for known catalog countries and aliases', () => {
  assert.equal(resolveDestinationContinent('Spanje'), 'Europa');
  assert.equal(resolveDestinationContinent('Egypte'), 'Afrika');
  assert.equal(resolveDestinationContinent('Thailand'), 'Azië');
  assert.equal(resolveDestinationContinent('Curaçao'), 'Caribisch gebied');
  assert.equal(resolveDestinationContinent('Curacao'), 'Caribisch gebied');
  assert.equal(resolveDestinationContinent('Oman'), 'Midden-Oosten');
  assert.equal(resolveDestinationContinent('Onbekendland'), 'Overig');
});

test('groups countries under ordered continent headings and omits empty ones', () => {
  const groups = groupCountriesByContinent([
    'Thailand',
    'Spanje',
    'Egypte',
    'Curaçao',
    'Griekenland',
  ]);

  assert.deepEqual(
    groups.map((group) => group.continent),
    ['Europa', 'Afrika', 'Azië', 'Caribisch gebied'],
  );
  assert.deepEqual(groups[0]?.countries, ['Griekenland', 'Spanje']);
  assert.deepEqual(groups[1]?.countries, ['Egypte']);
  assert.deepEqual(groups[2]?.countries, ['Thailand']);
  assert.deepEqual(groups[3]?.countries, ['Curaçao']);
});
