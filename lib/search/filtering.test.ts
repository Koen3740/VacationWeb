import assert from 'node:assert/strict';
import test from 'node:test';
import { filterOffers, sortOffers, countCarRentalFacet } from './filtering';
import { carRentalIncludedLabel } from '@/lib/offers/has-car-rental';
import type { TravelOffer } from '@/types/travel';

function flightDeepLink(provider: string): string {
  if (provider === 'Sunweb') {
    return (
      'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
      encodeURIComponent(
        'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-20',
      )
    );
  }
  if (provider === 'Eliza was here') {
    return (
      'https://www.elizawashere.be/reizen?tt=1&r=' +
      encodeURIComponent(
        'https://www.elizawashere.be/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-27',
      )
    );
  }
  if (provider === 'Prijsvrij') {
    return (
      'https://www.prijsvrij.be/vakantie/?r=' +
      encodeURIComponent('https://www.prijsvrij.be/vakanties/spanje?transport=vl')
    );
  }
  return 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.200826.8.DZI-U';
}

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  const provider = overrides.provider;
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    departureAirport: provider === 'Prijsvrij' ? undefined : 'BRU',
    deepLink: flightDeepLink(provider),
    ...overrides,
  };
}

test('Corendon DD/MM/YYYY matches ISO search dates', () => {
  const offers = [
    makeOffer({
      id: 'corendon-1',
      provider: 'Corendon',
      departureDate: '28/09/2026',
    }),
  ];

  const matched = filterOffers(offers, {
    departureStart: '2026-09-28',
    departureEnd: '2026-09-28',
  });
  assert.equal(matched.length, 1);
  assert.equal(matched[0]?.id, 'corendon-1');
});

test('Corendon DD/MM/YYYY is excluded when the ISO date does not match', () => {
  const offers = [
    makeOffer({
      id: 'corendon-1',
      provider: 'Corendon',
      departureDate: '28/09/2026',
    }),
  ];

  const matched = filterOffers(offers, {
    departureStart: '2026-08-20',
    departureEnd: '2026-08-27',
  });
  assert.equal(matched.length, 0);
});

test('ISO departure dates keep matching for other providers', () => {
  const offers = [
    makeOffer({
      id: 'sunweb-1',
      provider: 'Sunweb',
      departureDate: '2026-08-20',
    }),
    makeOffer({
      id: 'eliza-1',
      provider: 'Eliza was here',
      departureDate: '2026-08-27',
    }),
    makeOffer({
      id: 'prijsvrij-1',
      provider: 'Prijsvrij',
      departureDate: '2026-09-28',
    }),
  ];

  const august = filterOffers(offers, {
    departureStart: '2026-08-20',
    departureEnd: '2026-08-27',
  });
  assert.deepEqual(
    august.map((offer) => offer.id),
    ['sunweb-1', 'eliza-1'],
  );

  const september = filterOffers(offers, {
    departureStart: '2026-09-28',
    departureEnd: '2026-09-28',
  });
  assert.deepEqual(
    september.map((offer) => offer.id),
    ['prijsvrij-1'],
  );
});

test('departureStart / departureEnd range includes Corendon and ISO offers on the same day', () => {
  const offers = [
    makeOffer({
      id: 'corendon-aug',
      provider: 'Corendon',
      departureDate: '20/08/2026',
    }),
    makeOffer({
      id: 'sunweb-aug',
      provider: 'Sunweb',
      departureDate: '2026-08-20',
    }),
    makeOffer({
      id: 'corendon-sep',
      provider: 'Corendon',
      departureDate: '28/09/2026',
    }),
  ];

  const matched = filterOffers(offers, {
    departureStart: '2026-08-20',
    departureEnd: '2026-08-27',
  });
  assert.deepEqual(
    matched.map((offer) => offer.id),
    ['corendon-aug', 'sunweb-aug'],
  );
});

test('flexibilityDays still widens an ISO search window around Corendon DMY dates', () => {
  const offers = [
    makeOffer({
      id: 'corendon-1',
      provider: 'Corendon',
      departureDate: '28/09/2026',
    }),
  ];

  const withoutFlex = filterOffers(offers, {
    departureStart: '2026-09-27',
    departureEnd: '2026-09-27',
  });
  assert.equal(withoutFlex.length, 0);

  const withFlex = filterOffers(offers, {
    departureStart: '2026-09-27',
    departureEnd: '2026-09-27',
    flexibilityDays: 1,
  });
  assert.equal(withFlex.length, 1);
});

test('sort=departure compares Corendon DMY and ISO on the same calendar', () => {
  const ranked = sortOffers(
    [
      makeOffer({
        id: 'later-iso',
        provider: 'Sunweb',
        departureDate: '2026-09-29',
      }),
      makeOffer({
        id: 'corendon-dmy',
        provider: 'Corendon',
        departureDate: '28/09/2026',
      }),
    ],
    'departure',
  );

  assert.deepEqual(
    ranked.map((offer) => offer.id),
    ['corendon-dmy', 'later-iso'],
  );
});

test('D-E. Eliza Flight stays visible with hasCarRental filter off and on', () => {
  const elizaFlight = makeOffer({
    id: 'eliza-6270665',
    provider: 'Eliza was here',
    hasCarRental: true,
  });
  assert.equal(filterOffers([elizaFlight], {}).length, 1);
  assert.equal(filterOffers([elizaFlight], { hasCarRental: true }).length, 1);
});

test('A-J. hasCarRental is an optional filter, not an exclusion', () => {
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

test('L. faceted car-rental count ignores the hasCarRental param itself', () => {
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

test('K. hasCarRental is not a sort key', () => {
  const mixed = [
    makeOffer({ id: 'b', provider: 'Sunweb', price: 900, pricePerDay: 112, hasCarRental: true }),
    makeOffer({ id: 'a', provider: 'Sunweb', price: 500, pricePerDay: 62 }),
    makeOffer({ id: 'c', provider: 'Sunweb', price: 700, pricePerDay: 87, hasCarRental: true }),
  ];
  const withoutFlag = mixed.map(({ hasCarRental: _ignored, ...offer }) => offer);
  assert.deepEqual(
    sortOffers(mixed, 'price').map((offer) => offer.id),
    sortOffers(withoutFlag, 'price').map((offer) => offer.id),
  );
  assert.deepEqual(sortOffers(mixed, 'price').map((offer) => offer.id), ['a', 'c', 'b']);
});
