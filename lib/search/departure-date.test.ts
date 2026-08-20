import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDepartureDateToIso } from './departure-date';

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
