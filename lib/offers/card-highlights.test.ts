import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CARD_HIGHLIGHT_SLOTS,
  layoutCardHighlightSlots,
} from '@/lib/offers/card-highlights';

test('layoutCardHighlightSlots always returns 6 slots for 1–6 labels', () => {
  assert.equal(layoutCardHighlightSlots(['WiFi']).length, CARD_HIGHLIGHT_SLOTS);
  assert.equal(layoutCardHighlightSlots(['A', 'B', 'C']).length, CARD_HIGHLIGHT_SLOTS);
  assert.equal(
    layoutCardHighlightSlots([
      'Zwembad buiten',
      'Airco',
      'WiFi',
      'Huurauto inclusief',
      'Spa',
      'Nabij strand',
    ]).length,
    CARD_HIGHLIGHT_SLOTS,
  );
});

test('layoutCardHighlightSlots places two longest labels in column 0', () => {
  const slots = layoutCardHighlightSlots([
    'Airco',
    'WiFi',
    'Spa',
    'Zwembad buiten',
    'Huurauto inclusief',
    'Nabij strand',
  ]);
  assert.equal(slots[0], 'Huurauto inclusief');
  assert.equal(slots[3], 'Zwembad buiten');
  assert.ok(slots.filter(Boolean).length === 6);
});

test('layoutCardHighlightSlots keeps full labels intact (no split words)', () => {
  const slots = layoutCardHighlightSlots(['Zwembad buiten', 'Huurauto inclusief', 'Airco']);
  assert.ok(slots.includes('Zwembad buiten'));
  assert.ok(slots.includes('Huurauto inclusief'));
  assert.equal(
    slots.filter((label) => label === 'Zwembad' || label === 'buiten').length,
    0,
  );
});

test('layoutCardHighlightSlots uses fixed 3×2 slot indices (row-major)', () => {
  const slots = layoutCardHighlightSlots(['Huurauto inclusief', 'WiFi', 'Airco']);
  assert.equal(slots.length, 6);
  assert.equal(slots[0], 'Huurauto inclusief');
  assert.ok(slots[1] === 'WiFi' || slots[1] === 'Airco');
  assert.ok(slots[2] === 'WiFi' || slots[2] === 'Airco' || slots[2] === null);
  assert.equal(slots.filter(Boolean).length, 3);
});
