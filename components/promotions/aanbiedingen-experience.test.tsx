import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { EditorialOffer } from '@/lib/tradetracker/promotions/editorial-offers';
import { AanbiedingenExperience } from './aanbiedingen-experience';

function amountOffer(overrides: Partial<EditorialOffer> = {}): EditorialOffer {
  return {
    id: 'nl:88',
    market: 'nl',
    providerName: 'Corendon',
    placement: 'hero',
    title: 'Zomer',
    benefitLead: 'Voordeel',
    benefitAmount: '€50',
    benefitTail: '',
    summary: 'Uit de bron.',
    conditions: '',
    imageUrl: '/aanbiedingen/creative-images/nl/512226/38108/88-300x250-abcdef0123456789.png',
    imageAlt: 'Zomer',
    clickUrl: 'https://referral.corendon.nl/c?c=38108&m=88&a=512226&r=&u=',
    conditionsUrl: 'https://www.corendon.nl/',
    sources: [],
    ...overrides,
  };
}

test('an amount-backed offer renders its own image and a click href, never an impression', () => {
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, {
      showMarketTitles: false,
      sections: [{ market: 'nl', error: false, offers: [amountOffer()] }],
    }),
  );
  assert.match(html, /Zomer/);
  assert.match(html, /€50/);
  assert.match(html, /src="\/aanbiedingen\/creative-images\/nl\/512226\/38108\/88-300x250-abcdef0123456789\.png"/);
  assert.match(html, /href="https:\/\/referral\.corendon\.nl\/c\?c=38108&amp;m=88&amp;a=512226&amp;r=&amp;u="/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.equal((html.match(/\/c\?/g) ?? []).length, 1);
  assert.equal(html.includes('/i?'), false);
  assert.equal(html.includes('ti.tradetracker.net'), false);
  assert.equal(html.includes('<iframe'), false);
  assert.equal(html.includes('prefetch'), false);
  assert.equal(html.includes('2499691'), false);
  assert.equal(html.includes('Banner1-lastminute'), false);
  assert.equal(html.includes('€600'), false);
  assert.equal(html.includes('Warme Winter'), false);
});

test('an empty section is an honest empty state without offers or tracking', () => {
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, {
      showMarketTitles: false,
      sections: [{ market: 'be', error: false, offers: [] }],
    }),
  );
  assert.match(html, /Er staat nu geen aanbieding/);
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('/c?'), false);
  assert.equal(html.includes('/i?'), false);
  assert.equal(html.includes('€600'), false);
  assert.equal(html.includes('€200'), false);
});

test('a tracking image src is not rendered', () => {
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, {
      showMarketTitles: true,
      sections: [
        {
          market: 'be',
          error: false,
          offers: [
            amountOffer({
              market: 'be',
              imageUrl: 'https://referral.corendon.be/i?c=38103&m=1',
              clickUrl: 'https://referral.corendon.be/i?c=38103&m=1',
            }),
          ],
        },
      ],
    }),
  );
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('/i?'), false);
  assert.equal(html.includes('/c?'), false);
  assert.match(html, /België/);
});
