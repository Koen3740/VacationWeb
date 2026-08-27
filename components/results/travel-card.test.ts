import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import React, { createElement } from 'react';
import { TravelCard } from '@/components/results/travel-card';
import { collectCardHighlights } from '@/lib/offers/card-highlights';
import { displayAccommodationTypeForCard } from '@/lib/search/accommodation-type-filter';
import { hasValidPresentablePrice, isResultsListableOffer } from '@/lib/search/presentable-price';
import type { TravelOffer } from '@/types/travel';

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'test-offer',
    provider: 'Corendon',
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    destinationRegion: 'Costa Brava',
    destinationCity: 'Santa Susanna',
    departureDate: '2026-09-19',
    nights: 8,
    flightIncluded: 'true',
    price: 539,
    pricePerDay: 67,
    imageUrl: '/images/results-card-placeholder.png',
    deepLink: 'https://example.com',
    livePriceStatus: 'proven',
    livePriceSource: 'upsales',
    liveTotalPrice: 1078,
    liveTotalPriceField: 'upsales.totalPrice',
    ...overrides,
  };
}

function cardHtml(
  offer: TravelOffer,
  searchParams?: { adults?: number; departureStart?: string; departureEnd?: string },
): string {
  return renderToStaticMarkup(createElement(TravelCard, { offer, searchParams }));
}

test('displayAccommodationTypeForCard maps BE-FR Hôtel to Hotel', () => {
  assert.equal(displayAccommodationTypeForCard('Hôtel'), 'Hotel');
  assert.equal(displayAccommodationTypeForCard('hotel'), 'Hotel');
});

test('Variant B card shows location hierarchy and canonical accommodation type', () => {
  const offer = makeOffer({
    accommodationType: 'Hôtel',
    rating: 9.7,
  });
  assert.equal(isResultsListableOffer(offer), true);
  assert.equal(hasValidPresentablePrice(offer), true);

  const html = cardHtml(offer, { adults: 2 });
  assert.match(html, /Spanje · Costa Brava · Santa Susanna/);
  assert.match(html, />Hotel ·/);
  assert.doesNotMatch(html, /Hôtel/);
  assert.match(html, /9,7/);
  assert.match(html, /Fantastisch/);
  assert.match(html, /Inclusief vlucht/);
});

test('Variant B places trip info in middle column', () => {
  const offer = makeOffer({
    departureDate: '2026-09-12',
    nights: 8,
    provider: 'Corendon',
    departureAirport: 'EIN',
  });
  const html = cardHtml(offer, { adults: 2 });
  assert.match(html, /12\/09\/2026 – 19\/09\/2026/);
  assert.match(html, /vanaf Eindhoven · 2 personen/);
  assert.doesNotMatch(html, /Bekijk bij Corendon/);
  assert.match(html, /Aangeboden door Corendon/);
});

test('Variant B card omits truncated marketing descriptions', () => {
  const offer = makeOffer({
    descriptionShort:
      'Dit hotel ligt op loopafstand van het strand en het levendige centrum van Santa Susanna met vele restaurants.',
    extraInfo: 'Extra marketing copy that should not appear on the card.',
  });
  const html = cardHtml(offer);
  assert.doesNotMatch(html, /line-clamp/);
  assert.doesNotMatch(html, /loopafstand van het strand/);
  assert.doesNotMatch(html, /Extra marketing copy/);
});

test('Variant B card without rating keeps reserved rating zone and fixed price spacing', () => {
  const offer = makeOffer({ rating: null });
  const html = cardHtml(offer, { adults: 2 });
  assert.match(html, /data-testid="travel-card-rating-zone"/);
  assert.match(html, /min-h-\[28px\]/);
  assert.doesNotMatch(html, /data-testid="travel-card-rating"/);
  assert.doesNotMatch(html, /Fantastisch/);
  assert.doesNotMatch(html, /Uitstekend/);
  assert.match(html, /data-testid="travel-card-price-block"/);
  assert.match(html, /mt-2\.5/);
});

test('Variant B rating renders badge + label on one compact line', () => {
  const offer = makeOffer({ rating: 9.5 });
  const html = cardHtml(offer, { adults: 2 });
  assert.match(html, /data-testid="travel-card-rating"/);
  assert.match(html, /9,5/);
  assert.match(html, /Fantastisch/);
  assert.match(html, /rounded-md/);
  assert.match(html, /text-\[14px\]/);
  assert.doesNotMatch(html, /text-\[22px\]/);
});

test('Variant B card with zero highlights omits highlight grid', () => {
  const offer = makeOffer({ provider: 'Sunweb', feedDescription: undefined, searchText: undefined });
  const html = cardHtml(offer, { adults: 2 });
  assert.doesNotMatch(html, />✓</);
});

test('Variant B middle column uses three natural blocks without stretch; right column may justify-between', () => {
  const offer = makeOffer({
    feedDescription:
      'Buitenzwembad, airconditioning, gratis wifi. Openbaar strand op circa 200 meter.',
    departureDate: '2026-09-12',
    nights: 8,
    departureAirport: 'EIN',
  });
  const html = cardHtml(offer, { adults: 2 });
  assert.doesNotMatch(html, /md:min-h-\[255px\]/);
  assert.doesNotMatch(html, /md:flex md:min-h-\[255px\] md:flex-col md:justify-between/);
  assert.match(html, /md:justify-between md:border-l/);
  assert.match(html, /mt-5 grid grid-cols-3 gap-x-3 gap-y-2/);
});

test('Variant B keeps hotel name and stars inline in title', () => {
  const offer = makeOffer({ hotelName: 'Reymar Hotel', stars: 3 });
  const html = cardHtml(offer, { adults: 2 });
  assert.match(html, />Reymar Hotel/);
  assert.match(html, /★★★/);
  assert.doesNotMatch(html, /flex flex-wrap items-center gap-2/);
});

test('rating zone is always reserved; price block spacing identical with/without rating', () => {
  const withRating = cardHtml(makeOffer({ rating: 8.6 }), { adults: 2 });
  assert.match(withRating, /data-testid="travel-card-rating-zone"/);
  assert.match(withRating, /data-testid="travel-card-rating"/);
  assert.match(withRating, /8,6/);
  assert.match(withRating, /Uitstekend/);
  assert.match(withRating, /data-testid="travel-card-price-block"/);
  assert.match(withRating, /mt-2\.5/);
  assert.doesNotMatch(withRating, /text-\[22px\]/);

  const withoutRating = cardHtml(makeOffer({ rating: null }), { adults: 2 });
  assert.match(withoutRating, /data-testid="travel-card-rating-zone"/);
  assert.match(withoutRating, /min-h-\[28px\]/);
  assert.doesNotMatch(withoutRating, /data-testid="travel-card-rating"/);
  assert.doesNotMatch(withoutRating, /Fantastisch|Uitstekend|Zeer goed/);
  assert.match(withoutRating, /data-testid="travel-card-price-block"/);
  assert.match(withoutRating, /mt-2\.5/);
});
test('Variant B card shows up to six highlights in grid', () => {
  const offer = makeOffer({
    feedDescription:
      'Buitenzwembad, binnenzwembad, kinderzwembad, airconditioning, gratis wifi, sauna, hammam. Openbaar strand op circa 200 meter.',
    subcategories: 'Aquapark',
  });
  const highlights = collectCardHighlights(offer);
  assert.ok(highlights.length >= 4);
  assert.ok(highlights.length <= 6);
  const html = cardHtml(offer);
  for (const label of highlights) {
    assert.match(html, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('Huurauto inclusief appears in highlights grid without emoji or badge', () => {
  const withCar = makeOffer({
    hasCarRental: true,
    feedDescription:
      'Buitenzwembad, airconditioning, gratis wifi. Openbaar strand op circa 200 meter.',
  });
  const withoutCar = makeOffer({ hasCarRental: false });

  const highlights = collectCardHighlights(withCar);
  assert.ok(highlights.includes('Huurauto inclusief'));
  assert.ok(highlights.length <= 6);

  const html = cardHtml(withCar);
  assert.match(html, />Huurauto inclusief</);
  assert.doesNotMatch(html, /🚗/);
  assert.doesNotMatch(html, /EFF5FB/);
  assert.doesNotMatch(cardHtml(withoutCar), /Huurauto inclusief/);
});

test('Variant B heart sits over the gallery photo as a favorites control', () => {
  const html = cardHtml(makeOffer(), { adults: 2 });
  assert.match(html, /absolute right-2\.5 top-2\.5 z-\[3\]/);
  assert.match(html, /Toevoegen aan favorieten|Verwijder uit favorieten/);
  const galleryIndex = html.indexOf('md:aspect-[3/2]');
  const heartIndex = html.indexOf('absolute right-2.5 top-2.5');
  assert.ok(galleryIndex >= 0 && heartIndex > galleryIndex);
});

test('collectCardHighlights only includes proven structured amenities', () => {
  const offer = makeOffer({
    feedDescription:
      'Faciliteiten: Buitenzwembad en airconditioning. Openbaar strand op circa 300 meter.',
  });
  const highlights = collectCardHighlights(offer);
  assert.ok(highlights.includes('Zwembad buiten'));
  assert.ok(highlights.includes('Airco'));
  assert.ok(highlights.includes('Nabij strand'));
});

test('collectCardHighlights caps car rental within six-item grid', () => {
  const offer = makeOffer({
    hasCarRental: true,
    feedDescription:
      'Buitenzwembad, binnenzwembad, kinderzwembad, airconditioning, gratis wifi, sauna, hammam. Openbaar strand op circa 200 meter.',
  });
  const highlights = collectCardHighlights(offer);
  assert.equal(highlights.length, 6);
  assert.ok(highlights.includes('Huurauto inclusief'));
});

test('Variant B gallery uses stable 3:2 aspect ratio on desktop', () => {
  const html = cardHtml(makeOffer());
  assert.match(html, /md:aspect-\[3\/2\]/);
  assert.doesNotMatch(html, /md:aspect-auto/);
});

test('Variant B Sunweb card uses provider attribution', () => {
  const offer = makeOffer({
    id: 'sunweb-test',
    provider: 'Sunweb',
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 978,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
  const html = cardHtml(offer, { adults: 2 });
  assert.match(html, /Aangeboden door Sunweb/);
  assert.match(html, /€/);
});
