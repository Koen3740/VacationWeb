import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCOMMODATION_TYPE_FILTER_VALUES,
  canonicalizeAccommodationType,
  effectiveAccommodationTypesForFilter,
  offerMatchesAccommodationType,
  parseAccommodationTypesParam,
} from '@/lib/search/accommodation-type-filter';
import { filterOffers } from '@/lib/search/filtering';
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

test('ACCOMMODATION_TYPE_FILTER_VALUES lists all ten official categories', () => {
  assert.deepEqual([...ACCOMMODATION_TYPE_FILTER_VALUES], [
    'Villa',
    'Vakantiewoning',
    'Bungalow',
    'Appartement',
    'Aparthotel',
    'Hotel',
    'Camping',
    'Vakantiepark',
    'Resort',
    'Hostel',
  ]);
});

test('canonicalizeAccommodationType maps exact provider values to themselves', () => {
  for (const type of ACCOMMODATION_TYPE_FILTER_VALUES) {
    assert.equal(canonicalizeAccommodationType(type), type);
    assert.equal(canonicalizeAccommodationType(type.toLowerCase()), type);
  }
});

test('canonicalizeAccommodationType keeps language variants within the same category', () => {
  assert.equal(canonicalizeAccommodationType('Hôtel'), 'Hotel');
  assert.equal(canonicalizeAccommodationType('Hotelkamer'), 'Hotel');
  assert.equal(canonicalizeAccommodationType('Studio'), 'Appartement');
  assert.equal(canonicalizeAccommodationType('Apartment'), 'Appartement');
});

test('canonicalizeAccommodationType does not merge distinct provider categories', () => {
  assert.equal(canonicalizeAccommodationType('Villa'), 'Villa');
  assert.equal(canonicalizeAccommodationType('Vakantiewoning'), 'Vakantiewoning');
  assert.notEqual(
    canonicalizeAccommodationType('Vakantiewoning'),
    canonicalizeAccommodationType('Villa'),
  );

  assert.equal(canonicalizeAccommodationType('Bungalow'), 'Bungalow');
  assert.equal(canonicalizeAccommodationType('Vakantiepark'), 'Vakantiepark');
  assert.notEqual(
    canonicalizeAccommodationType('Bungalow'),
    canonicalizeAccommodationType('Vakantiepark'),
  );

  assert.equal(canonicalizeAccommodationType('Camping'), 'Camping');
  assert.notEqual(
    canonicalizeAccommodationType('Camping'),
    canonicalizeAccommodationType('Bungalow'),
  );

  assert.equal(canonicalizeAccommodationType('Resort'), 'Resort');
  assert.equal(canonicalizeAccommodationType('Hostel'), 'Hostel');
});

test('canonicalizeAccommodationType returns undefined for empty or unknown values', () => {
  assert.equal(canonicalizeAccommodationType(undefined), undefined);
  assert.equal(canonicalizeAccommodationType(''), undefined);
  assert.equal(canonicalizeAccommodationType('   '), undefined);
  assert.equal(canonicalizeAccommodationType('Bed & Breakfast'), undefined);
  assert.equal(canonicalizeAccommodationType('Chalet'), undefined);
});

test('offerMatchesAccommodationType filters each category independently', () => {
  const cases: Array<[string, AccommodationTypeFilter]> = [
    ['Villa', 'Villa'],
    ['Vakantiewoning', 'Vakantiewoning'],
    ['Bungalow', 'Bungalow'],
    ['Appartement', 'Appartement'],
    ['Aparthotel', 'Aparthotel'],
    ['Hotel', 'Hotel'],
    ['Camping', 'Camping'],
    ['Vakantiepark', 'Vakantiepark'],
    ['Resort', 'Resort'],
    ['Hostel', 'Hostel'],
  ] as const;

  for (const [raw, filter] of cases) {
    assert.equal(offerMatchesAccommodationType(raw, [filter]), true);
    const other = ACCOMMODATION_TYPE_FILTER_VALUES.find((type) => type !== filter);
    assert.ok(other);
    assert.equal(offerMatchesAccommodationType(raw, [other]), false);
  }
});

test('Villa filter excludes Vakantiewoning offers', () => {
  const offers = [
    makeOffer({ id: 'villa', provider: 'Corendon', accommodationType: 'Villa' }),
    makeOffer({ id: 'vw', provider: 'Corendon', accommodationType: 'Vakantiewoning' }),
  ];
  const filtered = filterOffers(offers, { accommodationTypes: ['Villa'] });
  assert.deepEqual(
    filtered.map((offer) => offer.id),
    ['villa'],
  );
});

test('Vakantiewoning filter excludes Villa offers', () => {
  const offers = [
    makeOffer({ id: 'villa', provider: 'Corendon', accommodationType: 'Villa' }),
    makeOffer({ id: 'vw', provider: 'Corendon', accommodationType: 'Vakantiewoning' }),
  ];
  const filtered = filterOffers(offers, { accommodationTypes: ['Vakantiewoning'] });
  assert.deepEqual(
    filtered.map((offer) => offer.id),
    ['vw'],
  );
});

test('Bungalow, Camping and Vakantiepark remain separate filters', () => {
  const offers = [
    makeOffer({ id: 'bungalow', provider: 'Prijsvrij', accommodationType: 'Bungalow' }),
    makeOffer({ id: 'camping', provider: 'Prijsvrij', accommodationType: 'Camping' }),
    makeOffer({ id: 'park', provider: 'Prijsvrij', accommodationType: 'Vakantiepark' }),
  ];

  assert.deepEqual(
    filterOffers(offers, { accommodationTypes: ['Bungalow'] }).map((offer) => offer.id),
    ['bungalow'],
  );
  assert.deepEqual(
    filterOffers(offers, { accommodationTypes: ['Camping'] }).map((offer) => offer.id),
    ['camping'],
  );
  assert.deepEqual(
    filterOffers(offers, { accommodationTypes: ['Vakantiepark'] }).map((offer) => offer.id),
    ['park'],
  );
});

test('Resort and Hostel filter independently from Hotel', () => {
  const offers = [
    makeOffer({ id: 'resort', provider: 'Prijsvrij', accommodationType: 'Resort' }),
    makeOffer({ id: 'hostel', provider: 'Prijsvrij', accommodationType: 'Hostel' }),
    makeOffer({ id: 'hotel', provider: 'Corendon', accommodationType: 'Hotel' }),
  ];
  assert.deepEqual(
    filterOffers(offers, { accommodationTypes: ['Resort'] }).map((offer) => offer.id),
    ['resort'],
  );
  assert.deepEqual(
    filterOffers(offers, { accommodationTypes: ['Hostel'] }).map((offer) => offer.id),
    ['hostel'],
  );
  assert.deepEqual(
    filterOffers(offers, { accommodationTypes: ['Hotel'] }).map((offer) => offer.id),
    ['hotel'],
  );
});

test('unknown accommodationType does not match any selected filter', () => {
  assert.equal(offerMatchesAccommodationType(undefined, ['Hotel']), false);
  assert.equal(offerMatchesAccommodationType('Bed & Breakfast', ['Hotel']), false);
  assert.equal(
    filterOffers(
      [makeOffer({ id: 'bb', provider: 'Corendon', accommodationType: 'Bed & Breakfast' })],
      { accommodationTypes: ['Hotel'] },
    ).length,
    0,
  );
});

test('multi-select accommodation filter uses OR union', () => {
  const offers = [
    makeOffer({ id: 'villa', provider: 'Corendon', accommodationType: 'Villa' }),
    makeOffer({ id: 'vw', provider: 'Corendon', accommodationType: 'Vakantiewoning' }),
    makeOffer({ id: 'hotel', provider: 'Corendon', accommodationType: 'Hotel' }),
  ];
  const filtered = filterOffers(offers, {
    accommodationTypes: ['Villa', 'Vakantiewoning'],
  });
  assert.deepEqual(filtered.map((offer) => offer.id).sort(), ['villa', 'vw']);
});

test('selecting all canonical types clears the effective filter', () => {
  assert.equal(
    effectiveAccommodationTypesForFilter([...ACCOMMODATION_TYPE_FILTER_VALUES]).length,
    0,
  );
});

test('parseAccommodationTypesParam preserves canonical order', () => {
  assert.deepEqual(parseAccommodationTypesParam('Hostel,Villa,Hotel'), [
    'Villa',
    'Hotel',
    'Hostel',
  ]);
});

type AccommodationTypeFilter = (typeof ACCOMMODATION_TYPE_FILTER_VALUES)[number];
