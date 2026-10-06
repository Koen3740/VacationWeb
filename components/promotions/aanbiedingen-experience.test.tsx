import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { corendonHomepageActions } from '@/lib/tradetracker/promotions/corendon-homepage-actions';
import { AanbiedingenEmptyState, AanbiedingenExperience } from './aanbiedingen-experience';

// Fixture markup only. The live page does not load these homepage actions.

test('the two Corendon actions render their amounts and click hrefs without a Corendon image', () => {
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
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('corendonresources'), false);
  assert.equal(html.includes('780x320'), false);
  assert.match(html, /href="https:\/\/referral\.corendon\.nl\/c\?c=38108&amp;m=0&amp;a=512226&amp;r=&amp;u=https%3A%2F%2Fwww\.corendon\.nl%2Fwinterzon"/);
  assert.match(html, /href="https:\/\/referral\.corendon\.nl\/c\?c=38108&amp;m=0&amp;a=512226&amp;r=&amp;u=https%3A%2F%2Fwww\.corendon\.nl%2Ftopdeals"/);
  assert.equal((html.match(/\/c\?/g) ?? []).length, 2);
  assert.equal(html.includes('/i?'), false);
  assert.equal(html.includes('ti.tradetracker.net'), false);
  assert.equal(html.includes('<iframe'), false);
  assert.equal(html.includes('prefetch'), false);
  assert.equal(html.includes('2499691'), false);
  assert.equal(html.includes('Kaching'), false);
  assert.equal((html.match(/data-placement="offer"/g) ?? []).length, 2);
  assert.equal((html.match(/data-photo="none"/g) ?? []).length, 2);
  assert.equal(html.includes('data-placement="hero"'), false);
  assert.equal(html.includes('Tijd voor zon'), false);
  assert.equal(html.includes('6EBFEE'), false);
  assert.equal(html.includes('viewBox="0 0 800'), false);
  assert.equal(html.includes('Er staat nu geen aanbieding'), false);
  assert.equal(html.includes('uit de bron'), false);
});

function articleClasses(html: string): string[] {
  return [...html.matchAll(/<article[^>]*class="([^"]*)"/g)].map((match) => match[1] ?? '');
}

test('A: one offer is one normal card', () => {
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, {
      showMarketTitles: false,
      sections: [{ market: 'nl', error: false, offers: [corendonHomepageActions('nl')[0]!] }],
    }),
  );
  assert.equal((html.match(/data-placement="offer"/g) ?? []).length, 1);
  assert.equal(html.includes('flex flex-col'), true);
  assert.equal(html.includes('data-placement="hero"'), false);
  assert.equal(html.includes('data-photo="none"'), true);
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('min-h-[26rem]'), false);
  assert.equal(html.includes('lg:grid-cols-['), false);
  assert.equal(html.includes('Tijd voor zon'), false);
});

test('C: five offers are five equal wide cards', () => {
  const base = corendonHomepageActions('nl')[0]!;
  const offers = Array.from({ length: 5 }, (_, index) => ({
    ...base,
    id: `five-${index}`,
    title: `Aanbieding ${index}`,
  }));
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, {
      showMarketTitles: false,
      sections: [{ market: 'nl', error: false, offers }],
    }),
  );
  const classes = articleClasses(html);
  assert.equal(classes.length, 5);
  assert.equal(new Set(classes).size, 1);
  assert.match(classes[0] ?? '', /w-full/);
  assert.equal(html.includes('data-placement="hero"'), false);
});

test('B: two offers use the same card markup', () => {
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, {
      showMarketTitles: false,
      sections: [{ market: 'nl', error: false, offers: corendonHomepageActions('nl') }],
    }),
  );
  const classes = articleClasses(html);
  assert.equal(classes.length, 2);
  assert.equal(classes[0], classes[1]);
});

test('D: offers from several providers stay the same card', () => {
  const base = corendonHomepageActions('nl')[0]!;
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, {
      showMarketTitles: false,
      sections: [
        {
          market: 'nl',
          error: false,
          offers: [
            { ...base, id: 'fixture-corendon', providerName: 'Corendon', title: 'Fixture Corendon' },
            { ...base, id: 'fixture-sunweb', providerName: 'Sunweb', title: 'Fixture Sunweb', benefitAmount: '20%' },
            { ...base, id: 'fixture-eliza', providerName: 'Eliza was here', title: 'Fixture Eliza', benefitAmount: 'gratis' },
          ],
        },
      ],
    }),
  );
  const classes = articleClasses(html);
  assert.equal(classes.length, 3);
  assert.equal(new Set(classes).size, 1);
  assert.match(html, /Fixture Corendon/);
  assert.match(html, /Fixture Sunweb/);
  assert.match(html, /Fixture Eliza/);
  assert.equal(html.includes('corendonresources'), false);
  assert.equal(html.includes('data-placement="hero"'), false);
});

test('E: many offers stay equal cards', () => {
  const base = corendonHomepageActions('nl')[0]!;
  const offers = Array.from({ length: 10 }, (_, index) => ({
    ...base,
    id: `many-${index}`,
    title: `Aanbieding ${index}`,
    providerName: (index % 3 === 0 ? 'Corendon' : index % 3 === 1 ? 'Sunweb' : 'Eliza was here') as typeof base.providerName,
  }));
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, {
      showMarketTitles: false,
      sections: [{ market: 'nl', error: false, offers }],
    }),
  );
  const classes = articleClasses(html);
  assert.equal(classes.length, 10);
  assert.equal(new Set(classes).size, 1);
  assert.equal(html.includes('data-placement="hero"'), false);
});

test('G: an allowed campaign image is rendered inside the wide card', () => {
  const src = '/aanbiedingen/creative-images/nl/512226/38108/88-780x320-abcdef0123456789.png';
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, {
      showMarketTitles: false,
      sections: [
        {
          market: 'nl',
          error: false,
          offers: [{ ...corendonHomepageActions('nl')[0]!, imageUrl: src, imageAlt: 'Warme Winter Weken' }],
        },
      ],
    }),
  );
  assert.match(html, /data-photo="campaign"/);
  assert.match(html, new RegExp(`src="${src}"`));
  assert.match(html, /object-cover/);
  assert.equal(html.includes('corendonresources'), false);
  assert.equal(html.includes('/i?'), false);
});

test('H: no allowed image stays photo-less, without a drawn coast', () => {
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, {
      showMarketTitles: false,
      sections: [{ market: 'nl', error: false, offers: corendonHomepageActions('nl') }],
    }),
  );
  assert.equal((html.match(/data-photo="none"/g) ?? []).length, 2);
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('Tijd voor zon'), false);
  assert.equal(html.includes('#6EBFEE'), false);
  assert.equal(html.includes('6EBFEE'), false);
  assert.equal(html.includes('corendonresources'), false);
  assert.equal(html.includes('780x320'), false);
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

test('zero offers show the customer empty state and a home search link', () => {
  const html = renderToStaticMarkup(React.createElement(AanbiedingenEmptyState));
  assert.match(html, /Momenteel zijn er geen actuele aanbiedingen\./);
  assert.match(html, /href="\/"/);
  assert.match(html, /Zoek een vakantie/);
  assert.equal(html.includes('Kaching'), false);
  assert.equal(html.includes('€600'), false);
  assert.equal(html.includes('€200'), false);
  assert.equal(html.includes('/i?'), false);
  assert.equal(html.includes('/c?'), false);
  assert.equal(html.includes('beschikbaar'), false);
});
