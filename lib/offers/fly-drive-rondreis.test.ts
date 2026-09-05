import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isProvenFlyAndDriveRondreis,
  offerHasCarRentalIsNotRondreisProof,
} from './fly-drive-rondreis';
import type { TravelOffer } from '@/types/travel';

/**
 * Fixture names from existing project data / tests — not invented:
 * - "Fly & Drive Chalkidiki" / "Fly & Drive Madeira": data/filter-options.json hotelNames
 * - "Fly & Go Alaaddin Beach Alanya": existing Corendon test fixtures / sample offers
 */

function offer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider' | 'hotelName'>,
): TravelOffer {
  return {
    destinationCountry: 'Spanje',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink: 'https://example.com/offer',
    ...overrides,
  };
}

test('Corendon Fly & Drive hotel name ⇒ proven rondreis', () => {
  assert.equal(
    isProvenFlyAndDriveRondreis(
      offer({
        id: 'c-fd',
        provider: 'Corendon',
        hotelName: 'Fly & Drive Chalkidiki',
        hasCarRental: true,
        subcategories: 'Fly-Drive vakantie,Zonvakantie',
      }),
    ),
    true,
  );
  assert.equal(
    isProvenFlyAndDriveRondreis(
      offer({
        id: 'c-fd-2',
        provider: 'Corendon',
        hotelName: 'Fly & Drive Madeira',
        hasCarRental: true,
      }),
    ),
    true,
  );
});

test('Corendon Fly & Go + huurauto ⇒ NOT rondreis', () => {
  const flyGo = offer({
    id: 'c-fg',
    provider: 'Corendon',
    hotelName: 'Fly & Go Alaaddin Beach Alanya',
    hasCarRental: true,
    subcategories: 'Fly-Drive vakantie,Zonvakantie',
  });
  assert.equal(isProvenFlyAndDriveRondreis(flyGo), false);
  assert.equal(offerHasCarRentalIsNotRondreisProof(flyGo), true);
});

test('Corendon subcategory Fly-Drive vakantie alone is NOT rondreis proof', () => {
  assert.equal(
    isProvenFlyAndDriveRondreis(
      offer({
        id: 'c-token-only',
        provider: 'Corendon',
        hotelName: 'Alaaddin Beach Hotel',
        hasCarRental: true,
        subcategories: 'Fly-Drive vakantie,Zonvakantie',
      }),
    ),
    false,
  );
});

test('Sunweb Fly & Drive hotel name ⇒ proven rondreis', () => {
  assert.equal(
    isProvenFlyAndDriveRondreis(
      offer({
        id: 's-fd',
        provider: 'Sunweb',
        hotelName: 'Fly & Drive Madeira',
        hasCarRental: true,
      }),
    ),
    true,
  );
});

test('Sunweb ordinary huurauto ⇒ NOT rondreis', () => {
  const ordinary = offer({
    id: 's-car',
    provider: 'Sunweb',
    hotelName: 'Olée Cala Agulla',
    hasCarRental: true,
  });
  assert.equal(isProvenFlyAndDriveRondreis(ordinary), false);
  assert.equal(offerHasCarRentalIsNotRondreisProof(ordinary), true);
});

test('Eliza huurauto ⇒ NOT rondreis (no feed rondreis products)', () => {
  const eliza = offer({
    id: 'e-car',
    provider: 'Eliza was here',
    hotelName: 'Test Resort',
    hasCarRental: true,
  });
  assert.equal(isProvenFlyAndDriveRondreis(eliza), false);
  assert.equal(
    isProvenFlyAndDriveRondreis({
      ...eliza,
      hotelName: 'Fly & Drive Hypothetical',
    }),
    false,
  );
});

test('hasCarRental alone never proves rondreis for unknown providers', () => {
  assert.equal(
    isProvenFlyAndDriveRondreis({
      provider: 'Vakanties.nl',
      hotelName: 'Fly & Drive Somewhere',
      hasCarRental: true,
    }),
    false,
  );
});
