import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveFilterOptions } from '@/lib/offers/derive-filter-options';
import type { TravelOffer } from '@/types/travel';

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'test-1',
    provider: 'Corendon',
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    destinationCity: 'Palma',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://example.com',
    accommodationType: 'Hotel',
    boardType: 'All Inclusive',
    departureAirport: 'AMS',
    ...overrides,
  };
}

test('deriveFilterOptions stores cities, accommodation types, counts and themes at import time', () => {
  const options = deriveFilterOptions([
    makeOffer(),
    makeOffer({
      id: 'test-2',
      destinationCountry: 'Griekenland',
      destinationRegion: 'Kreta',
      destinationCity: 'Chania',
      accommodationType: 'Appartement',
    }),
    makeOffer({ id: 'test-3', destinationCity: 'Alcudia' }),
  ]);

  assert.ok(options.countries.includes('Spanje'));
  assert.ok(options.countries.includes('Griekenland'));
  assert.deepEqual(options.citiesByCountry?.Spanje, ['Alcudia', 'Palma']);
  assert.equal(options.accommodationTypes?.[0], 'Hotel');
  assert.equal(options.countryCounts?.Spanje, 2);
  assert.equal(options.totalOffers, 3);
  assert.ok((options.popularDestinations?.length ?? 0) > 0);
  assert.ok((options.homeThemes?.length ?? 0) > 0);
  assert.ok(options.departureAirports.includes('AMS'));
});

test('filter airports keep IATA identity and ignore country ISO / provider names', () => {
  const options = deriveFilterOptions([
    makeOffer({
      id: 'bru',
      departureAirport: 'BRU',
      departureAirportCode: 'BE',
      airport: 'Brussel Zaventem',
    }),
    makeOffer({
      id: 'country-only',
      departureAirport: undefined,
      departureAirportCode: 'BE',
      airport: 'Brussel Zaventem',
    }),
  ]);
  assert.deepEqual(options.departureAirports, ['BRU']);
  assert.ok(!options.departureAirports.includes('BE'));
  assert.ok(!options.departureAirports.includes('Brussel Zaventem'));
});
