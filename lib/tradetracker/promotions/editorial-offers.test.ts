import assert from 'node:assert/strict';
import test from 'node:test';
import type { AanbiedingenCard } from './compose-aanbiedingen';
import { REJECTED_GENERIC_LASTMINUTE_MATERIAL_IDS } from './displayable-offer';
import { editorialOffersFromCards } from './editorial-offers';

test('rejected lastminute materials and bare banners never become editorial offers', () => {
  const banner: AanbiedingenCard = {
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
    clickUrl: 'https://referral.corendon.be/c?c=38103&m=2499691&a=511873&r=&u=',
    imageUrl: '/aanbiedingen/creative-images/be/511873/38103/2499691-120x600-abcdef0123456789.png',
    imageWidth: 120,
    imageHeight: 600,
    imagePolicy: 'own-storage',
  };
  const namedWithoutAmount: AanbiedingenCard = {
    ...banner,
    id: 'nl|512226|77',
    market: 'nl',
    materialItemId: '77',
    title: 'Warme Winter Weken',
    benefitText: null,
    discountText: null,
    clickUrl: 'https://referral.corendon.nl/c?c=38108&m=77&a=512226&r=&u=',
    campaignId: '38108',
    affiliateSiteId: '512226',
    imageUrl: null,
    imageWidth: null,
    imageHeight: null,
    imagePolicy: null,
  };
  const amount = {
    ...banner,
    id: 'nl|512226|88',
    materialItemId: '88',
    title: 'Zomer',
    benefitText: '€50',
    discountText: '€50',
    imageUrl: '/aanbiedingen/creative-images/nl/512226/38108/88-300x250-abcdef0123456789.png',
    imageWidth: 300,
    imageHeight: 250,
    clickUrl: 'https://referral.corendon.nl/c?c=38108&m=88&a=512226&r=&u=',
    campaignId: '38108',
    affiliateSiteId: '512226',
    market: 'nl' as const,
  };
  const structured: AanbiedingenCard = {
    ...amount,
    id: 'nl|512226|90',
    materialItemId: '90',
    title: 'Vroege boeking',
    benefitText: '25 · ZOMER',
    discountText: '25 · ZOMER',
    clickUrl: 'https://referral.corendon.nl/c?c=38108&m=90&a=512226&r=&u=',
  };
  const winterClaim: AanbiedingenCard = {
    ...namedWithoutAmount,
    id: 'nl|512226|91',
    materialItemId: '91',
    benefitText: 'Warme Winter Weken',
    discountText: null,
  };
  const offers = editorialOffersFromCards([banner, namedWithoutAmount, winterClaim, amount, structured]);
  assert.equal(offers.length, 2);
  assert.equal(offers[0]?.benefitAmount, '€50');
  assert.equal(offers[0]?.placement, 'hero');
  assert.equal(offers[1]?.benefitAmount, '25 · ZOMER');
  assert.equal(offers[1]?.placement, 'supporting');
  assert.equal(offers.some((offer) => /winter|600|200/i.test(offer.title + offer.benefitAmount)), false);
  assert.equal(offers.some((offer) => REJECTED_GENERIC_LASTMINUTE_MATERIAL_IDS.some((id) => offer.id.includes(id))), false);
  assert.equal(offers[0]?.imageUrl.includes('120x600'), false);
  assert.equal(offers[0]?.clickUrl.includes('/i?'), false);
  assert.match(offers[0]?.clickUrl ?? '', /^https:\/\/referral\.corendon\.nl\/c\?/);
});
