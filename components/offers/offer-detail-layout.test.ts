import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('gallery thumbnail row cannot expand the page width', () => {
  const src = readFileSync(join(ROOT, 'components/offers/offer-image-gallery.tsx'), 'utf8');
  assert.match(src, /min-w-0 max-w-full/);
  assert.match(src, /flex w-full min-w-0 max-w-full gap-2 overflow-x-auto/);
  assert.match(src, /shrink-0/);
});

test('detail layout columns shrink below content width', () => {
  const src = readFileSync(join(ROOT, 'components/offers/offer-detail-content.tsx'), 'utf8');
  assert.match(src, /mx-auto min-w-0 max-w-7xl overflow-x-clip/);
  assert.match(src, /grid min-w-0 gap-8 lg:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(18rem,0\.85fr\)\]/);
  assert.match(src, /<div className="min-w-0">/);
  assert.match(src, /aside className="min-w-0/);
});
