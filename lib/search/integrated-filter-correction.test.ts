import assert from 'node:assert/strict';
import test from 'node:test';
import { carRentalIncludedLabel, offerHasCarRental } from '@/lib/offers/has-car-rental';
import {
  ACCOMMODATION_TYPE_FILTER_VALUES,
  canonicalizeAccommodationType,
  effectiveAccommodationTypesForFilter,
  offerMatchesAccommodationType,
} from '@/lib/search/accommodation-type-filter';
import {
  getAmenityPresence,
  offerMatchesAmenity,
  offerMatchesAnyAmenity,
} from '@/lib/search/amenity-filters';
import { countAmenityFacet, countCarRentalFacet, filterOffers } from '@/lib/search/filtering';
import {
  filterToResultsListableOffers,
  hasValidPresentablePrice,
  isResultsListableOffer,
} from '@/lib/search/presentable-price';
import type { TravelOffer } from '@/types/travel';

function flightDeepLink(provider: string): string {
  if (provider === 'Sunweb') {
    return (
      'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
      encodeURIComponent(
        'https://www.sunweb.be/nl/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-20',
      )
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

const visibleFourTypes = ['Hotel', 'Appartement', 'Aparthotel', 'Villa'] as const;

test('accommodation: [] = no restriction', () => {
  const offers = [
    makeOffer({ id: 'a', provider: 'Sunweb', accommodationType: 'Hotel' }),
    makeOffer({ id: 'b', provider: 'Sunweb', accommodationType: 'Studio' }),
    makeOffer({ id: 'c', provider: 'Sunweb' }),
  ];
  assert.equal(filterOffers(offers, {}).length, 3);
});

test('accommodation: multi-select uses OR union, not AND', () => {
  const offers = [
    makeOffer({ id: 'hotel', provider: 'Sunweb', accommodationType: 'Hotel' }),
    makeOffer({ id: 'apt', provider: 'Sunweb', accommodationType: 'Appartement' }),
    makeOffer({ id: 'villa', provider: 'Sunweb', accommodationType: 'Villa' }),
    makeOffer({ id: 'resort', provider: 'Sunweb', accommodationType: 'Resort' }),
  ];
  const filtered = filterOffers(offers, {
    accommodationTypes: ['Hotel', 'Appartement', 'Villa'],
  });
  assert.deepEqual(
    filtered.map((offer) => offer.id).sort(),
    ['apt', 'hotel', 'villa'],
  );
});

test('accommodation: all visible canonical types = equivalent to no type filter', () => {
  const offers = [
    makeOffer({ id: 'hotel', provider: 'Sunweb', accommodationType: 'Hotelkamer' }),
    makeOffer({ id: 'resort', provider: 'Sunweb', accommodationType: 'Resort' }),
    makeOffer({ id: 'unknown', provider: 'Sunweb' }),
  ];
  const none = filterOffers(offers, {});
  const effective = effectiveAccommodationTypesForFilter(
    [...visibleFourTypes],
    [...visibleFourTypes],
  );
  assert.equal(effective.length, 0);
  const allVisible = filterOffers(offers, {
    accommodationTypes: effective.length > 0 ? effective : undefined,
  });
  assert.deepEqual(
    allVisible.map((offer) => offer.id).sort(),
    none.map((offer) => offer.id).sort(),
  );
});

test('accommodation: feed synonyms canonicalize to sidebar values', () => {
  assert.equal(canonicalizeAccommodationType('Hotelkamer'), 'Hotel');
  assert.equal(canonicalizeAccommodationType('Studio'), 'Appartement');
  assert.equal(offerMatchesAccommodationType('Hotelkamer', ['Hotel']), true);
});

test('wifi: missing provider data is unknown, not absent', () => {
  const offer = makeOffer({ id: 'plain', provider: 'Sunweb' });
  assert.equal(getAmenityPresence(offer, 'wifi'), 'unknown');
  assert.equal(offerMatchesAmenity(offer, 'wifi'), false);
  assert.equal(filterOffers([offer], { amenities: ['wifi'] }).length, 0);
  assert.equal(filterOffers([offer], {}).length, 1);
});

test('wifi: explicit mention matches; bare wifi keyword is accepted', () => {
  const offer = makeOffer({
    id: 'wifi',
    provider: 'Sunweb',
    feedDescription: 'Kamer met wifi en balkon.',
  });
  assert.equal(getAmenityPresence(offer, 'wifi'), 'present');
  assert.equal(filterOffers([offer], { amenities: ['wifi'] }).length, 1);
});

test('airco: missing ≠ absent; explicit negation is absent', () => {
  const unknown = makeOffer({ id: 'u', provider: 'Sunweb' });
  const absent = makeOffer({
    id: 'a',
    provider: 'Sunweb',
    feedDescription: 'Kamer zonder airconditioning.',
  });
  const present = makeOffer({
    id: 'p',
    provider: 'Sunweb',
    feedDescription: 'Kamer met airconditioning.',
  });
  assert.equal(getAmenityPresence(unknown, 'airco'), 'unknown');
  assert.equal(getAmenityPresence(absent, 'airco'), 'absent');
  assert.equal(getAmenityPresence(present, 'airco'), 'present');
  assert.equal(offerMatchesAmenity(absent, 'airco'), false);
  assert.equal(offerMatchesAmenity(present, 'airco'), true);
});

test('autohuur: badge and filter share the same canonical hasCarRental truth', () => {
  const withFlag = makeOffer({ id: 'car', provider: 'Sunweb', hasCarRental: true });
  const namedOnly = makeOffer({
    id: 'named',
    provider: 'Sunweb',
    hotelName: 'Olée inclusief huurauto',
  });
  assert.equal(carRentalIncludedLabel(withFlag), 'Inclusief huurauto');
  assert.equal(offerHasCarRental(withFlag), true);
  assert.equal(carRentalIncludedLabel(namedOnly), undefined);
  assert.equal(filterOffers([withFlag, namedOnly], { hasCarRental: true }).length, 1);
  assert.equal(
    filterOffers([withFlag, namedOnly], { hasCarRental: true })[0]?.id,
    withFlag.id,
  );
});

test('filter counts: car rental facet respects listability gate', () => {
  const listableCar = makeOffer({
    id: 'listable',
    provider: 'Sunweb',
    hasCarRental: true,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 1600,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
    price: 800,
  });
  const catalogOnlyCar = makeOffer({
    id: 'unavailable',
    provider: 'Sunweb',
    hasCarRental: true,
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'http_204',
  });
  const offers = [listableCar, catalogOnlyCar];
  assert.equal(isResultsListableOffer(listableCar), true);
  assert.equal(hasValidPresentablePrice(listableCar), true);
  assert.equal(isResultsListableOffer(catalogOnlyCar), false);

  const facet = countCarRentalFacet(offers, {});
  const listableMatches = filterToResultsListableOffers(
    filterOffers(offers, { hasCarRental: true }),
  ).length;
  assert.equal(facet, 1);
  assert.equal(listableMatches, 1);
});

test('filter counts: amenity facet uses same matcher as result list', () => {
  const withWifi = makeOffer({
    id: 'wifi',
    provider: 'Sunweb',
    feedDescription: 'Gratis wifi in de lobby.',
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 1600,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
    price: 800,
  });
  const withoutWifi = makeOffer({
    id: 'plain',
    provider: 'Sunweb',
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 1600,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
    price: 800,
  });
  const offers = [withWifi, withoutWifi];
  const facet = countAmenityFacet(offers, {}, 'wifi');
  const listed = filterToResultsListableOffers(
    filterOffers(offers, { amenities: ['wifi'] }),
  ).length;
  assert.equal(facet, 1);
  assert.equal(listed, 1);
});

test('badge-data: aquapark ignores marketing copy; structured categories only', () => {
  assert.equal(
    offerMatchesAmenity(
      makeOffer({
        id: 'copy',
        provider: 'Sunweb',
        feedDescription: 'Leuk met waterglijbaan voor kids.',
      }),
      'aquapark',
    ),
    false,
  );
  assert.equal(
    offerMatchesAmenity(
      makeOffer({ id: 'structured', provider: 'Sunweb', subcategories: 'Aquapark, Familie' }),
      'aquapark',
    ),
    true,
  );
});

test('amenities combine with AND across selected values', () => {
  const offer = makeOffer({
    id: 'both',
    provider: 'Sunweb',
    feedDescription: 'Buitenzwembad en sauna aanwezig.',
  });
  assert.equal(offerMatchesAnyAmenity(offer, ['pool_outdoor', 'sauna']), true);
  assert.equal(offerMatchesAnyAmenity(offer, ['pool_outdoor', 'wifi']), false);
});

test('accommodation: all five canonical types selected clears effective filter', () => {
  assert.equal(
    effectiveAccommodationTypesForFilter([...ACCOMMODATION_TYPE_FILTER_VALUES]).length,
    0,
  );
});
