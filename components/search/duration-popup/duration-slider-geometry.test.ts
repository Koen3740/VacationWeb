import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DURATION_HANDLE_GAP,
  DURATION_HANDLE_SIZE,
  DURATION_MAX,
  DURATION_MIN,
  durationHandleCenterX,
  durationSelectionFromRange,
  durationValueFromHandleX,
  pickDurationHandle,
} from './duration-popup-utils';

// Track widths of the 340px popup: desktop content width and a narrow phone.
const WIDTHS = [304, 280];

function handleGap(min: number, max: number, width: number): number {
  const minCenter = durationHandleCenterX('min', min, width);
  const maxCenter = durationHandleCenterX('max', max, width);
  return maxCenter - DURATION_HANDLE_SIZE / 2 - (minCenter + DURATION_HANDLE_SIZE / 2);
}

test('slider handles: 20px visible (small but clearly visible), positive gap', () => {
  assert.equal(DURATION_HANDLE_SIZE, 20);
  assert.ok(DURATION_HANDLE_GAP > 0);
});

test('7–8 handles sit side by side with a clear gap (~12.7px on the 304px desktop track)', () => {
  const gap = handleGap(7, 8, 304);
  assert.ok(gap > 12 && gap < 13.5, `gap ${gap}`);
});

test('slider handles never touch or overlap: 7–7, 7–8, 7–9, 8–9, 7–14, 2–32', () => {
  for (const width of WIDTHS) {
    for (const [min, max] of [[7, 7], [7, 8], [7, 9], [8, 9], [7, 14], [2, 32], [32, 32], [2, 2]]) {
      const gap = handleGap(min, max, width);
      assert.ok(gap >= DURATION_HANDLE_GAP, `${min}–${max} @${width}: gap ${gap}`);
    }
    // Adjacent values are visibly further apart than equal values.
    assert.ok(handleGap(7, 8, width) > handleGap(7, 7, width));
    assert.ok(handleGap(7, 9, width) > handleGap(7, 8, width));
  }
});

test('outer handles stay inside the track (min at 2, max at 32)', () => {
  for (const width of WIDTHS) {
    assert.ok(durationHandleCenterX('min', DURATION_MIN, width) - DURATION_HANDLE_SIZE / 2 >= 0);
    assert.ok(durationHandleCenterX('max', DURATION_MAX, width) + DURATION_HANDLE_SIZE / 2 <= width);
  }
});

test('handle position ↔ value round-trips for every value and both handles', () => {
  for (const width of WIDTHS) {
    for (let value = DURATION_MIN; value <= DURATION_MAX; value += 1) {
      for (const handle of ['min', 'max'] as const) {
        const x = durationHandleCenterX(handle, value, width);
        assert.equal(durationValueFromHandleX(handle, x, width), value, `${handle} ${value} @${width}`);
      }
    }
    // Beyond the ends clamps to 2..32.
    assert.equal(durationValueFromHandleX('min', -50, width), DURATION_MIN);
    assert.equal(durationValueFromHandleX('max', width + 50, width), DURATION_MAX);
  }
});

test('pointer picks the nearest handle; hit areas split at the midpoint', () => {
  const width = 304;
  const range = { min: 7, max: 8 };
  const minCenter = durationHandleCenterX('min', 7, width);
  const maxCenter = durationHandleCenterX('max', 8, width);
  const mid = (minCenter + maxCenter) / 2;
  assert.equal(pickDurationHandle(minCenter, range, width), 'min');
  assert.equal(pickDurationHandle(mid - 1, range, width), 'min');
  assert.equal(pickDurationHandle(mid + 1, range, width), 'max');
  assert.equal(pickDurationHandle(maxCenter, range, width), 'max');
  assert.equal(pickDurationHandle(0, range, width), 'min');
  assert.equal(pickDurationHandle(width, range, width), 'max');
  // Equal values: both handles still individually reachable.
  const equal = { min: 7, max: 7 };
  assert.equal(pickDurationHandle(durationHandleCenterX('min', 7, width), equal, width), 'min');
  assert.equal(pickDurationHandle(durationHandleCenterX('max', 7, width), equal, width), 'max');
});

test('full range 2–32 still means no duration filter', () => {
  assert.deepEqual(durationSelectionFromRange({ min: DURATION_MIN, max: DURATION_MAX }), []);
});
