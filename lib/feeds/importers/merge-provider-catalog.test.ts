import assert from 'node:assert/strict';
import test from 'node:test';
import type { StoredOffer } from '../types/stored-offer';
import { mergeEnabledProviderCatalog } from './merge-provider-catalog';

function pv(id: string): StoredOffer {
  return {
    externalId: id,
    provider: 'Prijsvrij',
    hotelName: 'PV Hotel',
    country: 'Portugal',
    nights: 8,
    price: 900,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.prijsvrij.be/vakantie',
    departureDate: '2026-08-20',
    flightIncluded: 'true',
  };
}

test('mergeEnabledProviderCatalog does not merge or drop Prijsvrij records', () => {
  const offers: StoredOffer[] = [pv('prijsvrij-1'), pv('prijsvrij-2')];
  const merged = mergeEnabledProviderCatalog(offers);
  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((offer) => offer.externalId),
    ['prijsvrij-1', 'prijsvrij-2'],
  );
});
