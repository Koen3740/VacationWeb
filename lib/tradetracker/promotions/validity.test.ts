import assert from 'node:assert/strict';
import test from 'node:test';
import { promotionalValidity, toCalendarDate, utcCalendarDate } from './validity';

const AS_OF = Date.UTC(2026, 8, 7, 12, 0, 0); // 2026-09-07 UTC

test('utcCalendarDate uses UTC date only', () => {
  assert.equal(utcCalendarDate(AS_OF), '2026-09-07');
});

test('toCalendarDate parses xsd:date and dateTime prefixes', () => {
  assert.equal(toCalendarDate('2026-09-01'), '2026-09-01');
  assert.equal(toCalendarDate('2026-09-01T00:00:00'), '2026-09-01');
  assert.equal(toCalendarDate(null), null);
  assert.equal(toCalendarDate(''), null);
  assert.equal(toCalendarDate('not-a-date'), null);
});

test('not-yet-published item is scheduled, not active', () => {
  const validity = promotionalValidity({
    startDate: '2026-09-10',
    endDate: '2026-09-20',
    asOfMs: AS_OF,
  });
  assert.equal(validity.status, 'scheduled');
  assert.equal(validity.isActive, false);
});

test('expired item is not active', () => {
  const validity = promotionalValidity({
    startDate: '2026-08-01',
    endDate: '2026-09-01',
    asOfMs: AS_OF,
  });
  assert.equal(validity.status, 'expired');
  assert.equal(validity.isActive, false);
});

test('item without expirationDate is not artificially expired', () => {
  const validity = promotionalValidity({
    startDate: '2026-08-01',
    endDate: null,
    asOfMs: AS_OF,
  });
  assert.equal(validity.status, 'active');
  assert.equal(validity.isActive, true);
  assert.equal(validity.endDate, null);
  assert.equal(validity.timezoneAssumption, 'utc-calendar-date');
});

test('expirationDate equal to as-of date remains active that calendar day', () => {
  const validity = promotionalValidity({
    startDate: '2026-09-01',
    endDate: '2026-09-07',
    asOfMs: AS_OF,
  });
  assert.equal(validity.status, 'active');
});

test('missing start/publish date is undated and not active', () => {
  const validity = promotionalValidity({
    startDate: null,
    endDate: '2026-12-01',
    asOfMs: AS_OF,
  });
  assert.equal(validity.status, 'undated');
  assert.equal(validity.isActive, false);
});
