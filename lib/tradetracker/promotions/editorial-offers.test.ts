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
  assert.equal(offers[0]?.publishedAt, null);
  assert.equal(offers[0]?.validFrom, null);
  assert.equal(offers[0]?.ingestedAt, null);
  assert.equal(offers[1]?.benefitAmount, '25 · ZOMER');
  assert.equal(offers.some((offer) => /winter|600|200/i.test(offer.title + offer.benefitAmount)), false);
  assert.equal(offers.some((offer) => REJECTED_GENERIC_LASTMINUTE_MATERIAL_IDS.some((id) => offer.id.includes(id))), false);
  assert.equal(offers[0]?.imageUrl.includes('120x600'), false);
  assert.equal(offers[0]?.clickUrl.includes('/i?'), false);
  assert.match(offers[0]?.clickUrl ?? '', /^https:\/\/referral\.corendon\.nl\/c\?/);
});

const AS_OF = Date.UTC(2026, 9, 5);

function streamCard(overrides: Partial<AanbiedingenCard> = {}): AanbiedingenCard {
  return {
    id: 'nl|512226|88',
    source: 'creative',
    market: 'nl',
    providerName: 'Corendon',
    title: 'Zomer',
    summary: null,
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
    imageUrl: null,
    imageWidth: null,
    imageHeight: null,
    imagePolicy: null,
    ingestedAt: '2026-09-02T00:00:00.000Z',
    ...overrides,
  };
}

test('F: an expired card stays off the page', () => {
  const offers = editorialOffersFromCards(
    [streamCard({ expirationDate: '2026-10-04', id: 'nl|512226|1' }), streamCard({ expirationDate: '2026-10-05', id: 'nl|512226|2', materialItemId: '2', clickUrl: 'https://referral.corendon.nl/c?c=38108&m=2&a=512226&r=&u=' })],
    AS_OF,
  );
  assert.deepEqual(
    offers.map((offer) => offer.id),
    ['nl|512226|2'],
  );
});

test('G: an allowed own-storage image is kept, including a wide 780×320 creative', () => {
  const wide = '/aanbiedingen/creative-images/nl/512226/38108/88-780x320-abcdef0123456789.png';
  const offers = editorialOffersFromCards([
    streamCard({
      imageUrl: wide,
      imageWidth: 780,
      imageHeight: 320,
      imagePolicy: 'own-storage',
    }),
  ]);
  assert.equal(offers[0]?.imageUrl, wide);
});

test('G: a hotlinked or external image is not kept', () => {
  const offers = editorialOffersFromCards([
    streamCard({ imageUrl: 'https://images.corendonresources.com/hpto.png', imagePolicy: null }),
  ]);
  assert.equal(offers[0]?.imageUrl, '');
});

test('I J K L: only a concrete benefit is shown', () => {
  const generic = ['Last Minute', 'Zonvakantie', 'Boek nu', 'Ontdek Corendon', 'gratis'].map((title, index) =>
    streamCard({
      id: `generic-${index}`,
      materialItemId: String(200 + index),
      title,
      benefitText: null,
      discountText: null,
      clickUrl: `https://referral.corendon.nl/c?c=38108&m=${200 + index}&a=512226&r=&u=`,
    }),
  );
  const shown = editorialOffersFromCards([
    ...generic,
    streamCard({ id: 'euro', materialItemId: '301', benefitText: '€75', discountText: '€75', clickUrl: 'https://referral.corendon.nl/c?c=38108&m=301&a=512226&r=&u=' }),
    streamCard({ id: 'percent', materialItemId: '302', benefitText: '15%', discountText: '15%', clickUrl: 'https://referral.corendon.nl/c?c=38108&m=302&a=512226&r=&u=' }),
    streamCard({
      id: 'child',
      materialItemId: '303',
      title: 'Gezinsvakantie',
      benefitText: '1 kind gratis',
      discountText: null,
      clickUrl: 'https://referral.corendon.nl/c?c=38108&m=303&a=512226&r=&u=',
    }),
  ]);
  assert.deepEqual(
    shown.map((offer) => offer.benefitAmount),
    ['€75', '15%', '1 kind gratis'],
  );
});

test('M: old Banner lastminute material ids never become offers', () => {
  const offers = editorialOffersFromCards(
    REJECTED_GENERIC_LASTMINUTE_MATERIAL_IDS.map((id) =>
      streamCard({
        id: `be|511873|${id}`,
        market: 'be',
        materialItemId: id,
        title: `Banner-${id}-lastminute`,
        benefitText: '€10',
        discountText: '€10',
        campaignId: '38103',
        affiliateSiteId: '511873',
        clickUrl: `https://referral.corendon.be/c?c=38103&m=${id}&a=511873&r=&u=`,
        campaignUrl: 'https://www.corendon.be/',
      }),
    ),
  );
  assert.equal(offers.length, 0);
});

test('N: Kaching is not an editorial offer', () => {
  const offers = editorialOffersFromCards([
    streamCard({
      id: 'kaching',
      providerName: 'Kaching' as AanbiedingenCard['providerName'],
      title: 'Kaching deal',
      benefitText: '€40',
    }),
  ]);
  assert.equal(offers.length, 0);
});
