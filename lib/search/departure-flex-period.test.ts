import assert from 'node:assert/strict';
import test from 'node:test';
import { filterOffers } from './filtering';
import { parseSearchParams } from './parse-search-params';
import { buildResultsHref, loadSharedSearchState } from '@/components/search/shared-search-state';
import { getDepartureDisplay } from '@/components/search/departure-display';
import { createDefaultTravelersState } from '@/components/search/travelers-popup/travelers-popup-utils';
import type { TravelOffer } from '@/types/travel';

function corendonOffer(id: string, departureDate: string): TravelOffer {
  return {
    id,
    provider: 'Corendon',
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink: 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.200826.8.DZI-U',
    departureDate,
  };
}

function hrefQuery(href: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(href.split('?')[1] ?? ''));
}

test('parseSearchParams: flexibilityDays generic cap 3 (0..3 accepted; above 3, negative, non-numeric rejected)', () => {
  for (const value of [0, 1, 2, 3]) {
    assert.equal(parseSearchParams({ flexibilityDays: String(value) }).flexibilityDays, value);
  }
  for (const value of ['4', '7', '8', '14', '-1', 'abc']) {
    assert.equal(parseSearchParams({ flexibilityDays: value }).flexibilityDays, undefined, value);
  }
});

test('flexibilityDays=7 from an old URL is ignored: exact date, exact label', () => {
  const offers = [corendonOffer('exact', '21/11/2026'), corendonOffer('minus7', '14/11/2026')];
  const params = parseSearchParams({ departureStart: '2026-11-21', departureEnd: '2026-11-21', flexibilityDays: '7' });
  assert.equal(params.flexibilityDays, undefined);
  assert.deepEqual(filterOffers(offers, params).map((offer) => offer.id), ['exact']);
  const display = getDepartureDisplay({ departureStart: '2026-11-21', departureEnd: '2026-11-21', flexibilityDays: 7 });
  assert.equal(display.hint, 'Exacte vertrekdatum');
});

test('exact date ± 3 widens by 3 days on both sides', () => {
  const offers = [
    corendonOffer('minus3', '18/11/2026'),
    corendonOffer('plus3', '24/11/2026'),
    corendonOffer('plus4', '25/11/2026'),
  ];
  const matched = filterOffers(offers, {
    departureStart: '2026-11-21',
    departureEnd: '2026-11-21',
    flexibilityDays: 3,
  });
  assert.deepEqual(matched.map((offer) => offer.id).sort(), ['minus3', 'plus3']);
});

test('period never carries ±: a legacy URL with flexibilityDays does not widen the period', () => {
  const offers = [
    corendonOffer('before', '13/11/2026'),
    corendonOffer('inside', '17/11/2026'),
    corendonOffer('after', '22/11/2026'),
  ];
  const matched = filterOffers(offers, {
    departureStart: '2026-11-15',
    departureEnd: '2026-11-20',
    flexibilityDays: 2,
  });
  assert.deepEqual(matched.map((offer) => offer.id), ['inside']);
});

test('homepage href: fixed date ± 3 round-trips; label shows ± 3', () => {
  const href = buildResultsHref({
    selectedCountries: ['Spanje'],
    departureStart: '2026-11-21',
    departureEnd: null,
    flexibilityDays: 3,
    selectedDurations: [],
    selectedDepartureAirports: [],
    travelers: createDefaultTravelersState(),
  });
  const query = hrefQuery(href);
  assert.equal(query.departureStart, '2026-11-21');
  assert.equal(query.departureEnd, '2026-11-21');
  assert.equal(query.flexibilityDays, '3');
  const params = parseSearchParams(query);
  assert.equal(params.flexibilityDays, 3);
  const display = getDepartureDisplay({
    departureStart: params.departureStart,
    departureEnd: params.departureEnd,
    flexibilityDays: params.flexibilityDays,
  });
  assert.equal(display.mode, 'exact');
  assert.equal(display.hint, 'Flexibel ± 3 dagen');
  assert.match(display.summarySegment ?? '', /\(± 3 dagen\)$/);
});

test('stored period state never restores a ± margin', () => {
  const store = new Map<string, string>();
  store.set(
    'vacationweb.shared-search-state',
    JSON.stringify({
      selectedCountries: [],
      departureStart: '2026-11-15',
      departureEnd: '2026-11-20',
      flexibilityDays: 2,
      selectedDurations: [],
      selectedDepartureAirports: [],
      travelers: createDefaultTravelersState(),
    }),
  );
  const globalWithWindow = globalThis as unknown as { window?: unknown };
  const previous = globalWithWindow.window;
  globalWithWindow.window = { sessionStorage: { getItem: (key: string) => store.get(key) ?? null } };
  try {
    const period = loadSharedSearchState();
    assert.equal(period?.flexibilityDays, 0);

    store.set(
      'vacationweb.shared-search-state',
      JSON.stringify({ departureStart: '2026-11-21', departureEnd: null, flexibilityDays: 3 }),
    );
    assert.equal(loadSharedSearchState()?.flexibilityDays, 3);
  } finally {
    globalWithWindow.window = previous;
  }
});
