import assert from 'node:assert/strict';
import test from 'node:test';
import { carRentalIncludedLabel } from '../offers/has-car-rental';
import { applyFilterNavigationPaging } from './filter-navigation';
import { countCarRentalFacet, filterOffers, sortOffers } from './filtering';
import { buildResultsPageHref } from './pagination';
import type { TravelOffer } from '../../types/travel';

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    deepLink: 'https://example.com/offer',
    ...overrides,
  };
}

test('hasCarRental is an optional filter, not an exclusion', () => {
  const withCar = makeOffer({
    id: 'sunweb-car',
    provider: 'Sunweb',
    hasCarRental: true,
  });
  const withoutCar = makeOffer({
    id: 'sunweb-flight',
    provider: 'Sunweb',
  });
  const corendonFlyDrive = makeOffer({
    id: 'corendon-flydrive',
    provider: 'Corendon',
    hasCarRental: true,
    subcategories: 'Fly-Drive vakantie,Zonvakantie',
  });
  const corendonZon = makeOffer({
    id: 'corendon-zon',
    provider: 'Corendon',
    subcategories: 'Zonvakantie',
  });
  const namedCar = makeOffer({
    id: 'sunweb-named',
    provider: 'Sunweb',
    hotelName: 'Olée Cala Agulla inclusief huurauto',
  });
  const offers = [withCar, withoutCar, corendonFlyDrive, corendonZon, namedCar];

  const off = filterOffers(offers, {});
  assert.deepEqual(
    off.map((offer) => offer.id),
    ['sunweb-car', 'sunweb-flight', 'corendon-flydrive', 'corendon-zon', 'sunweb-named'],
  );
  assert.equal(carRentalIncludedLabel(withCar), 'Inclusief huurauto');
  assert.equal(carRentalIncludedLabel(withoutCar), undefined);
  assert.equal(carRentalIncludedLabel(corendonFlyDrive), 'Inclusief huurauto');
  assert.equal(carRentalIncludedLabel(corendonZon), undefined);
  assert.equal(carRentalIncludedLabel(namedCar), undefined);

  const on = filterOffers(offers, { hasCarRental: true });
  assert.deepEqual(
    on.map((offer) => offer.id),
    ['sunweb-car', 'corendon-flydrive'],
  );
});

test('faceted car-rental count ignores the hasCarRental param itself', () => {
  const offers = [
    makeOffer({ id: 'car-es', provider: 'Sunweb', hasCarRental: true, destinationCountry: 'Spanje' }),
    makeOffer({ id: 'car-gr', provider: 'Sunweb', hasCarRental: true, destinationCountry: 'Griekenland' }),
    makeOffer({ id: 'plain-es', provider: 'Sunweb', destinationCountry: 'Spanje' }),
  ];
  assert.equal(countCarRentalFacet(offers, {}), 2);
  assert.equal(countCarRentalFacet(offers, { hasCarRental: true }), 2);
  assert.equal(filterOffers(offers, {}).length, 3);
  assert.equal(filterOffers(offers, { hasCarRental: true }).length, 2);
  assert.equal(countCarRentalFacet(offers, { countries: ['Spanje'] }), 1);
  assert.equal(filterOffers(offers, { countries: ['Spanje'] }).length, 2);
});

test('hasCarRental is not a sort key', () => {
  const mixed = [
    makeOffer({ id: 'b', provider: 'Sunweb', price: 900, pricePerDay: 112, hasCarRental: true }),
    makeOffer({ id: 'a', provider: 'Sunweb', price: 800, pricePerDay: 100 }),
    makeOffer({ id: 'c', provider: 'Sunweb', price: 700, pricePerDay: 87, hasCarRental: true }),
  ];
  const withoutFlag = mixed.map(({ hasCarRental: _ignored, ...offer }) => offer);
  assert.deepEqual(
    sortOffers(mixed, 'price').map((offer) => offer.id),
    sortOffers(withoutFlag, 'price').map((offer) => offer.id),
  );
});

test('SelfDrive without hasCarRental stays visible when the filter is off and is excluded when on', () => {
  const selfDrive = makeOffer({
    id: 'sunweb-selfdrive',
    provider: 'Sunweb',
    flightIncluded: 'SelfDrive',
  });
  const flightCar = makeOffer({
    id: 'sunweb-car',
    provider: 'Sunweb',
    hasCarRental: true,
  });
  const offers = [selfDrive, flightCar];
  assert.deepEqual(
    filterOffers(offers, {}).map((offer) => offer.id),
    ['sunweb-selfdrive', 'sunweb-car'],
  );
  assert.deepEqual(
    filterOffers(offers, { hasCarRental: true }).map((offer) => offer.id),
    ['sunweb-car'],
  );
});

test('results href round-trips only hasCarRental=1', () => {
  const on = new URLSearchParams(buildResultsPageHref({ hasCarRental: true }, 1).split('?')[1] || '');
  assert.equal(on.get('hasCarRental'), '1');
  const off = new URLSearchParams(buildResultsPageHref({}, 1).split('?')[1] || '');
  assert.equal(off.get('hasCarRental'), null);
});

test('filter navigation keeps hasCarRental=1 with page1Ids', () => {
  const params = new URLSearchParams('adults=2&page1Ids=keep-me&hasCarRental=1');
  applyFilterNavigationPaging(params, { preservePage1Ids: true });
  assert.equal(params.get('page1Ids'), 'keep-me');
  assert.equal(params.get('hasCarRental'), '1');
});
