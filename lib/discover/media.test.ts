import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { DISCOVER_FALLBACK_IMAGE } from './constants';
import { resolveDiscoverImageSrc } from './media';

test('fallback mood asset exists in the public folder', () => {
  const absolute = path.join(process.cwd(), 'public', DISCOVER_FALLBACK_IMAGE.replace(/^\//, ''));
  assert.equal(fs.existsSync(absolute), true);
});

test('resolveDiscoverImageSrc keeps a path when the file exists', () => {
  const src = '/images/wow-ssot/discover-albania.jpg';
  assert.equal(resolveDiscoverImageSrc(src, () => true), src);
});

test('resolveDiscoverImageSrc uses generic mood fallback when the file is missing', () => {
  assert.equal(
    resolveDiscoverImageSrc('/images/wow-ssot/discover-albania.jpg', () => false),
    DISCOVER_FALLBACK_IMAGE,
  );
});

test('resolveDiscoverImageSrc rejects unsafe paths instead of serving them', () => {
  assert.equal(resolveDiscoverImageSrc('../secret.jpg', () => true), DISCOVER_FALLBACK_IMAGE);
  assert.equal(resolveDiscoverImageSrc('//cdn.example/x.jpg', () => true), DISCOVER_FALLBACK_IMAGE);
  assert.equal(resolveDiscoverImageSrc('', () => true), DISCOVER_FALLBACK_IMAGE);
});

test('generic mood fallback resolves to itself from public/', () => {
  assert.equal(resolveDiscoverImageSrc(DISCOVER_FALLBACK_IMAGE), DISCOVER_FALLBACK_IMAGE);
});
