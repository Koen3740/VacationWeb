import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOffer } from '@/lib/feeds/canonical/normalize-offer';
import type { StoredOffer } from '@/lib/feeds/types/stored-offer';
import {
  compactStoredOffer,
  mergeOfferDetail,
} from '@/lib/offers/compact-runtime';
import { offerMatchesAmenity } from '@/lib/search/amenity-filters';
import { filterOffers, sortOffers } from '@/lib/search/filtering';
import { offerSearchText } from '@/lib/search/offer-text';
import { offerMatchesVacationType } from '@/lib/search/vacation-type';
import type { TravelOffer } from '@/types/travel';

function makeStored(overrides: Partial<StoredOffer> = {}): StoredOffer {
  return {
    externalId: 'prijsvrij-1',
    provider: 'Prijsvrij',
    hotelName: 'Test Hotel Adults Only',
    country: 'Spanje',
    region: 'Mallorca',
    city: 'Palma',
    nights: 8,
    price: 999,
    currency: 'EUR',
    stars: 4,
    rating: 8.4,
    boardType: 'All Inclusive',
    accommodationType: 'Hotel',
    accommodation: 'Hotelcomplex met tuin',
    departureAirport: 'AMS',
    departureAirportCode: 'AMS',
    departureDate: '2026-09-12',
    deepLink: 'https://example.com/book/prijsvrij-1',
    imageUrl: 'https://example.com/a.jpg',
    imageLarge: 'https://example.com/a.jpg',
    imageSmall: 'https://example.com/b.jpg',
    images: [
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
      'https://example.com/c.jpg',
    ],
    descriptionShort: 'Zonnige vakantie aan zee',
    descriptionLong: 'Uitgebreide omschrijving van het resort.',
    feedDescription: 'Faciliteiten: Buitenzwembad en tuin. Adults only.',
    extraInfo: '2-persoonskamer',
    durationType: 'dagen',
    lastMinute: 'false',
    flightIncluded: 'true',
    affiliateCampaignId: '1',
    ...overrides,
  };
}

test('compact runtime keeps filter/sort/card/live-pricing fields and strips detail copy', () => {
  const { runtime, detail } = compactStoredOffer(makeStored());

  assert.equal(runtime.externalId, 'prijsvrij-1');
  assert.equal(runtime.provider, 'Prijsvrij');
  assert.equal(runtime.deepLink, 'https://example.com/book/prijsvrij-1');
  assert.equal(runtime.departureDate, '2026-09-12');
  assert.equal(runtime.departureAirport, 'AMS');
  assert.equal(runtime.nights, 8);
  assert.equal(runtime.price, 999);
  assert.equal(runtime.stars, 4);
  assert.equal(runtime.rating, 8.4);
  assert.equal(runtime.boardType, 'All Inclusive');
  assert.equal(runtime.accommodationType, 'Hotel');
  assert.equal(runtime.descriptionShort, 'Zonnige vakantie aan zee');
  assert.equal(runtime.extraInfo, '2-persoonskamer');
  assert.equal(runtime.imageUrl, 'https://example.com/a.jpg');
  assert.equal(runtime.descriptionLong, undefined);
  assert.equal(runtime.feedDescription, undefined);
  assert.equal(runtime.accommodation, undefined);
  assert.equal(runtime.images, undefined);
  assert.equal(runtime.durationType, undefined);
  assert.ok(runtime.searchText?.includes('buitenzwembad'));

  assert.ok(detail);
  assert.equal(detail.descriptionLong, 'Uitgebreide omschrijving van het resort.');
  assert.equal(detail.feedDescription, 'Faciliteiten: Buitenzwembad en tuin. Adults only.');
  assert.equal(detail.accommodation, 'Hotelcomplex met tuin');
  assert.deepEqual(detail.images, [
    'https://example.com/a.jpg',
    'https://example.com/b.jpg',
    'https://example.com/c.jpg',
  ]);
  assert.equal(detail.durationType, 'dagen');
});

test('compact searchText stores overlapping long/feed copy once', () => {
  const { runtime } = compactStoredOffer(
    makeStored({
      descriptionLong: 'Faciliteiten: Buitenzwembad en tuin. Adults only.',
      feedDescription: 'Faciliteiten: Buitenzwembad en tuin. Adults only.',
    }),
  );

  const haystack = runtime.searchText ?? '';
  assert.equal(haystack.split('buitenzwembad').length - 1, 1);
  assert.ok(offerMatchesAmenity(normalizeOffer(runtime), 'pool_outdoor'));
});

test('compact searchText preserves amenity and vacation-type matching', () => {
  const full = normalizeOffer(makeStored());
  const compact = normalizeOffer(compactStoredOffer(makeStored()).runtime);

  assert.equal(offerMatchesAmenity(full, 'pool_outdoor'), true);
  assert.equal(offerMatchesAmenity(compact, 'pool_outdoor'), true);
  assert.equal(offerMatchesVacationType(full, 'Adults Only'), true);
  assert.equal(offerMatchesVacationType(compact, 'Adults Only'), true);
  assert.ok(offerSearchText(compact).includes('buitenzwembad'));
  assert.ok(offerSearchText(compact).includes('hotelcomplex'));
});

test('filter and sort semantics stay the same on compact offers', () => {
  const stored = [
    makeStored({ externalId: 'a', price: 800, stars: 3, rating: 7, departureAirport: 'BRU' }),
    makeStored({
      externalId: 'b',
      price: 600,
      stars: 5,
      rating: 9,
      nights: 7,
      city: 'Alcudia',
    }),
  ];
  const full = stored.map(normalizeOffer);
  const compact = stored.map((item) => normalizeOffer(compactStoredOffer(item).runtime));

  const params = { countries: ['Spanje'], nightsMin: 7, nightsMax: 8, stars: [5] };
  const fullFiltered = filterOffers(full, params);
  const compactFiltered = filterOffers(compact, params);
  assert.deepEqual(
    compactFiltered.map((offer) => offer.id),
    fullFiltered.map((offer) => offer.id),
  );

  assert.deepEqual(
    sortOffers(compact.map((offer) => offer as TravelOffer), 'price').map((offer) => offer.id),
    sortOffers(full, 'price').map((offer) => offer.id),
  );
  assert.deepEqual(
    sortOffers(compact, 'price-per-day').map((offer) => offer.id),
    sortOffers(full, 'price-per-day').map((offer) => offer.id),
  );
});

test('detail merge restores long copy and gallery without changing identity', () => {
  const stored = makeStored();
  const { runtime, detail } = compactStoredOffer(stored);
  const merged = mergeOfferDetail(normalizeOffer(runtime), detail);

  assert.equal(merged.id, 'prijsvrij-1');
  assert.equal(merged.provider, 'Prijsvrij');
  assert.equal(merged.deepLink, stored.deepLink);
  assert.equal(merged.descriptionLong, stored.descriptionLong);
  assert.equal(merged.feedDescription, stored.feedDescription);
  assert.equal(merged.accommodation, stored.accommodation);
  assert.equal(merged.durationType, stored.durationType);
  assert.deepEqual(merged.images, [
    'https://example.com/a.jpg',
    'https://example.com/b.jpg',
    'https://example.com/c.jpg',
  ]);
});
