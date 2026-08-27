import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import React, { createElement } from 'react';
import {
  nextGalleryIndex,
  previousGalleryIndex,
  TravelCardGallery,
} from '@/components/results/travel-card-gallery';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const gallerySource = readFileSync(join(ROOT, 'components/results/travel-card-gallery.tsx'), 'utf8');

test('gallery with one photo renders no navigation arrows', () => {
  const html = renderToStaticMarkup(
    createElement(TravelCardGallery, {
      images: ['/images/results-card-placeholder.png'],
      alt: 'Hotel',
    }),
  );
  assert.doesNotMatch(html, /Vorige foto|Volgende foto/);
});

test('gallery with multiple photos starts with only next arrow', () => {
  const html = renderToStaticMarkup(
    createElement(TravelCardGallery, {
      images: [
        '/images/results-card-placeholder.png',
        '/images/logo.png',
        '/images/results-preview-hero.png',
      ],
      alt: 'Hotel',
    }),
  );
  assert.match(html, /Volgende foto/);
  assert.doesNotMatch(html, /Vorige foto/);
  assert.match(html, /data-gallery-index="0"/);
  assert.match(html, /data-gallery-count="3"/);
});

test('click next once advances currentIndex from 0 to 1', () => {
  assert.equal(nextGalleryIndex(0, 2), 1);
  assert.equal(nextGalleryIndex(0, 5), 1);
  assert.equal(nextGalleryIndex(0, 10), 1);
  assert.equal(nextGalleryIndex(4, 5), 4);
  assert.equal(nextGalleryIndex(9, 10), 9);
});

test('click previous once retreats currentIndex', () => {
  assert.equal(previousGalleryIndex(1, 2), 0);
  assert.equal(previousGalleryIndex(0, 2), 0);
  assert.equal(previousGalleryIndex(4, 5), 3);
});

test('gallery index helpers cover 2, 5 and 10 photo ranges', () => {
  let index = 0;
  for (let step = 0; step < 9; step += 1) {
    index = nextGalleryIndex(index, 10);
  }
  assert.equal(index, 9);
  assert.equal(nextGalleryIndex(index, 10), 9);
  assert.equal(previousGalleryIndex(index, 10), 8);
});

test('gallery arrow clicks stop propagation and only change the photo', () => {
  assert.match(gallerySource, /event\.preventDefault\(\)/);
  assert.match(gallerySource, /event\.stopPropagation\(\)/);
  assert.match(gallerySource, /nextGalleryIndex/);
  assert.match(gallerySource, /previousGalleryIndex/);
  assert.match(gallerySource, /key=\{src\}/);
  assert.doesNotMatch(gallerySource, /fetch\(/);
  assert.doesNotMatch(gallerySource, /getStorageObject|axios|http\.get/);
});

test('fillCardHeight gallery stretches without aspect lock on desktop', () => {
  const html = renderToStaticMarkup(
    createElement(TravelCardGallery, {
      images: ['/images/results-card-placeholder.png', '/images/logo.png'],
      alt: 'Hotel',
      fillCardHeight: true,
    }),
  );
  assert.match(html, /md:absolute md:inset-0/);
  assert.match(html, /object-cover/);
  assert.doesNotMatch(html, /md:aspect-\[3\/2\]/);
});

test('gallery count is not artificially capped at 5 in the component', () => {
  const images = Array.from({ length: 10 }, (_, i) => `/images/results-card-placeholder.png?n=${i}`);
  const html = renderToStaticMarkup(
    createElement(TravelCardGallery, {
      images,
      alt: 'Hotel',
    }),
  );
  assert.match(html, /data-gallery-count="10"/);
});
