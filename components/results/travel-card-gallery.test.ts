import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import React, { createElement } from 'react';
import { TravelCardGallery } from '@/components/results/travel-card-gallery';

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
  assert.match(html, /md:aspect-\[3\/2\]/);
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
  assert.doesNotMatch(html, />\d+\s*\/\s*\d+</);
});

test('gallery arrow clicks stop propagation and only change the photo', () => {
  assert.match(gallerySource, /event\.preventDefault\(\)/);
  assert.match(gallerySource, /event\.stopPropagation\(\)/);
  assert.match(gallerySource, /safeIndex > 0/);
  assert.match(gallerySource, /safeIndex < count - 1/);
  assert.match(gallerySource, /Math\.max\(0, prev - 1\)/);
  assert.match(gallerySource, /Math\.min\(count - 1, prev \+ 1\)/);
  assert.match(gallerySource, /onKeyDown/);
  assert.match(gallerySource, /Vorige foto/);
  assert.match(gallerySource, /Volgende foto/);
});

test('gallery keeps fixed 3:2 desktop container (no height shift by photo count)', () => {
  const one = renderToStaticMarkup(
    createElement(TravelCardGallery, {
      images: ['/images/results-card-placeholder.png'],
      alt: 'Hotel',
    }),
  );
  const five = renderToStaticMarkup(
    createElement(TravelCardGallery, {
      images: [
        '/images/results-card-placeholder.png',
        '/images/logo.png',
        '/images/results-preview-hero.png',
        '/images/logo.png',
        '/images/results-card-placeholder.png',
      ],
      alt: 'Hotel',
    }),
  );
  assert.match(one, /md:aspect-\[3\/2\]/);
  assert.match(five, /md:aspect-\[3\/2\]/);
  assert.match(one, /object-cover/);
  assert.match(five, /object-cover/);
  assert.match(five, /data-gallery-count="5"/);
});
