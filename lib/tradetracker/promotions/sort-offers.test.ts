import assert from 'node:assert/strict';
import test from 'node:test';
import { sortOffersNewestFirst } from './sort-offers';

function offer(id: string, listedAt: string | null, providerName = 'Corendon') {
  return { id, listedAt, providerName };
}

test('D: a newer offer is placed above an older one', () => {
  const sorted = sortOffersNewestFirst([
    offer('old', '2026-01-01', 'Sunweb'),
    offer('new', '2026-10-01', 'Corendon'),
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['new', 'old'],
  );
});

test('E: many offers follow the date only, with no provider priority', () => {
  const sorted = sortOffersNewestFirst([
    offer('c-old', '2026-01-01', 'Corendon'),
    offer('s-mid', '2026-06-01', 'Sunweb'),
    offer('e-new', '2026-09-01T12:00:00.000Z', 'Eliza was here'),
    offer('c-undated', null, 'Corendon'),
    offer('s-same', '2026-06-01', 'Sunweb'),
    offer('e-older', '2026-03-01', 'Eliza was here'),
    offer('c-newer', '2026-11-01', 'Corendon'),
    offer('s-undated', null, 'Sunweb'),
    offer('e-mid', '2026-06-01T00:00:00.000Z', 'Eliza was here'),
    offer('c-last', '2025-12-01', 'Corendon'),
  ]);
  assert.deepEqual(
    sorted.map((item) => item.id),
    ['c-newer', 'e-new', 's-same', 's-mid', 'e-mid', 'e-older', 'c-old', 'c-last', 's-undated', 'c-undated'],
  );
});
