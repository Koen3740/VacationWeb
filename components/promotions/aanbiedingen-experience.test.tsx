import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { corendonHomepageActions } from '@/lib/tradetracker/promotions/corendon-homepage-actions';
import { AanbiedingenExperience } from './aanbiedingen-experience';

test('the two Corendon actions render their amounts, own images, and click hrefs', () => {
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, {
      showMarketTitles: false,
      sections: [{ market: 'nl', error: false, offers: corendonHomepageActions('nl') }],
    }),
  );
  assert.match(html, /Warme Winter Weken/);
  assert.match(html, /Last minutes/);
  assert.match(html, /€600/);
  assert.match(html, /€200/);
  assert.match(html, /src="\/aanbiedingen\/creative-images\/homepage\/warme-winter-weken-1168x500\.jpg"/);
  assert.match(html, /src="\/aanbiedingen\/creative-images\/homepage\/last-minutes-oktober-november-1168x500\.jpg"/);
  assert.match(html, /href="https:\/\/referral\.corendon\.nl\/c\?c=38108&amp;m=0&amp;a=512226&amp;r=&amp;u=https%3A%2F%2Fwww\.corendon\.nl%2Fwinterzon"/);
  assert.match(html, /href="https:\/\/referral\.corendon\.nl\/c\?c=38108&amp;m=0&amp;a=512226&amp;r=&amp;u=https%3A%2F%2Fwww\.corendon\.nl%2Ftopdeals"/);
  assert.equal((html.match(/\/c\?/g) ?? []).length, 2);
  assert.equal(html.includes('/i?'), false);
  assert.equal(html.includes('ti.tradetracker.net'), false);
  assert.equal(html.includes('<iframe'), false);
  assert.equal(html.includes('prefetch'), false);
  assert.equal(html.includes('2499691'), false);
  assert.equal(html.includes('Kaching'), false);
  assert.equal(html.includes('Er staat nu geen aanbieding'), false);
  assert.equal(html.includes('uit de bron'), false);
});

test('a tracking image is not rendered', () => {
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, {
      showMarketTitles: true,
      sections: [
        {
          market: 'be',
          error: false,
          offers: [
            {
              ...corendonHomepageActions('be')[0]!,
              imageUrl: 'https://referral.corendon.be/i?c=38103&m=1',
              clickUrl: 'https://referral.corendon.be/i?c=38103&m=1',
            },
          ],
        },
      ],
    }),
  );
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('/i?'), false);
  assert.equal(html.includes('/c?'), false);
  assert.match(html, /België/);
  assert.match(html, /€600/);
});
