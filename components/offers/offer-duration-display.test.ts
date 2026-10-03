import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OfferDetailContent } from '@/components/offers/offer-detail-content';
import { TravelCard } from '@/components/results/travel-card';
import type { TravelOffer } from '@/types/travel';

// OfferDetailContent uses the classic JSX runtime (no React import).
(globalThis as { React?: unknown }).React = React;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'sunweb-1',
    provider: 'Sunweb',
    hotelName: 'Hotel Test',
    destinationCountry: 'Spanje',
    departureDate: '2026-10-10',
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

/** Presentable live price per provider route (Corendon upsales, Sunweb/Eliza getPromotedPrice). */
function offerFor(provider: string, overrides: Partial<TravelOffer> = {}): TravelOffer {
  const promoted = provider !== 'Corendon';
  return makeOffer({
    provider,
    ...(promoted
      ? { livePriceSource: 'getPromotedPrice', liveTotalPriceField: 'getPromotedPrice.totalPrice' }
      : {}),
    ...overrides,
  });
}

function cardHtml(offer: TravelOffer): string {
  return renderToStaticMarkup(createElement(TravelCard, { offer, searchParams: { adults: 2 } }));
}

function detailHtml(offer: TravelOffer): string {
  return renderToStaticMarkup(
    createElement(OfferDetailContent, {
      offer,
      params: { adults: 2 },
      resultsHref: '/results',
      galleryImages: [],
      rooms: [],
      selectedRoom: null,
      sections: [],
      presentable: false,
      themes: [],
      isLastMinute: false,
    }),
  );
}

test('UI duration: 8-day offers show "8 dagen" and end on departure + 7 on the result card', () => {
  for (const provider of ['Sunweb', 'Eliza was here', 'Corendon']) {
    const html = cardHtml(offerFor(provider));
    assert.match(html, /8 dagen/, provider);
    assert.doesNotMatch(html, /8 nachten/, provider);
    assert.match(html, /10\/10\/2026 \S 17\/10\/2026/, provider);
  }
});

test('UI duration: detail page shows "8 dagen", never "8 nachten", for days offers', () => {
  for (const [provider, durationType] of [
    ['Sunweb', 'dagen'],
    ['Eliza was here', undefined],
    ['Corendon', 'dagen'],
  ] as const) {
    const html = detailHtml(makeOffer({ provider, durationType }));
    assert.match(html, /8 dagen/, provider);
    assert.doesNotMatch(html, /8 nachten/, provider);
  }
  assert.match(detailHtml(makeOffer({ provider: 'Other', nights: 7, durationType: 'nachten' })), /7 nachten/);
});

test('UI duration: static results preview does not hardcode "nachten" for catalog days', () => {
  const src = readFileSync(join(ROOT, 'components/results-v2/results-preview-static.tsx'), 'utf8');
  assert.doesNotMatch(src, /\$\{card\.nights\} nachten/);
  assert.match(src, /formatNightsLabel\(card\.nights, 'dagen'\)/);
  const detail = readFileSync(join(ROOT, 'components/offers/offer-detail-content.tsx'), 'utf8');
  assert.doesNotMatch(detail, /\{offer\.nights\} nachten/);
});
