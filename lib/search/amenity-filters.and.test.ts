import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '@/types/travel';
import {
  offerMatchesAmenity,
  offerMatchesAnyAmenity,
} from './amenity-filters';
import { offerMatchesVacationType } from './vacation-type';
import { filterOffers } from './filtering';

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'test-1',
    provider: 'Corendon',
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink: 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.200826.8.DZI-U',
    ...overrides,
  };
}

test('amenities combine with AND: sauna alone cannot enlarge a pool-only set', () => {
  const offers = [
    makeOffer({ id: 'pool-only', feedDescription: 'Buitenzwembad bij het hotel.' }),
    makeOffer({ id: 'sauna-only', feedDescription: 'Privé sauna in de wellness.' }),
    makeOffer({
      id: 'both',
      feedDescription: 'Buitenzwembad en sauna aanwezig.',
    }),
  ];

  const base = filterOffers(offers, { amenities: ['pool_outdoor'] });
  const withSauna = filterOffers(offers, { amenities: ['pool_outdoor', 'sauna'] });

  assert.deepEqual(
    base.map((offer) => offer.id).sort(),
    ['both', 'pool-only'],
  );
  assert.deepEqual(
    withSauna.map((offer) => offer.id),
    ['both'],
  );
  assert.ok(withSauna.length <= base.length);
});

test('sauna filter is a subset of the unfiltered matchset', () => {
  const offers = [
    makeOffer({ id: 'a', feedDescription: 'Hotel met sauna' }),
    makeOffer({ id: 'b', feedDescription: 'Hotel zonder wellness' }),
    makeOffer({ id: 'c', feedDescription: 'Sauna en hammam' }),
  ];
  const base = filterOffers(offers, {});
  const sauna = filterOffers(offers, { amenities: ['sauna'] });
  assert.equal(base.length, 3);
  assert.equal(sauna.length, 2);
  assert.ok(sauna.every((offer) => base.some((item) => item.id === offer.id)));
  assert.ok(sauna.length <= base.length);
});

test('aquapark amenity ignores free description / photo-style copy', () => {
  assert.equal(
    offerMatchesAmenity(
      makeOffer({
        feedDescription: 'Op de foto zie je de waterglijbaan naast het zwembad.',
      }),
      'aquapark',
    ),
    false,
  );
  assert.equal(
    offerMatchesAmenity(
      makeOffer({ subcategories: 'Aquapark, Familie' }),
      'aquapark',
    ),
    true,
  );
  assert.equal(
    offerMatchesVacationType(
      makeOffer({ feedDescription: 'Leuk met waterglijbaan voor kids.' }),
      'Aquapark',
    ),
    false,
  );
  assert.equal(
    offerMatchesVacationType(makeOffer({ subcategories: 'Waterpark' }), 'Aquapark'),
    true,
  );
});

test('offerMatchesAnyAmenity requires every selected amenity', () => {
  const offer = makeOffer({ feedDescription: 'Sauna aanwezig, geen zwembad genoemd.' });
  assert.equal(offerMatchesAnyAmenity(offer, ['sauna']), true);
  assert.equal(offerMatchesAnyAmenity(offer, ['sauna', 'pool_outdoor']), false);
});
