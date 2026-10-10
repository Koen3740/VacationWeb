import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OfferDetailContent } from '@/components/offers/offer-detail-content';
import { OfferPriceCard } from '@/components/offers/offer-price-card';
import { buildDetailOfferExtras } from '@/lib/offers/detail-extras';
import type { TravelOffer } from '@/types/travel';

(globalThis as { React?: unknown }).React = React;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

const TWO_ADULTS = {
  adults: 2,
  rooms: 1,
  party: [
    { age: null, roomIndex: 0 },
    { age: null, roomIndex: 0 },
  ],
};

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'sunweb-lab',
    provider: 'Sunweb',
    hotelName: 'Bougainvillea Beach Resort',
    destinationCountry: 'Spanje',
    destinationCity: 'Costa Adeje',
    departureAirport: 'BRU',
    departureAirportCode: 'BRU',
    departureDate: '2026-10-10',
    boardType: 'Halfpension',
    nights: 8,
    flightIncluded: 'true',
    price: 999,
    pricePerDay: 142,
    imageUrl: '/images/verified/crete/vw-story-crete-vai-beach-commons.jpg',
    deepLink: 'https://www.sunweb.be/hotel',
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 2215.5,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
    ...overrides,
  };
}

const IMAGES = [
  '/images/verified/crete/vw-story-crete-vai-beach-commons.jpg',
  '/images/verified/crete/vw-story-crete-balos-aerial-commons.jpg',
  '/images/verified/crete/vw-story-crete-elafonissi-water-15071869.jpg',
  '/images/verified/sicily/vw-story-sicily-cefalu-waterfront-18453312.jpg',
  '/images/verified/sicily/vw-story-sicily-isola-bella-37105275.jpg',
  '/images/verified/crete/vw-pool-crete-falassarna.jpg',
  '/images/verified/crete/vw-story-crete-knossos-palace-commons.jpg',
];

function detailHtml(offer: TravelOffer, extras?: ReturnType<typeof buildDetailOfferExtras>) {
  return renderToStaticMarkup(
    createElement(OfferDetailContent, {
      offer,
      params: TWO_ADULTS,
      resultsHref: '/results',
      galleryImages: IMAGES,
      rooms: [],
      selectedRoom: null,
      sections: [],
      presentable: true,
      themes: [],
      isLastMinute: false,
      extras,
    }),
  );
}

test('price card leads with the party total, keeps p.p. small, and drops per-day and vanaf', () => {
  const html = detailHtml(makeOffer());
  assert.match(html, /Totaal voor 2 volwassenen/);
  assert.match(html, /data-testid="detail-total"[^>]*>[^<]*2\.215,50/);
  assert.match(html, /data-testid="detail-pp"[^>]*>[^<]*999,00 p\.p\./);
  assert.match(html, /text-\[40px\][^"]*" data-testid="detail-total"|data-testid="detail-total"/);
  assert.match(html, /text-\[13px\][^"]*" data-testid="detail-pp"/);
  assert.doesNotMatch(html, /1\.998,00/);
  assert.doesNotMatch(html, /Prijs per dag/);
  assert.doesNotMatch(html, /vanaf/i);
  assert.doesNotMatch(html, /p\.p\. \/ dag/);
});

test('optional rows stay out of the HTML when the provider did not deliver them', () => {
  const html = detailHtml(makeOffer());
  assert.doesNotMatch(html, /TE VERIFIËREN/);
  assert.doesNotMatch(html, /onbekend/i);
  assert.doesNotMatch(html, /Reserveringskosten/);
  assert.doesNotMatch(html, /garantiefonds/i);
  assert.doesNotMatch(html, /SGR/);
  assert.doesNotMatch(html, /Bagage/);
  assert.doesNotMatch(html, /Transfer/);
  assert.doesNotMatch(html, /Vertrektijd/);
  assert.doesNotMatch(html, /Aankomstluchthaven/);
  assert.doesNotMatch(html, /line-through/);
  assert.doesNotMatch(html, /Dagprogramma/);
  assert.doesNotMatch(html, /data-testid="detail-rental-car"/);
  assert.doesNotMatch(html, /€\s*25/);
  assert.doesNotMatch(html, /geen verborgen kosten/i);
});

test('return date and book button are shown, including the mobile bar total', () => {
  const html = detailHtml(makeOffer());
  assert.match(html, /data-testid="detail-return-date"[\s\S]*17\s*okt\.?\s*2026/i);
  assert.match(html, /Terugreis/);
  const book = html.match(/Bekijk en boek bij Sunweb/g) ?? [];
  assert.ok(book.length >= 2, `expected card and sticky bar, got ${book.length}`);
  assert.match(html, /data-testid="detail-book-bar"[\s\S]*2\.215,50/);
  assert.doesNotMatch(html, /Boek bij Sunweb/);
});

test('gallery is a 4:3 snap row with counter, dots and a desktop all-photos control', () => {
  const html = detailHtml(makeOffer());
  assert.match(html, /data-testid="offer-gallery"/);
  assert.match(html, /aspect-\[4\/3\]/);
  assert.match(html, /object-cover/);
  assert.match(html, /snap-start snap-always/);
  assert.match(html, /1 \/ 7/);
  assert.match(html, /7 \/ 7/);
  assert.match(html, /Alle 7 foto&#x27;s|Alle 7 foto's/);
  assert.match(html, /data-testid="offer-gallery-dots"/);
});

test('roadtrip without a day programme keeps the hotel layout and a Fly & Drive badge', () => {
  const offer = makeOffer({
    provider: 'Corendon',
    hotelName: 'Fly & Drive Andalusië Compleet',
    hasCarRental: true,
    livePriceSource: 'upsales',
    liveTotalPriceField: 'upsales.totalPrice',
    price: 769,
    liveTotalPrice: 1538,
  });
  const html = detailHtml(offer);
  assert.match(html, /data-testid="detail-trip-badge"[^>]*>Fly &amp; Drive/);
  assert.match(html, /Inclusief huurauto/);
  assert.doesNotMatch(html, /Dagprogramma/);
  assert.doesNotMatch(html, /data-testid="detail-rental-car"/);
  assert.doesNotMatch(html, /Categorie/);
  assert.match(html, /Bekijk en boek bij Corendon/);
});

test('a supplied list price and flight leg render, and a programme renders only when passed', () => {
  const extras = buildDetailOfferExtras(makeOffer(), TWO_ADULTS);
  const html = renderToStaticMarkup(
    createElement(OfferPriceCard, {
      provider: 'Sunweb',
      presentable: true,
      priceKind: 'amount' as const,
      bookHref: 'https://www.sunweb.be/hotel',
      extras: {
        ...extras,
        listPrice: { amount: 4678, currency: 'EUR' },
        discountPercentage: 16,
        flights: [
          {
            direction: 'outbound' as const,
            airlineName: 'TUI fly',
            flightNumber: 'TB123',
            departureAt: '06:40',
            arrivalAt: '10:15',
            baggage: { checkedWeightKg: 20 },
          },
        ],
      },
    }),
  );
  assert.match(html, /line-through/);
  assert.match(html, /4\.678,00/);
  assert.match(html, /−16%/);
  assert.match(html, /TUI fly TB123/);
  assert.match(html, /06:40/);
  assert.match(html, /20 kg bagage/);

  const programme = detailHtml(makeOffer(), {
    ...extras,
    dayProgramme: [{ day: 1, title: 'Málaga', overnight: 'Málaga' }],
    rentalCar: { category: 'D', pickup: 'Málaga luchthaven' },
  });
  assert.match(programme, /data-testid="detail-day-programme"/);
  assert.match(programme, /Dag 1/);
  assert.match(programme, /data-testid="detail-rental-car"/);
  assert.match(programme, /Málaga luchthaven/);
});

test('offer facts render a higher original total and hide one that is not higher', () => {
  const higher = detailHtml(makeOffer({
    liveDetailFacts: { listPrice: 2637.5, discountPercentage: 16 },
  }));
  assert.match(higher, /data-testid="detail-list-price"/);
  assert.match(higher, /2\.637,50/);
  assert.match(higher, /−16%/);
  assert.match(higher, /data-testid="detail-total"[^>]*>[^<]*2\.215,50/);

  const equal = detailHtml(makeOffer({
    liveDetailFacts: { listPrice: 2215.5, discountPercentage: 16 },
  }));
  assert.doesNotMatch(equal, /line-through/);
  assert.doesNotMatch(equal, /−16%/);
});

test('detail components do not hardcode unverified price claims', () => {
  const files = [
    'components/offers/offer-detail-content.tsx',
    'components/offers/offer-price-card.tsx',
    'components/offers/offer-image-gallery.tsx',
    'lib/offers/detail-extras.ts',
  ];
  for (const file of files) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    assert.doesNotMatch(src, /TE VERIFIËREN/);
    assert.doesNotMatch(src, /Prijs per dag/);
    assert.doesNotMatch(src, /geen verborgen kosten/i);
    assert.doesNotMatch(src, /Reserveringskosten/);
    assert.doesNotMatch(src, /garantiefonds/i);
  }
});
