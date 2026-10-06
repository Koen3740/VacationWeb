import assert from 'node:assert/strict';
import test from 'node:test';
import type { AanbiedingenCard } from './compose-aanbiedingen';
import { presentAanbiedingenOffers } from './present-aanbiedingen';

const AS_OF = Date.UTC(2026, 9, 5);
const OWN_IMAGE = '/aanbiedingen/creative-images/nl/512226/38108/88-300x250-abcdef0123456789.png';

function card(overrides: Partial<AanbiedingenCard> = {}): AanbiedingenCard {
  return {
    id: 'nl|512226|88',
    source: 'creative',
    market: 'nl',
    providerName: 'Corendon',
    title: 'Zomerdeal',
    summary: 'Tot €50 korting',
    benefitText: '€50',
    campaignId: '38108',
    campaignName: 'Corendon NL',
    materialItemId: '88',
    affiliateSiteId: '512226',
    dimensionsLabel: '300×250',
    isMobile: false,
    isCommon: true,
    discountText: '€50',
    conditions: null,
    publishDate: '2026-09-01',
    expirationDate: null,
    campaignUrl: 'https://www.corendon.nl/zomer',
    clickUrl: 'https://referral.corendon.nl/c?c=38108&m=88&a=512226&r=&u=',
    imageUrl: OWN_IMAGE,
    imageWidth: 300,
    imageHeight: 250,
    imagePolicy: 'own-storage',
    ingestedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}

test('7: no TradeTracker cards means no offers and no homepage fallback', () => {
  const offers = presentAanbiedingenOffers('nl', [], AS_OF);
  assert.deepEqual(offers, []);
  assert.equal(JSON.stringify(offers).includes('Warme Winter'), false);
  assert.equal(JSON.stringify(offers).includes('€600'), false);
});

test('a concrete creative is shown with its own image and clickout', () => {
  const offers = presentAanbiedingenOffers('nl', [card()], AS_OF);
  assert.equal(offers.length, 1);
  assert.equal(offers[0]?.benefitAmount, '€50');
  assert.equal(offers[0]?.imageUrl, OWN_IMAGE);
  assert.match(offers[0]?.clickUrl ?? '', /^https:\/\/referral\.corendon\.nl\/c\?/);
  assert.equal(offers[0]?.clickUrl.includes('/i?'), false);
});

test('18: a Belgian card is not shown on the Dutch page', () => {
  const offers = presentAanbiedingenOffers(
    'nl',
    [card({ id: 'be|511873|88', market: 'be', affiliateSiteId: '511873', campaignId: '38103' })],
    AS_OF,
  );
  assert.deepEqual(offers, []);
});

test('expired, generic, rejected and Kaching rows stay hidden', () => {
  const offers = presentAanbiedingenOffers(
    'nl',
    [
      card({ id: 'expired', materialItemId: '70', expirationDate: '2026-09-01', clickUrl: 'https://referral.corendon.nl/c?c=38108&m=70&a=512226&r=&u=' }),
      card({
        id: 'generic',
        materialItemId: '71',
        title: 'Last Minute',
        benefitText: null,
        discountText: null,
        clickUrl: 'https://referral.corendon.nl/c?c=38108&m=71&a=512226&r=&u=',
        imageUrl: null,
      }),
      card({
        id: 'rejected',
        materialItemId: '2499691',
        benefitText: '€10',
        clickUrl: 'https://referral.corendon.nl/c?c=38108&m=2499691&a=512226&r=&u=',
      }),
      card({
        id: 'kaching',
        providerName: 'Kaching' as AanbiedingenCard['providerName'],
        title: 'Kaching',
        benefitText: '€90',
      }),
    ],
    AS_OF,
  );
  assert.deepEqual(offers, []);
});
