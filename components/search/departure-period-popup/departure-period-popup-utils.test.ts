import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  FLEXIBILITY_DAY_VALUES,
  flexibilityForSelection,
  flexibilityWindow,
  isDeparturePeriod,
  normalizeFlexibilityDays,
  selectFixedDepartureDate,
  selectPeriodDepartureDate,
  type DepartureSelection,
} from './departure-period-popup-utils';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');

test('Vaste vertrekdatum: a second click only moves the date, never creates a period', () => {
  let selection: DepartureSelection = { start: null, end: null };
  selection = selectFixedDepartureDate('2026-11-15');
  assert.deepEqual(selection, { start: '2026-11-15', end: null });
  selection = selectFixedDepartureDate('2026-11-20');
  assert.deepEqual(selection, { start: '2026-11-20', end: null });
  assert.equal(isDeparturePeriod(selection.start, selection.end), false);
  selection = selectFixedDepartureDate('2026-11-10');
  assert.deepEqual(selection, { start: '2026-11-10', end: null });
});

test('Vertrekperiode: first click = start, later click = end, earlier/same click restarts', () => {
  let selection: DepartureSelection = { start: null, end: null };
  selection = selectPeriodDepartureDate(selection, '2026-11-10');
  assert.deepEqual(selection, { start: '2026-11-10', end: null });
  selection = selectPeriodDepartureDate(selection, '2026-11-20');
  assert.deepEqual(selection, { start: '2026-11-10', end: '2026-11-20' });
  assert.equal(isDeparturePeriod(selection.start, selection.end), true);
  // third click starts a new period
  selection = selectPeriodDepartureDate(selection, '2026-11-12');
  assert.deepEqual(selection, { start: '2026-11-12', end: null });
  // earlier click moves the start
  selection = selectPeriodDepartureDate(selection, '2026-11-05');
  assert.deepEqual(selection, { start: '2026-11-05', end: null });
  // same day keeps a single start (no zero-length period)
  selection = selectPeriodDepartureDate(selection, '2026-11-05');
  assert.deepEqual(selection, { start: '2026-11-05', end: null });
});

test('period never carries ± (flexibilityForSelection)', () => {
  assert.equal(flexibilityForSelection('2026-11-10', '2026-11-20', 2), 0);
  assert.equal(flexibilityForSelection('2026-11-10', '2026-11-20', 3), 0);
  assert.equal(flexibilityForSelection('2026-11-21', null, 2), 2);
  assert.equal(flexibilityForSelection('2026-11-21', '2026-11-21', 3), 3);
  assert.equal(flexibilityForSelection(null, null, 2), 0);
});

test('margins are exact, ± 1, ± 2, ± 3 only; anything else (incl. 7) falls back to exact', () => {
  assert.equal(normalizeFlexibilityDays(1), 1);
  assert.equal(normalizeFlexibilityDays(2), 2);
  assert.equal(normalizeFlexibilityDays(3), 3);
  assert.equal(normalizeFlexibilityDays(4), 0);
  assert.equal(normalizeFlexibilityDays(7), 0);
  assert.equal(normalizeFlexibilityDays('2'), 0);
  assert.deepEqual([...FLEXIBILITY_DAY_VALUES], [0, 1, 2, 3]);
});

test('flexibilityWindow: 21 nov ± 2 = 19..23, ± 3 = 18..24, crosses month edges', () => {
  assert.deepEqual(flexibilityWindow('2026-11-21', 2), { start: '2026-11-19', end: '2026-11-23' });
  assert.deepEqual(flexibilityWindow('2026-11-21', 3), { start: '2026-11-18', end: '2026-11-24' });
  assert.deepEqual(flexibilityWindow('2026-11-30', 3), { start: '2026-11-27', end: '2026-12-03' });
  assert.deepEqual(flexibilityWindow('2026-11-21', 0), { start: '2026-11-21', end: '2026-11-21' });
});

test('popup source: tabs Vaste vertrekdatum/Vertrekperiode, chips up to ± 3 (no ± 7), period emits 0, no instruction text', () => {
  const popup = readFileSync(
    join(ROOT, 'components/search/departure-period-popup/departure-period-popup.tsx'),
    'utf8',
  );
  assert.ok(popup.includes('Vaste vertrekdatum'));
  assert.ok(popup.includes('Vertrekperiode'));
  assert.ok(popup.includes("3: '± 3 dagen'"));
  assert.equal(popup.includes('Ik ben flexibel'), false);
  assert.equal(popup.includes('Voorbeeld'), false);
  assert.equal(popup.includes('± 7'), false, 'no ± 7 chip');
  assert.equal(popup.includes('Klik één vertrekdag'), false, 'no instruction hint');
  assert.equal(popup.includes('Bij een periode geen'), false, 'no period explanation box');
  assert.match(popup, /onChange\(start, end, 0\)/);
  assert.equal(popup.includes('w-[560px] overflow-hidden'), false, 'no fixed 560px panel on mobile');
});
