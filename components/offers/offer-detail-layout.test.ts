import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('gallery cannot expand the page width and covers photos', () => {
  const src = readFileSync(join(ROOT, 'components/offers/offer-image-gallery.tsx'), 'utf8');
  assert.match(src, /min-w-0 max-w-full/);
  assert.match(src, /overflow-x-auto/);
  assert.match(src, /shrink-0/);
  assert.match(src, /object-cover/);
  assert.match(src, /aspect-\[4\/3\]/);
  assert.match(src, /snap-start snap-always/);
});

test('detail layout columns shrink and the price card sticks on desktop', () => {
  const src = readFileSync(join(ROOT, 'components/offers/offer-detail-content.tsx'), 'utf8');
  assert.match(src, /mx-auto min-w-0 max-w-vw-page overflow-x-clip/);
  assert.match(src, /grid min-w-0/);
  assert.match(src, /min-\[901px\]:grid-cols-\[minmax\(0,1fr\)_380px\]/);
  assert.match(src, /<header className="min-w-0/);
  assert.match(src, /aside className="mt-28 min-w-0/);
  assert.match(src, /min-\[901px\]:sticky/);
});
