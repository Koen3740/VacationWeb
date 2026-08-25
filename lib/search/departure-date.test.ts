import assert from 'node:assert/strict';
import test from 'node:test';
import {
  earliestSelectableDepartureIso,
  isSelectableDepartureIso,
  normalizeDepartureDateToIso,
  sanitizeDepartureSearchWindow,
} from './departure-date';

test('Corendon DD/MM/YYYY normalizes to ISO', () => {
  assert.equal(normalizeDepartureDateToIso('28/09/2026'), '2026-09-28');
  assert.equal(normalizeDepartureDateToIso('20/08/2026'), '2026-08-20');
});

test('ISO YYYY-MM-DD is unchanged', () => {
  assert.equal(normalizeDepartureDateToIso('2026-09-28'), '2026-09-28');
  assert.equal(normalizeDepartureDateToIso('2026-08-20'), '2026-08-20');
});

test('unknown or invalid formats are not invented', () => {
  assert.equal(normalizeDepartureDateToIso('28-09-2026'), null);
  assert.equal(normalizeDepartureDateToIso('09/28/2026'), null);
  assert.equal(normalizeDepartureDateToIso('20260928'), null);
  assert.equal(normalizeDepartureDateToIso('32/13/2026'), null);
  assert.equal(normalizeDepartureDateToIso('2026-13-01'), null);
  assert.equal(normalizeDepartureDateToIso(''), null);
  assert.equal(normalizeDepartureDateToIso(undefined), null);
});

test('A. today is not selectable; tomorrow is the earliest departure', () => {
  const today = new Date(2026, 7, 25); // 25 Aug 2026 local
  assert.equal(earliestSelectableDepartureIso(today), '2026-08-26');
  assert.equal(isSelectableDepartureIso('2026-08-24', today), false);
  assert.equal(isSelectableDepartureIso('2026-08-25', today), false);
  assert.equal(isSelectableDepartureIso('2026-08-26', today), true);
});

test('B. past-only search window is not a valid Results departure search', () => {
  const today = new Date(2026, 7, 25);
  const past = sanitizeDepartureSearchWindow('2026-08-15', '2026-08-24', today);
  assert.equal(past.valid, false);
  const todayOnly = sanitizeDepartureSearchWindow('2026-08-25', '2026-08-25', today);
  assert.equal(todayOnly.valid, false);
});

test('C. future window stays bookable; partial past is clamped to tomorrow', () => {
  const today = new Date(2026, 7, 25);
  const future = sanitizeDepartureSearchWindow('2026-09-01', '2026-09-08', today);
  assert.equal(future.valid, true);
  assert.equal(future.departureStart, '2026-09-01');
  assert.equal(future.departureEnd, '2026-09-08');

  const overlap = sanitizeDepartureSearchWindow('2026-08-20', '2026-08-30', today);
  assert.equal(overlap.valid, true);
  assert.equal(overlap.departureStart, '2026-08-26');
  assert.equal(overlap.departureEnd, '2026-08-30');
});
