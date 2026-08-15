import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SEARCH_PROGRESS_DELAY_MS,
  SEARCH_PROGRESS_MESSAGE,
} from './search-progress-feedback';

test('SEARCH_PROGRESS_MESSAGE is the shared neutral wait-state copy', () => {
  assert.equal(
    SEARCH_PROGRESS_MESSAGE,
    'Een momentje — we zoeken de beste vakantie voor jou.',
  );
});

test('SEARCH_PROGRESS_DELAY_MS is 2000 for Results filter/sort/param overlays', () => {
  assert.equal(SEARCH_PROGRESS_DELAY_MS, 2000);
});
