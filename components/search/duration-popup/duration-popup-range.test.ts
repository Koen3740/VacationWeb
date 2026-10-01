import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DURATION_MAX,
  DURATION_MIN,
  durationRangeFromSelection,
  durationSelectionFromRange,
  formatDurationRangeLabel,
  normalizeDurationRange,
  parseDurationsFromSearchParams,
} from './duration-popup-utils';
import { buildResultsHref } from '@/components/search/shared-search-state';
import { createDefaultTravelersState } from '@/components/search/travelers-popup/travelers-popup-utils';
import { parseSearchParams } from '@/lib/search/parse-search-params';

function hrefWithDurations(selectedDurations: number[]): string {
  return buildResultsHref({
    selectedCountries: [],
    departureStart: null,
    departureEnd: null,
    flexibilityDays: 0,
    selectedDurations,
    selectedDepartureAirports: [],
    travelers: createDefaultTravelersState(),
  });
}

test('duration range maps to the existing contiguous `nights` list', () => {
  const selection = durationSelectionFromRange({ min: 7, max: 10 });
  assert.deepEqual(selection, [7, 8, 9, 10]);
  const query = new URLSearchParams(hrefWithDurations(selection).split('?')[1]);
  assert.equal(query.get('nights'), '7,8,9,10');
  assert.equal(query.get('nightsMin'), null);
  assert.deepEqual(parseSearchParams(Object.fromEntries(query)).nights, [7, 8, 9, 10]);
});

test('single-day range and full range (= no duration filter)', () => {
  assert.deepEqual(durationSelectionFromRange({ min: 8, max: 8 }), [8]);
  assert.deepEqual(durationSelectionFromRange({ min: DURATION_MIN, max: DURATION_MAX }), []);
  const query = new URLSearchParams(hrefWithDurations([]).split('?')[1]);
  assert.equal(query.get('nights'), null);
});

test('existing URL values still parse: empty, contiguous and non-contiguous', () => {
  assert.deepEqual(durationRangeFromSelection([]), { min: DURATION_MIN, max: DURATION_MAX });
  assert.deepEqual(durationRangeFromSelection([8, 9, 10]), { min: 8, max: 10 });
  // legacy non-contiguous selection is displayed as its outer bounds
  const legacy = parseDurationsFromSearchParams(new URLSearchParams('nights=14,7'));
  assert.deepEqual(legacy, [7, 14]);
  assert.deepEqual(durationRangeFromSelection(legacy), { min: 7, max: 14 });
  // out-of-range values are clamped into 2..32
  assert.deepEqual(durationRangeFromSelection([1, 40]), { min: DURATION_MIN, max: DURATION_MAX });
});

test('min <= max is enforced; the moved handle wins', () => {
  assert.deepEqual(normalizeDurationRange(12, 10, 'min'), { min: 10, max: 10 });
  assert.deepEqual(normalizeDurationRange(12, 10, 'max'), { min: 12, max: 12 });
  assert.deepEqual(normalizeDurationRange(0, 99), { min: DURATION_MIN, max: DURATION_MAX });
});

test('range label uses one unit (dagen) and "Elke duur" for no filter', () => {
  assert.equal(formatDurationRangeLabel({ min: 7, max: 14 }), '7–14 dagen');
  assert.equal(formatDurationRangeLabel({ min: 8, max: 8 }), '8 dagen');
  assert.equal(formatDurationRangeLabel({ min: DURATION_MIN, max: DURATION_MAX }), 'Elke duur');
});
