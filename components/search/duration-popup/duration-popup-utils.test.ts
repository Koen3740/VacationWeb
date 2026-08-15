import assert from 'node:assert/strict';
import test from 'node:test';
import { toggleDuration, formatSelectedDurationsLabel } from './duration-popup-utils';

test('toggleDuration supports multi-select accumulation', () => {
  let selected: number[] = [];
  for (const days of [8, 9, 10, 11, 12]) {
    selected = toggleDuration(selected, days);
  }
  assert.deepEqual(selected, [8, 9, 10, 11, 12]);
  assert.equal(formatSelectedDurationsLabel(selected), '8–12 dagen');
});

test('toggleDuration can deselect without clearing others', () => {
  const selected = toggleDuration([8, 9, 10], 9);
  assert.deepEqual(selected, [8, 10]);
});
