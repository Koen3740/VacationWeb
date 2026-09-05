import assert from 'node:assert/strict';
import test from 'node:test';
import { isRoadtripOffer } from '../offers/fly-drive-rondreis';
import { countCarRentalFacet, countRoadtripFacet, filterOffers } from './filtering';
import {
  ROADTRIP_FILTER_LABEL,
  ROADTRIP_VACATION_TYPE,
  VACATION_TYPE_LABELS,
  offerMatchesVacationType,
} from './vacation-type';
import type { TravelOffer } from '../../types/travel';

function corendonDeepLink(): string {
  return 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.270826.8.DZI-U';
}

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider' | 'hotelName'>,
): TravelOffer {
  const provider = overrides.provider;
  return {
    destinationCountry: 'Spanje',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink:
      provider === 'Corendon' ? corendonDeepLink() : 'https://example.com/offer',
    ...overrides,
  };
}

const corendonRoadtrip = makeOffer({
  id: 'c-rt',
  provider: 'Corendon',
  hotelName: 'Fly & Drive Chalkidiki',
  hasCarRental: true,
  subcategories: 'Fly-Drive vakantie,Zonvakantie',
});
const corendonFlyGo = makeOffer({
  id: 'c-fg',
  provider: 'Corendon',
  hotelName: 'Fly & Go Alaaddin Beach Alanya',
  hasCarRental: true,
  subcategories: 'Fly-Drive vakantie,Zonvakantie',
});
const corendonTokenOnly = makeOffer({
  id: 'c-token',
  provider: 'Corendon',
  hotelName: 'Blue Hills Villas',
  hasCarRental: true,
  subcategories: 'Fly-Drive vakantie,Zonvakantie',
});
const sunwebRoadtrip = makeOffer({
  id: 's-rt',
  provider: 'Sunweb',
  hotelName: 'Fly & Drive Madeira - Mountain Escapes - inclusief huurauto',
  hasCarRental: true,
});
const sunwebCarOnly = makeOffer({
  id: 's-car',
  provider: 'Sunweb',
  hotelName: 'Olée Cala Agulla',
  hasCarRental: true,
});
const elizaCar = makeOffer({
  id: 'e-car',
  provider: 'Eliza was here',
  hotelName: 'Test Resort',
  hasCarRental: true,
});
const plain = makeOffer({
  id: 'plain',
  provider: 'Corendon',
  hotelName: 'Ordinary Hotel',
  subcategories: 'Zonvakantie',
});

const catalog = [
  corendonRoadtrip,
  corendonFlyGo,
  corendonTokenOnly,
  sunwebRoadtrip,
  sunwebCarOnly,
  elizaCar,
  plain,
];

test('UI label for Fly & Drive vacation type is Roadtrip (Fly & Drive)', () => {
  assert.equal(VACATION_TYPE_LABELS[ROADTRIP_VACATION_TYPE], ROADTRIP_FILTER_LABEL);
  assert.equal(ROADTRIP_FILTER_LABEL, 'Roadtrip (Fly & Drive)');
});

test('Roadtrip matcher: Corendon Fly & Drive yes; Fly & Go / token-only no', () => {
  assert.equal(isRoadtripOffer(corendonRoadtrip), true);
  assert.equal(offerMatchesVacationType(corendonRoadtrip, 'Fly & Drive'), true);
  assert.equal(offerMatchesVacationType(corendonFlyGo, 'Fly & Drive'), false);
  assert.equal(offerMatchesVacationType(corendonTokenOnly, 'Fly & Drive'), false);
});

test('Roadtrip matcher: Sunweb Fly & Drive yes; ordinary huurauto no', () => {
  assert.equal(offerMatchesVacationType(sunwebRoadtrip, 'Fly & Drive'), true);
  assert.equal(offerMatchesVacationType(sunwebCarOnly, 'Fly & Drive'), false);
});

test('Roadtrip matcher: Eliza huurauto never Roadtrip', () => {
  assert.equal(offerMatchesVacationType(elizaCar, 'Fly & Drive'), false);
  assert.equal(
    offerMatchesVacationType(
      { ...elizaCar, hotelName: 'Fly & Drive Hypothetical' },
      'Fly & Drive',
    ),
    false,
  );
});

test('Roadtrip and hasCarRental may both be true', () => {
  assert.equal(corendonRoadtrip.hasCarRental, true);
  assert.equal(isRoadtripOffer(corendonRoadtrip), true);
});

test('Roadtrip filter returns only Roadtrip offers', () => {
  const ids = filterOffers(catalog, { vacationTypes: ['Fly & Drive'] }).map((o) => o.id);
  assert.deepEqual(ids, ['c-rt', 's-rt']);
});

test('Huurauto filter returns all hasCarRental offers', () => {
  const ids = filterOffers(catalog, { hasCarRental: true }).map((o) => o.id);
  assert.deepEqual(ids, ['c-rt', 'c-fg', 'c-token', 's-rt', 's-car', 'e-car']);
});

test('Roadtrip + Huurauto is AND', () => {
  const ids = filterOffers(catalog, {
    vacationTypes: ['Fly & Drive'],
    hasCarRental: true,
  }).map((o) => o.id);
  assert.deepEqual(ids, ['c-rt', 's-rt']);
});

test('Roadtrip facet count equals Roadtrip matchset; car facet equals hasCarRental', () => {
  assert.equal(countRoadtripFacet(catalog, {}), 2);
  assert.equal(countCarRentalFacet(catalog, {}), 6);
  assert.equal(countRoadtripFacet(catalog, { hasCarRental: true }), 2);
  assert.equal(countCarRentalFacet(catalog, { vacationTypes: ['Fly & Drive'] }), 2);
});

test('facet counts ignore sort and are catalog-stable (no live price field required)', () => {
  const base = countRoadtripFacet(catalog, {});
  const withSort = countRoadtripFacet(catalog, { sort: 'price' });
  const withLiveNoise = countRoadtripFacet(
    catalog.map((o) => ({ ...o, livePriceStatus: 'catalog' as const })),
    {},
  );
  assert.equal(withSort, base);
  assert.equal(withLiveNoise, base);
  assert.equal(countCarRentalFacet(catalog, { sort: 'price' }), countCarRentalFacet(catalog, {}));
});

test('Fly & Go with Fly-Drive subcategory is huurauto but not Roadtrip', () => {
  assert.equal(corendonFlyGo.hasCarRental, true);
  assert.equal(isRoadtripOffer(corendonFlyGo), false);
  assert.equal(filterOffers([corendonFlyGo], { vacationTypes: ['Fly & Drive'] }).length, 0);
  assert.equal(filterOffers([corendonFlyGo], { hasCarRental: true }).length, 1);
});
