import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AanbiedingenPromotionList } from './aanbiedingen-promotion-list';
import type { AanbiedingenCard } from '@/lib/tradetracker/promotions/compose-aanbiedingen';

function card(overrides: Partial<AanbiedingenCard> = {}): AanbiedingenCard {
  return {
    id: 'be|511873|2499691',
    source: 'creative',
    market: 'be',
    providerName: 'Corendon',
    title: 'Banner1-lastminute',
    summary: null,
    benefitText: 'lastminute',
    campaignId: '38103',
    campaignName: 'Corendon.be',
    materialItemId: '2499691',
    affiliateSiteId: '511873',
    dimensionsLabel: '120×600',
    isMobile: false,
    isCommon: true,
    discountText: null,
    conditions: null,
    publishDate: null,
    expirationDate: null,
    campaignUrl: 'https://www.corendon.be/',
    imageUrl: '/aanbiedingen/creative-images/be/511873/38103/2499691-120x600-abcdef0123456789.png',
    imageWidth: 120,
    imageHeight: 600,
    imagePolicy: 'own-storage',
    ...overrides,
  };
}

test('offer cards render the provider, source benefit and own image only', () => {
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenPromotionList, {
      cards: [
        card(),
        card({
          id: 'poison',
          materialItemId: '9',
          imageUrl: 'https://referral.corendon.be/i?c=38103&m=9',
          benefitText: 'lastminute',
          title: 'Banner9-lastminute',
        }),
      ],
      emptyMessage: 'Geen',
    }),
  );
  assert.match(html, /Corendon/);
  assert.match(html, /Banner1-lastminute/);
  assert.match(html, /Voordeel: lastminute/);
  assert.match(html, /Campagne Corendon\.be/);
  assert.match(html, /Markt België/);
  assert.match(html, /src="\/aanbiedingen\/creative-images\/be\/511873\/38103\/2499691-120x600-abcdef0123456789\.png"/);
  assert.equal(html.includes('referral.corendon'), false);
  assert.equal(html.includes('ti.tradetracker.net'), false);
  assert.equal(html.includes('/i?'), false);
  assert.equal(html.includes('/c?'), false);
  assert.equal(html.includes('€'), false);
  assert.equal(html.includes('tot €'), false);
});
