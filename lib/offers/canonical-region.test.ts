import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalizeRegionName } from './canonical-region';
import { canonicalizeFilterOptions } from './load-filter-options';
import { deriveFilterOptions } from './derive-filter-options';
import type { TravelOffer } from '@/types/travel';

test('French and accent-duplicate region labels map onto existing Dutch catalog names', () => {
  assert.equal(canonicalizeRegionName('Côte Égéenne'), 'Egeïsche Kust');
  assert.equal(canonicalizeRegionName('Maroc central'), 'Centraal Marokko');
  assert.equal(canonicalizeRegionName('Andalusie'), 'Andalusië');
  assert.equal(canonicalizeRegionName('Andalusië'), 'Andalusië');
  assert.equal(canonicalizeRegionName('Egeische Kust'), 'Egeïsche Kust');
  assert.equal(canonicalizeRegionName('Turkse Rivièra'), 'Turkse Riviera');
  assert.equal(canonicalizeRegionName('Mallorca'), 'Mallorca');
});

test('ISO Saint Martin is not merged with Sint Maarten', () => {
  assert.equal(canonicalizeRegionName('Saint Martin - French Part'), 'Saint Martin - French Part');
  assert.equal(canonicalizeRegionName('Sint Maarten'), 'Sint Maarten');
});

test('filter-options merge Andalusie with Andalusië and Côte Égéenne with Egeïsche Kust', () => {
  const options = canonicalizeFilterOptions({
    countries: ['Spanje', 'Turkije'],
    regionsByCountry: {
      Spanje: ['Andalusie', 'Andalusië', 'Mallorca'],
      Turquie: ['Côte Égéenne'],
      Turkije: ['Egeïsche Kust', 'Turkse Riviera'],
    },
    boardTypes: [],
    departureAirports: [],
  });

  assert.deepEqual(options.regionsByCountry.Spanje, ['Andalusië', 'Mallorca']);
  assert.deepEqual(options.regionsByCountry.Turkije, ['Egeïsche Kust', 'Turkse Riviera']);
  assert.equal(options.regionsByCountry.Spanje.filter((name) => name === 'Andalusië').length, 1);
});

test('deriveFilterOptions stores one canonical region per entity', () => {
  const makeOffer = (id: string, region: string, country = 'Spanje'): TravelOffer => ({
    id,
    provider: 'Corendon',
    hotelName: 'Test Hotel',
    destinationCountry: country,
    destinationRegion: region,
    destinationCity: 'Sevilla',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.corendon.be/x',
  });

  const options = deriveFilterOptions([
    makeOffer('a', 'Andalusie'),
    makeOffer('b', 'Andalusië'),
    makeOffer('c', 'Côte Égéenne', 'Turquie'),
    makeOffer('d', 'Egeïsche Kust', 'Turkije'),
  ]);

  assert.deepEqual(options.regionsByCountry.Spanje, ['Andalusië']);
  assert.deepEqual(options.regionsByCountry.Turkije, ['Egeïsche Kust']);
});
