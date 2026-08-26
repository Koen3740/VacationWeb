import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '@/types/travel';
import {
  extractBeachDistanceMeters,
  offerMatchesBeachLocation,
} from '@/lib/search/location-filters';
import { offerMatchesBudget } from '@/lib/search/filtering';

function offer(searchText: string, overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 't-1',
    provider: 'Corendon',
    hotelName: 'Test',
    destinationCountry: 'Spanje',
    nights: 7,
    price: 1000,
    pricePerDay: 140,
    imageUrl: 'https://images.corendonresources.com/x.jpg',
    deepLink: 'https://www.corendon.be/x',
    searchText,
    ...overrides,
  };
}

test('room size m² near strand is NOT treated as beach distance', () => {
  const text =
    'ligging * aan het strand * faciliteiten * hotelkamers * standaardkamer * ca. 18-20 m² * airconditioning';
  assert.equal(extractBeachDistanceMeters(offer(text)), undefined);
  assert.equal(offerMatchesBeachLocation(offer(text), 'lt500'), false);
});

test('shop distance next to beachfront is NOT beach distance', () => {
  const text =
    'ligging * gelegen aan het openbare strand * dichtstbijzijnde winkel op circa 100 meter * restaurant op circa 50 meter';
  assert.equal(extractBeachDistanceMeters(offer(text)), undefined);
  assert.equal(offerMatchesBeachLocation(offer(text), 'lt500'), false);
});

test('explicit beach distance phrases match lt500', () => {
  assert.equal(
    extractBeachDistanceMeters(offer('openbaar strand op circa 250 meter')),
    250,
  );
  assert.equal(
    extractBeachDistanceMeters(offer('openbaar strand tsilivi beach op circa 300 meter')),
    300,
  );
  assert.equal(
    extractBeachDistanceMeters(offer('het hotel ligt op circa 100 meter van het strand')),
    100,
  );
  assert.equal(offerMatchesBeachLocation(offer('openbaar strand op circa 250 meter'), 'lt500'), true);
});

test('missing beach distance is not lt500', () => {
  assert.equal(extractBeachDistanceMeters(offer('zwembad en restaurant')), undefined);
  assert.equal(offerMatchesBeachLocation(offer('zwembad en restaurant'), 'lt500'), false);
});

test('offerMatchesBudget uses current offer.price as upper bound', () => {
  const priced = offer('x', { price: 1737 });
  assert.equal(offerMatchesBudget(priced, { budgetMax: 1496 }), false);
  assert.equal(offerMatchesBudget(priced, { budgetMax: 2000 }), true);
  assert.equal(offerMatchesBudget(offer('x', { price: 2240 }), { budgetMax: 2000 }), false);
});
