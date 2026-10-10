import assert from 'node:assert/strict';
import test from 'node:test';
import { getDepartureDisplay } from '@/components/search/departure-display';
import { buildResultsTripSummary } from '@/lib/search/results-trip-summary';

test('trip summary is period, duration and travellers — not the destination', () => {
  const departure = getDepartureDisplay({
    departureStart: '2026-10-10',
    departureEnd: '2026-10-24',
  }).summarySegment;
  assert.ok(departure);

  const summary = buildResultsTripSummary({
    countries: ['Spanje'],
    country: 'Spanje',
    region: 'Costa Brava',
    departureStart: '2026-10-10',
    departureEnd: '2026-10-24',
    nights: [8],
    adults: 2,
    children: 0,
    babies: 0,
    rooms: 1,
  });

  assert.equal(summary, `${departure} · 8 dagen · 2 volwassenen`);
  assert.doesNotMatch(summary, /Spanje|Costa Brava/);
});

test('trip summary keeps an exact date with flexibility and a child', () => {
  const departure = getDepartureDisplay({
    departureStart: '2026-10-10',
    departureEnd: null,
    flexibilityDays: 2,
  }).summarySegment;

  const summary = buildResultsTripSummary({
    departureStart: '2026-10-10',
    flexibilityDays: 2,
    nightsMin: 7,
    nightsMax: 7,
    adults: 2,
    children: 1,
    babies: 0,
    rooms: 1,
  });

  assert.equal(summary, `${departure} · 7 dagen · 2 volwassenen · 1 kind`);
});
