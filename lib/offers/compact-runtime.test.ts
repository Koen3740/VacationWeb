import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOffer } from '@/lib/feeds/canonical/normalize-offer';
import type { StoredOffer } from '@/lib/feeds/types/stored-offer';
import {
  attachResultsCardGalleriesFromDetails,
  compactStoredOffer,
  mergeOfferDetail,
  RESULTS_CARD_GALLERY_MAX,
  selectResultsCardGalleryImages,
  splitStoredCatalog,
} from '@/lib/offers/compact-runtime';
import { collectOrderedOfferImages } from '@/lib/offers/offer-images';
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
  assert.deepEqual(runtime.images, [
    'https://example.com/a.jpg',
    'https://example.com/b.jpg',
    'https://example.com/c.jpg',
  ]);
  assert.equal(runtime.descriptionLong, undefined);
  assert.equal(runtime.feedDescription, undefined);
  assert.equal(runtime.accommodation, undefined);
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

test('compact runtime stores decoded hotelName once', () => {
  const { runtime } = compactStoredOffer(
    makeStored({ hotelName: "Appartementen Villa&#039;s Elpiniki" }),
  );
  assert.equal(runtime.hotelName, "Appartementen Villa's Elpiniki");
  assert.equal(normalizeOffer(runtime).hotelName, "Appartementen Villa's Elpiniki");
});

test('compact runtime keeps Corendon listing/source context on the catalog', () => {
  const listings = [
    {
      provider: 'Corendon',
      feedId: 'corendon-benl',
      campaignId: '38103',
      host: 'www.corendon.be',
      deepLink: 'https://www.corendon.be/vakantie#5007.MLELC.EINPMI.041027.3.DZI-U',
      locale: 'nl-BE',
    },
    {
      provider: 'Corendon',
      feedId: 'corendon-nl',
      campaignId: '38108',
      host: 'www.corendon.nl',
      deepLink: 'https://www.corendon.nl/vakantie#5007.MLELC.EINPMI.041027.3.DZI-U',
      locale: 'nl-NL',
    },
  ];
  const { runtime, detail } = compactStoredOffer(
    makeStored({
      provider: 'Corendon',
      externalId: 'corendon-5007-EINPMI-041027-3-DZIU',
      feedSourceId: 'corendon-benl',
      listingHost: 'www.corendon.be',
      arrivalAirport: 'PMI',
      providerListings: listings,
      localizedDescriptions: { 'nl-BE': 'BE copy', 'nl-NL': 'NL copy' },
    }),
  );

  assert.equal(runtime.feedSourceId, 'corendon-benl');
  assert.equal(runtime.listingHost, 'www.corendon.be');
  assert.equal(runtime.arrivalAirport, 'PMI');
  assert.deepEqual(runtime.providerListings, listings);
  assert.equal(runtime.localizedDescriptions, undefined);
  assert.deepEqual(detail?.localizedDescriptions, { 'nl-BE': 'BE copy', 'nl-NL': 'NL copy' });
});

test('compact runtime keeps Sunweb providerListings on the catalog', () => {
  const listings = [
    {
      provider: 'Sunweb',
      feedId: 'sunweb-accomodatie',
      campaignId: '1393',
      host: 'www.sunweb.be',
      deepLink: 'https://www.sunweb.be/nl/vakantie/reizen?tt=1393_1754875_511747_&r=x',
    },
    {
      provider: 'Sunweb',
      feedId: 'sunweb-griekenland',
      campaignId: '1393',
      host: 'www.sunweb.be',
      deepLink: 'https://www.sunweb.be/nl/vakantie/reizen?tt=1393_2087580_511747_&r=x',
    },
    {
      provider: 'Sunweb',
      feedId: 'sunweb-lastminute',
      campaignId: '1393',
      host: 'www.sunweb.be',
      deepLink: 'https://www.sunweb.be/nl/vakantie/reizen?tt=1393_1761331_511747_&r=x',
    },
  ];
  const { runtime } = compactStoredOffer(
    makeStored({
      provider: 'Sunweb',
      externalId: 'sunweb-38128-2026-08-28-8-BRU-Logies',
      hotelName: "Appartementen Villa's Elpiniki",
      feedSourceId: 'sunweb-accomodatie',
      listingHost: 'www.sunweb.be',
      providerListings: listings,
    }),
  );
  assert.equal(runtime.providerListings?.length, 3);
  assert.deepEqual(runtime.providerListings, listings);
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

test('Eliza compact runtime uses XML[3] as Results hero and keeps feed order in the sidecar', () => {
  const images = [
    'https://static.elizawashere.be/products/Images/Original/51100000/42000/51142586-Original.jpg?width=640&height=640&mode=crop',
    'https://static.elizawashere.be/products/Images/Original/46100000/21000/46121218-Original.jpg?width=640&height=640&mode=crop',
    'https://static.elizawashere.be/products/Images/Original/46100000/21000/46121244-Original.jpg?width=640&height=640&mode=crop',
    'https://static.elizawashere.be/products/Images/Original/46100000/21000/46121219-Original.jpg?width=640&height=640&mode=crop',
    'https://static.elizawashere.be/products/Images/Original/51100000/42000/51142588-Original.jpg?width=640&height=640&mode=crop',
    'https://static.elizawashere.be/products/Images/Original/51100000/42000/51142587-Original.jpg?width=640&height=640&mode=crop',
  ];
  const stored = makeStored({
    provider: 'Eliza was here',
    externalId: 'eliza-133863',
    imageUrl: images[0],
    imageLarge: images[0],
    imageSmall: images[1],
    images,
  });
  const { runtime, detail } = compactStoredOffer(stored);
  assert.equal(runtime.imageUrl, images[3]);
  assert.deepEqual(detail?.images, images);

  const merged = mergeOfferDetail(normalizeOffer(runtime), detail);
  const display = collectOrderedOfferImages(merged);
  assert.equal(display[0], images[3]);
  assert.deepEqual(display, [images[3], images[0], images[1], images[2], images[4], images[5]]);
});

test('compact runtime hero prefers split imageURL_large over tagged thumbnail', () => {
  const a1 = 'https://images.corendonresources.com/L1E2208A1W1600H1066.jpg?v=1';
  const a2 = 'https://images.corendonresources.com/L1E2208A2W1600H1066.jpg?v=1';
  const thumb = 'https://images.corendonresources.com/L1E2208A2W0H0.jpg?v=1';
  const { runtime, detail } = compactStoredOffer(
    makeStored({
      provider: 'Corendon',
      imageUrl: thumb,
      imageLarge: `${a1},${a2}`,
      images: [thumb, a2],
    }),
  );
  assert.equal(runtime.imageUrl, a1);
  assert.ok(detail?.images?.includes(thumb));
  assert.ok(detail?.images?.includes(a2));
  assert.equal(detail?.images?.[0], a1);
});

test('compact runtime keeps hasCarRental=true and omits false', () => {
  const kept = compactStoredOffer(makeStored({ hasCarRental: true }));
  assert.equal(kept.runtime.hasCarRental, true);
  assert.equal(normalizeOffer(kept.runtime).hasCarRental, true);

  const omitted = compactStoredOffer(makeStored({ hasCarRental: false }));
  assert.equal(omitted.runtime.hasCarRental, undefined);
  assert.equal(normalizeOffer(omitted.runtime).hasCarRental, undefined);
});

test('G. compact/normalize keeps Eliza Flight hasCarRental=true', () => {
  const compacted = compactStoredOffer(
    makeStored({
      externalId: 'eliza-6270665',
      provider: 'Eliza was here',
      flightIncluded: 'true',
      hasCarRental: true,
    }),
  );
  assert.equal(compacted.runtime.hasCarRental, true);
  assert.equal(normalizeOffer(compacted.runtime).hasCarRental, true);
});

test('selectResultsCardGalleryImages keeps ordered catalog photos up to RESULTS_CARD_GALLERY_MAX', () => {
  const urls = Array.from(
    { length: 50 },
    (_, index) => `https://example.com/${index + 1}.jpg`,
  );
  assert.equal(RESULTS_CARD_GALLERY_MAX, 40);
  assert.deepEqual(selectResultsCardGalleryImages({ images: urls }), urls.slice(0, 40));
  assert.deepEqual(selectResultsCardGalleryImages({ images: urls.slice(0, 10) }), urls.slice(0, 10));
  assert.deepEqual(selectResultsCardGalleryImages({ images: urls.slice(0, 3) }), urls.slice(0, 3));
  assert.deepEqual(selectResultsCardGalleryImages({ images: urls.slice(0, 1) }), urls.slice(0, 1));
  assert.deepEqual(selectResultsCardGalleryImages({ images: [] }), []);
});

test('attachResultsCardGalleriesFromDetails restores card galleries from sidecar', () => {
  const runtime = [
    makeStored({
      externalId: 'a',
      images: undefined,
      imageLarge: undefined,
      imageSmall: undefined,
    }),
    makeStored({
      externalId: 'b',
      images: undefined,
      imageLarge: undefined,
      imageSmall: undefined,
    }),
  ].map((stored) => compactStoredOffer(stored).runtime);

  assert.equal(runtime[0].images, undefined);

  const details = {
    a: {
      images: [
        'https://example.com/a1.jpg',
        'https://example.com/a2.jpg',
        'https://example.com/a3.jpg',
        'https://example.com/a4.jpg',
        'https://example.com/a5.jpg',
        'https://example.com/a6.jpg',
      ],
    },
    b: {
      images: ['https://example.com/b1.jpg'],
    },
  };

  const enriched = attachResultsCardGalleriesFromDetails(runtime, details);
  assert.ok((enriched[0].images?.length ?? 0) >= 5);
  assert.ok((enriched[0].images?.length ?? 0) <= RESULTS_CARD_GALLERY_MAX);
  // Existing Results hero stays first; sidecar URLs fill remaining slots.
  assert.equal(enriched[0].imageUrl, runtime[0].imageUrl);
  assert.equal(enriched[0].images?.[0], runtime[0].imageUrl);
  assert.ok(enriched[0].images?.includes('https://example.com/a1.jpg'));
  // Offer B: hero + one distinct sidecar URL → multi gallery (single-only stays undefined).
  assert.deepEqual(enriched[1].images, [
    runtime[1].imageUrl,
    'https://example.com/b1.jpg',
  ]);
});

test('splitStoredCatalog keeps ≤RESULTS_CARD_GALLERY_MAX card images on runtime from detail gallery', () => {
  const urls = Array.from(
    { length: 12 },
    (_, index) => `https://example.com/g${index + 1}.jpg`,
  );
  const { runtime, details } = splitStoredCatalog([
    makeStored({
      externalId: 'multi',
      imageUrl: urls[0],
      imageLarge: urls[0],
      imageSmall: urls[1],
      images: urls,
    }),
    makeStored({
      externalId: 'single',
      imageUrl: 'https://example.com/only.jpg',
      imageLarge: 'https://example.com/only.jpg',
      imageSmall: undefined,
      images: ['https://example.com/only.jpg'],
    }),
  ]);

  assert.equal(runtime[0].images?.length, 12);
  assert.ok((details.multi?.images?.length ?? 0) >= 5);
  assert.equal(runtime[1].images, undefined);
  assert.equal(details.single?.images, undefined);
});
test('attachResultsCardGalleriesFromDetails leaves true single-image offers unchanged', () => {
  const runtime = [
    compactStoredOffer(
      makeStored({
        externalId: 'solo',
        images: ['https://example.com/solo.jpg'],
        imageUrl: 'https://example.com/solo.jpg',
        imageLarge: 'https://example.com/solo.jpg',
        imageSmall: undefined,
      }),
    ).runtime,
  ];
  const enriched = attachResultsCardGalleriesFromDetails(runtime, {
    solo: { images: ['https://example.com/solo.jpg'] },
  });
  assert.equal(enriched[0].images, undefined);
  assert.equal(enriched[0].imageUrl, 'https://example.com/solo.jpg');
});
