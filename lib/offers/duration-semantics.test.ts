import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import {
  catalogDurationUsesDays,
  catalogReturnDateOffsetDays,
  formatCatalogDurationDaysLabel,
} from './duration-semantics';

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'sunweb-1',
    provider: 'Sunweb',
    hotelName: 'Hotel Test',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 499,
    pricePerDay: 62,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.sunweb.nl/hotel',
    ...overrides,
  };
}

test('catalog duration uses days for Corendon, Sunweb and Eliza', () => {
  assert.equal(catalogDurationUsesDays(makeOffer({ provider: 'Sunweb' })), true);
  assert.equal(catalogDurationUsesDays(makeOffer({ provider: 'Eliza' })), true);
  assert.equal(catalogDurationUsesDays(makeOffer({ provider: 'Corendon' })), true);
  assert.equal(catalogDurationUsesDays(makeOffer({ provider: 'Other' })), false);
  assert.equal(catalogDurationUsesDays(makeOffer({ provider: 'Other', durationType: 'dagen' })), true);
});

test('catalog return date offset is provider-aware', () => {
  assert.equal(catalogReturnDateOffsetDays(makeOffer({ provider: 'Sunweb', nights: 8 })), 8);
  assert.equal(catalogReturnDateOffsetDays(makeOffer({ provider: 'Eliza', nights: 8 })), 8);
  assert.equal(catalogReturnDateOffsetDays(makeOffer({ provider: 'Corendon', nights: 8 })), 7);
});

test('formatCatalogDurationDaysLabel uses Dutch pluralization', () => {
  assert.equal(formatCatalogDurationDaysLabel(1), '1 dag');
  assert.equal(formatCatalogDurationDaysLabel(8), '8 dagen');
});
