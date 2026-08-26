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

function cardHtml(offer: TravelOffer, searchParams?: { adults?: number }): string {
  return renderToStaticMarkup(createElement(TravelCard, { offer, searchParams }));
}

test('displayAccommodationTypeForCard maps BE-FR Hôtel to Hotel', () => {
  assert.equal(displayAccommodationTypeForCard('Hôtel'), 'Hotel');
  assert.equal(displayAccommodationTypeForCard('hotel'), 'Hotel');
});

test('Variant A card shows location hierarchy and canonical accommodation type', () => {
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
  assert.match(html, /2 personen/);
  assert.match(html, /Inclusief vlucht/);
});

test('Variant A card omits truncated marketing descriptions', () => {
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

test('Huurauto inclusief badge uses canonical hasCarRental', () => {
  const withCar = makeOffer({ hasCarRental: true });
  const withoutCar = makeOffer({ hasCarRental: false });

  assert.match(cardHtml(withCar), /Huurauto inclusief/);
  assert.doesNotMatch(cardHtml(withoutCar), /Huurauto inclusief/);
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
