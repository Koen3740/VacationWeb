import assert from 'node:assert/strict';
import test from 'node:test';
import { PROVIDERS } from '../feeds/providers';
import { ELIZA_PROVIDER_NAME } from '../providers/eliza/constants';
import { isValidOfferImageUrl } from './is-valid-offer-image-url';
import { collectOrderedOfferImages, splitFeedImageUrls } from './offer-images';

test('splitFeedImageUrls: comma-joined TradeTracker imageURL_large becomes individual URLs', () => {
  const a1 = 'https://images.corendonresources.com/L1E11721A1W1600H1066.jpg?v=260213125039';
  const a2 = 'https://images.corendonresources.com/L1E11721A2W1600H1066.jpg?v=260213124818';
  assert.deepEqual(splitFeedImageUrls(`${a1},${a2}`), [a1, a2]);
});

test('splitFeedImageUrls: single URL and real ampersand query stay intact', () => {
  const url = 'https://static.sunweb.be/products/Images/Original/34600000/47000/34647020-Original.jpg?width=640&height=640&mode=crop';
  assert.deepEqual(splitFeedImageUrls(url), [url]);
});

test('concatenated image blobs are not valid next/image srcs', () => {
  const blob =
    'https://images.corendonresources.com/L1E11721A1W1600H1066.jpg?v=1,https://images.corendonresources.com/L1E11721A2W1600H1066.jpg?v=2';
  assert.equal(isValidOfferImageUrl(blob), false);
  assert.equal(isValidOfferImageUrl('https://images.corendonresources.com/L1E11721A1W1600H1066.jpg?v=1'), true);
});

test('hero prefers imageURL_large / imageLarge over tagged gallery thumbnail', () => {
  const a1 = 'https://images.corendonresources.com/L1E2208A1W1600H1066.jpg?v=220520195208';
  const a2Thumb = 'https://images.corendonresources.com/L1E2208A2W0H0.jpg?v=220520195208';
  const a2Large = 'https://images.corendonresources.com/L1E2208A2W1600H1066.jpg?v=220520195208';
  const ordered = collectOrderedOfferImages({
    provider: PROVIDERS.corendon.name,
    imageUrl: a2Thumb,
    imageLarge: `${a1},${a2Large}`,
    images: [a2Thumb, a2Large],
  });
  assert.equal(ordered[0], a1);
  // Same Corendon shot A2: keep the largest WxH URL only (not thumb + large).
  assert.equal(ordered.filter((url) => /L1E2208A2/i.test(url)).length, 1);
  assert.equal(ordered.includes(a2Large), true);
  assert.equal(ordered.includes(a2Thumb), false);
});

test('Sunweb-style galleries without a distinct imageLarge keep feed order', () => {
  const first = 'https://static.sunweb.be/products/Images/Original/1.jpg';
  const second = 'https://static.sunweb.be/products/Images/Original/2.jpg';
  const ordered = collectOrderedOfferImages({
    provider: PROVIDERS.sunweb.name,
    imageUrl: first,
    imageLarge: first,
    images: [first, second],
  });
  assert.deepEqual(ordered, [first, second]);
});

test('zero-dimension Corendon thumbnail is not hero when a sized gallery URL exists', () => {
  const thumb = 'https://images.corendonresources.com/L1E8658A2W0H0.jpg?v=1';
  const a1Small = 'https://images.corendonresources.com/L1E8658A1W1024H684.jpg?v=1';
  const ordered = collectOrderedOfferImages({
    provider: PROVIDERS.corendon.name,
    imageUrl: thumb,
    images: [thumb, a1Small],
  });
  assert.equal(ordered[0], a1Small);
  assert.ok(ordered.includes(thumb));
});

test('Corendon size variants of the same shot collapse to one gallery URL', () => {
  const a1Large = 'https://images.corendonresources.com/L1E11446A1W1600H1066.jpg?v=1';
  const a1Medium = 'https://images.corendonresources.com/L1E11446A1W1024H684.jpg?v=1';
  const a2 = 'https://images.corendonresources.com/L1E11446A2W1600H1066.jpg?v=2';
  const a3 = 'https://images.corendonresources.com/L1E11446A3W1600H1066.jpg?v=3';
  const ordered = collectOrderedOfferImages({
    provider: PROVIDERS.corendon.name,
    imageLarge: a1Large,
    images: [a1Large, a1Medium, a2, a3],
  });
  assert.deepEqual(ordered, [a1Large, a2, a3]);
  assert.equal(ordered[0], a1Large);
  assert.equal(ordered[1], a2);
});

const EKIES_XML = [
  'https://static.elizawashere.be/products/Images/Original/51100000/42000/51142586-Original.jpg?width=640&height=640&mode=crop',
  'https://static.elizawashere.be/products/Images/Original/46100000/21000/46121218-Original.jpg?width=640&height=640&mode=crop',
  'https://static.elizawashere.be/products/Images/Original/46100000/21000/46121244-Original.jpg?width=640&height=640&mode=crop',
  'https://static.elizawashere.be/products/Images/Original/46100000/21000/46121219-Original.jpg?width=640&height=640&mode=crop',
  'https://static.elizawashere.be/products/Images/Original/51100000/42000/51142588-Original.jpg?width=640&height=640&mode=crop',
  'https://static.elizawashere.be/products/Images/Original/51100000/42000/51142587-Original.jpg?width=640&height=640&mode=crop',
] as const;

function assertSameUrls(actual: string[], expected: readonly string[]): void {
  assert.equal(actual.length, expected.length);
  assert.deepEqual([...actual].sort(), [...expected].sort());
}

test('Eliza with 6 XML images uses images[3] as hero and keeps the rest', () => {
  const images = [
    'https://static.elizawashere.be/products/Images/Original/1.jpg',
    'https://static.elizawashere.be/products/Images/Original/2.jpg',
    'https://static.elizawashere.be/products/Images/Original/3.jpg',
    'https://static.elizawashere.be/products/Images/Original/4.jpg',
    'https://static.elizawashere.be/products/Images/Original/5.jpg',
    'https://static.elizawashere.be/products/Images/Original/6.jpg',
  ];
  const ordered = collectOrderedOfferImages({
    provider: ELIZA_PROVIDER_NAME,
    imageUrl: images[0],
    imageLarge: images[0],
    imageSmall: images[1],
    images,
  });
  assert.equal(ordered[0], images[3]);
  assert.deepEqual(ordered.slice(1), [images[0], images[1], images[2], images[4], images[5]]);
  assertSameUrls(ordered, images);
});

test('Eliza with 5 XML images uses images[3] as hero', () => {
  const images = [
    'https://static.elizawashere.be/products/Images/Original/51100000/0/51100445-Original.jpg',
    'https://static.elizawashere.be/products/Images/Original/51100000/0/51100441-Original.jpg',
    'https://static.elizawashere.be/products/Images/Original/51100000/0/51100443-Original.jpg',
    'https://static.elizawashere.be/products/Images/Original/51100000/0/51100442-Original.jpg',
    'https://static.elizawashere.be/products/Images/Original/51100000/0/51100444-Original.jpg',
  ];
  const ordered = collectOrderedOfferImages({
    provider: ELIZA_PROVIDER_NAME,
    imageUrl: images[0],
    imageLarge: images[0],
    images,
  });
  assert.equal(ordered[0], images[3]);
  assert.deepEqual(ordered, [images[3], images[0], images[1], images[2], images[4]]);
  assertSameUrls(ordered, images);
});

test('Eliza with fewer than 5 images keeps the existing first image', () => {
  const images = [
    'https://static.elizawashere.be/products/Images/Original/a.jpg',
    'https://static.elizawashere.be/products/Images/Original/b.jpg',
    'https://static.elizawashere.be/products/Images/Original/c.jpg',
    'https://static.elizawashere.be/products/Images/Original/d.jpg',
  ];
  const ordered = collectOrderedOfferImages({
    provider: ELIZA_PROVIDER_NAME,
    imageUrl: images[0],
    imageLarge: images[0],
    images,
  });
  assert.deepEqual(ordered, images);
  assert.equal(ordered[0], images[0]);
});

test('Eliza remaining gallery stays XML order even when imageSmall is XML[1]', () => {
  const images = [
    'https://static.elizawashere.be/products/Images/Original/1.jpg',
    'https://static.elizawashere.be/products/Images/Original/2.jpg',
    'https://static.elizawashere.be/products/Images/Original/3.jpg',
    'https://static.elizawashere.be/products/Images/Original/4.jpg',
    'https://static.elizawashere.be/products/Images/Original/5.jpg',
    'https://static.elizawashere.be/products/Images/Original/6.jpg',
  ];
  const ordered = collectOrderedOfferImages({
    provider: ELIZA_PROVIDER_NAME,
    imageUrl: images[3],
    imageSmall: images[1],
    images,
  });
  assert.deepEqual(ordered, [images[3], images[0], images[1], images[2], images[4], images[5]]);
  assertSameUrls(ordered, images);
});

test('Eliza Ekies 133863 hero is pool 46121219, not bedroom 51142586', () => {
  const ordered = collectOrderedOfferImages({
    provider: ELIZA_PROVIDER_NAME,
    imageUrl: EKIES_XML[0],
    imageLarge: EKIES_XML[0],
    imageSmall: EKIES_XML[1],
    images: [...EKIES_XML],
  });
  assert.equal(ordered[0], EKIES_XML[3]);
  assert.match(ordered[0], /46121219-Original/);
  assert.equal(ordered.includes(EKIES_XML[0]), true);
  assert.doesNotMatch(ordered[0], /51142586-Original/);
  assertSameUrls(ordered, EKIES_XML);
});

test('Sunweb with 6 XML images keeps images[0] as hero', () => {
  const images = [
    'https://static.sunweb.be/products/Images/Original/34600000/47000/34647020-Original.jpg?width=640&height=640&mode=crop',
    'https://static.sunweb.be/products/Images/Original/34600000/46000/34646518-Original.jpg?width=640&height=640&mode=crop',
    'https://static.sunweb.be/products/Images/Original/31900000/4000/31904752-Original.jpg?width=640&height=640&mode=crop',
    'https://static.sunweb.be/products/Images/Original/31900000/4000/31904751-Original.jpg?width=640&height=640&mode=crop',
    'https://static.sunweb.be/products/Images/Original/34600000/47000/34647025-Original.jpg?width=640&height=640&mode=crop',
    'https://static.sunweb.be/products/Images/Original/34600000/47000/34647026-Original.jpg?width=640&height=640&mode=crop',
  ];
  const ordered = collectOrderedOfferImages({
    provider: PROVIDERS.sunweb.name,
    imageUrl: images[0],
    imageLarge: images[0],
    imageSmall: images[1],
    images,
  });
  assert.equal(ordered[0], images[0]);
  assert.deepEqual(ordered, images);
});

test('Corendon imageURL_large hero is unchanged by the Eliza XML[3] rule', () => {
  const a1 = 'https://images.corendonresources.com/L1E2208A1W1600H1066.jpg?v=1';
  const extra = [
    'https://images.corendonresources.com/L1E2208A2W1600H1066.jpg?v=1',
    'https://images.corendonresources.com/L1E2208A3W1600H1066.jpg?v=1',
    'https://images.corendonresources.com/L1E2208A4W1600H1066.jpg?v=1',
    'https://images.corendonresources.com/L1E2208A5W1600H1066.jpg?v=1',
    'https://images.corendonresources.com/L1E2208A6W1600H1066.jpg?v=1',
  ];
  const ordered = collectOrderedOfferImages({
    provider: PROVIDERS.corendon.name,
    imageUrl: extra[0],
    imageLarge: a1,
    images: extra,
  });
  assert.equal(ordered[0], a1);
  assert.notEqual(ordered[0], extra[3]);
  assert.ok(ordered.includes(extra[3]));
});
