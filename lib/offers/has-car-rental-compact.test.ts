import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOffer } from '../feeds/canonical/normalize-offer';
import type { StoredOffer } from '../feeds/types/stored-offer';
import { compactStoredOffer } from './compact-runtime';

function makeStored(overrides: Partial<StoredOffer> = {}): StoredOffer {
  return {
    externalId: 'sunweb-car-1',
    provider: 'Sunweb',
    hotelName: 'Test Hotel',
    country: 'Spanje',
    nights: 8,
    price: 800,
    deepLink: 'https://example.com/sunweb-car-1',
    imageUrl: 'https://example.com/a.jpg',
    ...overrides,
  };
}

test('compact runtime keeps hasCarRental=true and omits false/missing', () => {
  const kept = compactStoredOffer(makeStored({ hasCarRental: true }));
  assert.equal(kept.runtime.hasCarRental, true);
  assert.equal(normalizeOffer(kept.runtime).hasCarRental, true);

  const omittedFalse = compactStoredOffer(makeStored({ hasCarRental: false }));
  assert.equal(omittedFalse.runtime.hasCarRental, undefined);
  assert.equal(normalizeOffer(omittedFalse.runtime).hasCarRental, undefined);

  const omittedMissing = compactStoredOffer(makeStored());
  assert.equal(omittedMissing.runtime.hasCarRental, undefined);
  assert.equal(normalizeOffer(omittedMissing.runtime).hasCarRental, undefined);
});
