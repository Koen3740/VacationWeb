import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OfferDetailContent } from '@/components/offers/offer-detail-content';
import { galleryKeyDelta, stepGalleryIndex } from '@/components/offers/offer-image-gallery';
import { OfferPriceCard } from '@/components/offers/offer-price-card';
import type { CatalogRoomType } from '@/lib/offers/catalog-content';
import { buildDetailOfferExtras } from '@/lib/offers/detail-extras';
import { collectThemeLabels } from '@/lib/offers/offer-detail-view';
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

test('mobile gallery stays a 4:3 snap row; desktop is one wide photo with arrows, counter and thumbnails', () => {
  const html = detailHtml(makeOffer());
  assert.match(html, /data-testid="offer-gallery"/);
  assert.match(html, /min-\[901px\]:hidden" aria-label="Foto&#x27;s" data-testid="offer-gallery-track"/);
  assert.match(html, /aspect-\[4\/3\]/);
  assert.match(html, /object-cover/);
  assert.match(html, /snap-start snap-always/);
  assert.match(html, /1 \/ 7/);
  assert.match(html, /7 \/ 7/);
  assert.match(html, /data-testid="offer-gallery-dots"/);
  assert.doesNotMatch(html, /grid-cols-\[2fr_1fr_1fr\]/);

  assert.match(html, /data-testid="offer-gallery-desktop"/);
  assert.match(html, /aspect-\[16\/9\]/);
  assert.match(html, /aria-label="Vorige foto"/);
  assert.match(html, /aria-label="Volgende foto"/);
  assert.match(html, /data-testid="offer-gallery-desktop-counter"[^>]*>1 \/ 7/);
  assert.match(html, /Alle 7 foto&#x27;s|Alle 7 foto's/);
  assert.match(html, /data-testid="offer-gallery-thumbs"/);
  assert.match(html, /overflow-x-auto/);
  assert.match(html, /aria-current="true"/);
  assert.match(html, /aria-label="Foto 3 van 7"/);
  assert.match(html, /focus-visible:outline/);
});

test('gallery index wraps and arrow keys map to a step', () => {
  assert.equal(stepGalleryIndex(0, -1, 40), 39);
  assert.equal(stepGalleryIndex(39, 1, 40), 0);
  assert.equal(stepGalleryIndex(2, 1, 40), 3);
  assert.equal(stepGalleryIndex(0, 1, 1), 0);
  assert.equal(galleryKeyDelta('ArrowLeft'), -1);
  assert.equal(galleryKeyDelta('ArrowRight'), 1);
  assert.equal(galleryKeyDelta('ArrowUp'), null);
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

test('Sunweb detail copy turns br into paragraphs, drops object chips, and hides an accommodation id', () => {
  const offer = makeOffer({
    hotelName: 'SOL Puerto Marina',
    accommodationType: 'Hotel',
    accommodation: '40348',
    descriptionShort: 'Direct aan de haven.<br />Zwembad in de tuin.<script>alert(1)</script>',
    subcategories: 'Familie, [object Object]',
    categories: [{ label: 'Adults only' }, { id: 40348 }] as unknown as string[],
  });
  const html = renderToStaticMarkup(
    createElement(OfferDetailContent, {
      offer,
      params: TWO_ADULTS,
      resultsHref: '/results',
      galleryImages: IMAGES,
      rooms: [],
      selectedRoom: null,
      sections: [{ title: 'Ligging', items: ['Aan de jachthaven<br />Rustige omgeving', '<b>ontbijt</b>'] }],
      intro: 'Eerste indruk.&lt;br /&gt;Tweede indruk.<img src=x onerror=alert(1)>',
      presentable: true,
      themes: collectThemeLabels(offer),
      isLastMinute: false,
    }),
  );

  assert.match(html, /Direct aan de haven\./);
  assert.match(html, /Zwembad in de tuin\./);
  assert.match(html, /Eerste indruk\./);
  assert.match(html, /Tweede indruk\./);
  assert.match(html, /Aan de jachthaven/);
  assert.match(html, /Rustige omgeving/);
  assert.match(html, /ontbijt/);
  assert.doesNotMatch(html, /&lt;br/);
  assert.doesNotMatch(html, /<br/i);
  assert.doesNotMatch(html, /<script|onerror|<b>/i);
  assert.match(html, /Familie/);
  assert.match(html, /Adults only/);
  assert.doesNotMatch(html, /\[object Object\]/);
  assert.match(html, /Accommodatie<\/dt><dd[^>]*>Hotel</);
  assert.doesNotMatch(html, /40348/);
});

function catalogRoom(
  partial: Pick<CatalogRoomType, 'id' | 'name' | 'included'> & Partial<CatalogRoomType>,
): CatalogRoomType {
  return {
    facilities: [],
    images: [],
    ...partial,
  };
}

test('detail shows the priced room and a travellers summary, without a room or date picker', () => {
  const rooms = [
    catalogRoom({ id: 'type-i', name: '2-kamerappartement type I', code: 'I', included: true, area: '28 m²' }),
    catalogRoom({ id: 'villa-a', name: '3-kamer villa type A', code: 'A', included: false }),
    catalogRoom({ id: 'apt-3', name: '3-kamerappartement type I', included: false, bedrooms: '3 slaapkamers' }),
  ];
  const priced = renderToStaticMarkup(
    createElement(OfferDetailContent, {
      offer: makeOffer(),
      params: TWO_ADULTS,
      resultsHref: '/results',
      galleryImages: IMAGES,
      rooms,
      selectedRoom: rooms[1],
      sections: [],
      presentable: true,
      themes: [],
      isLastMinute: false,
    }),
  );

  assert.match(priced, /data-testid="detail-party-summary"[^>]*>2 volwassenen · Wijzigen/);
  assert.match(priced, /data-testid="detail-priced-room"[\s\S]*2-kamerappartement type I/);
  assert.match(priced, /28 m²/);
  assert.doesNotMatch(priced, /Kies je kamer/);
  assert.doesNotMatch(priced, /Pas je reis aan/);
  assert.doesNotMatch(priced, /3-kamer villa type A/);
  assert.doesNotMatch(priced, /3 slaapkamers/);
  assert.doesNotMatch(priced, /type="date"/);
  assert.match(priced, /data-testid="detail-total"[^>]*>[^<]*2\.215,50/);
  assert.doesNotMatch(priced, /data-testid="detail-room-price-note"/);
  const outbound = [...priced.matchAll(/<a href="([^"]+)" target="_blank"/g)].map((match) => match[1]);
  assert.deepEqual(outbound, ['https://www.sunweb.be/hotel', 'https://www.sunweb.be/hotel']);
  assert.doesNotMatch(outbound.join(' '), /room=|RoomType|unit=|1986-01-01/i);

  const withChild = renderToStaticMarkup(
    createElement(OfferDetailContent, {
      offer: makeOffer(),
      params: {
        adults: 2,
        children: 1,
        rooms: 1,
        childAges: [8],
        party: [
          { age: null, roomIndex: 0 },
          { age: null, roomIndex: 0 },
          { age: 8, roomIndex: 0 },
        ],
      },
      resultsHref: '/results',
      galleryImages: IMAGES,
      rooms,
      selectedRoom: rooms[0],
      sections: [],
      presentable: true,
      themes: [],
      isLastMinute: false,
    }),
  );
  assert.match(withChild, /data-testid="detail-party-summary"[^>]*>2 volwassenen, 1 kind · Wijzigen/);
});

test('parked room quotes do not replace the party total, and a missing total stays unlabeled', () => {
  const html = renderToStaticMarkup(
    createElement(OfferDetailContent, {
      offer: makeOffer(),
      params: TWO_ADULTS,
      resultsHref: '/results',
      galleryImages: IMAGES,
      rooms: [],
      selectedRoom: null,
      sections: [],
      presentable: true,
      themes: [],
      isLastMinute: false,
      roomQuotes: [
        { id: '2KA123', name: '2-kamerappartement type I', capacityText: 'geschikt voor 2 tot 3 personen', totalPrice: 1254.88 },
        { id: '3KA125', name: '3-kamerappartement type I', totalPrice: 1336.98 },
        { id: '3KVA25', name: '3-kamer villa type A' },
      ],
    }),
  );
  assert.match(html, /2 volwassenen · Wijzigen/);
  assert.doesNotMatch(html, /Kies je kamer/);
  assert.doesNotMatch(html, /1\.254,88/);
  assert.doesNotMatch(html, /RoomType/);
  assert.match(html, /data-testid="detail-total"[^>]*>[^<]*2\.215,50/);

  const failed = renderToStaticMarkup(
    createElement(OfferDetailContent, {
      offer: makeOffer({ liveTotalPrice: undefined, livePriceStatus: 'unavailable' }),
      params: { ...TWO_ADULTS, childAges: [8], children: 1 },
      resultsHref: '/results',
      galleryImages: IMAGES,
      rooms: [],
      selectedRoom: null,
      sections: [],
      presentable: false,
      themes: [],
      isLastMinute: false,
      compositionFailed: true,
    }),
  );
  assert.match(failed, /Prijs niet beschikbaar voor deze samenstelling/);
  assert.doesNotMatch(failed, /data-testid="detail-total"/);
  assert.match(
    readFileSync(join(ROOT, 'components/offers/offer-trip-adjust.tsx'), 'utf8'),
    /Prijs wordt opgehaald…/,
  );
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
