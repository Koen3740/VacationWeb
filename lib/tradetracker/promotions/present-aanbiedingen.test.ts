import assert from 'node:assert/strict';
import test from 'node:test';
import type { AanbiedingenCard } from './compose-aanbiedingen';
import { presentAanbiedingenOffers } from './present-aanbiedingen';

const AS_OF = Date.UTC(2026, 9, 5);
const WIDE = '/aanbiedingen/creative-images/nl/512226/38108/88-780x320-abcdef0123456789.png';

function card(overrides: Partial<AanbiedingenCard> = {}): AanbiedingenCard {
  return {
    id: 'nl|512226|88',
    source: 'creative',
    market: 'nl',
    providerName: 'Corendon',
    title: 'Winterbeeld',
    summary: null,
    benefitText: null,
    campaignId: '38108',
    campaignName: 'Corendon NL',
    materialItemId: '88',
    affiliateSiteId: '512226',
    dimensionsLabel: '780×320',
    isMobile: false,
    isCommon: true,
    discountText: null,
    conditions: null,
    publishDate: '2026-09-20',
    expirationDate: null,
    campaignUrl: 'https://www.corendon.nl/winterzon',
    clickUrl: `https://referral.corendon.nl/c?c=38108&m=88&a=512226&r=&u=${encodeURIComponent('https://www.corendon.nl/winterzon')}`,
    imageUrl: WIDE,
    imageWidth: 780,
    imageHeight: 320,
    imagePolicy: 'own-storage',
    ingestedAt: '2026-09-21T00:00:00.000Z',
    ...overrides,
  };
}

test('G: an allowed image for a homepage landing is used and the creative is not a second card', () => {
  const offers = presentAanbiedingenOffers('nl', [card({ benefitText: null, discountText: null })], AS_OF);
  assert.equal(offers.length, 2);
  assert.equal(offers.find((offer) => offer.title === 'Warme Winter Weken')?.imageUrl, WIDE);
  assert.equal(offers.find((offer) => offer.title === 'Last minutes')?.imageUrl, '');
  assert.equal(offers.some((offer) => offer.title === 'Winterbeeld'), false);
  assert.equal(offers.some((offer) => offer.imageUrl.includes('corendonresources')), false);
});

test('G: a benefit-bearing creative for the same landing does not duplicate the action', () => {
  const offers = presentAanbiedingenOffers(
    'nl',
    [card({ benefitText: '€600', discountText: '€600', title: 'Zelfde landing' })],
    AS_OF,
  );
  assert.equal(offers.filter((offer) => offer.clickUrl.includes('winterzon')).length, 1);
  assert.equal(offers.find((offer) => offer.id.includes('warme-winter-weken'))?.imageUrl, WIDE);
});

test('H: a CorendonResources or rejected last-minute file is not attached', () => {
  const offers = presentAanbiedingenOffers(
    'nl',
    [
      card({
        id: 'external',
        imageUrl: 'https://images.corendonresources.com/HPTO_WWW_NL_Toplaag_Header_780x320.png',
        imagePolicy: null,
      }),
      card({
        id: 'rejected',
        materialItemId: '2499691',
        title: 'Banner1-lastminute',
        benefitText: '€10',
        imageUrl: '/aanbiedingen/creative-images/nl/512226/38108/2499691-300x250-abcdef0123456789.png',
        clickUrl: `https://referral.corendon.nl/c?c=38108&m=2499691&a=512226&r=&u=${encodeURIComponent('https://www.corendon.nl/winterzon')}`,
      }),
    ],
    AS_OF,
  );
  assert.equal(offers.length, 2);
  assert.equal(offers.every((offer) => offer.imageUrl === ''), true);
  assert.equal(JSON.stringify(offers).includes('2499691'), false);
  assert.equal(JSON.stringify(offers).includes('corendonresources'), false);
});

test('E: a newer concrete offer sorts above the undated homepage actions', () => {
  const offers = presentAanbiedingenOffers(
    'nl',
    [
      card({
        id: 'nl|512226|501',
        materialItemId: '501',
        title: 'Nieuwere actie',
        benefitText: '20%',
        discountText: '20%',
        publishDate: '2026-10-01',
        campaignUrl: 'https://www.corendon.nl/nieuw',
        clickUrl: 'https://referral.corendon.nl/c?c=38108&m=501&a=512226&r=&u=',
        imageUrl: null,
      }),
    ],
    AS_OF,
  );
  assert.deepEqual(
    offers.map((offer) => offer.title),
    ['Nieuwere actie', 'Warme Winter Weken', 'Last minutes'],
  );
});

test('F I N: expired, generic, and Kaching rows stay out while the homepage actions remain', () => {
  const offers = presentAanbiedingenOffers(
    'nl',
    [
      card({
        id: 'expired',
        materialItemId: '70',
        title: 'Voorbij',
        benefitText: '€40',
        expirationDate: '2026-09-01',
        campaignUrl: 'https://www.corendon.nl/voorbij',
        clickUrl: 'https://referral.corendon.nl/c?c=38108&m=70&a=512226&r=&u=',
        imageUrl: null,
      }),
      card({
        id: 'generic',
        materialItemId: '71',
        title: 'Last Minute',
        benefitText: null,
        discountText: null,
        campaignUrl: 'https://www.corendon.nl/lastminute',
        clickUrl: 'https://referral.corendon.nl/c?c=38108&m=71&a=512226&r=&u=',
        imageUrl: null,
      }),
      card({
        id: 'kaching',
        providerName: 'Kaching' as AanbiedingenCard['providerName'],
        title: 'Kaching',
        benefitText: '€90',
        campaignUrl: 'https://kaching.example/deal',
        clickUrl: 'https://referral.corendon.nl/c?c=38108&m=88&a=512226&r=&u=',
        imageUrl: null,
      }),
    ],
    AS_OF,
  );
  assert.deepEqual(
    offers.map((offer) => offer.title),
    ['Warme Winter Weken', 'Last minutes'],
  );
  assert.equal(JSON.stringify(offers).includes('Kaching'), false);
});
