import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildResultsHref,
  createDefaultSharedSearchState,
} from '../../components/search/shared-search-state';
import { createDefaultTravelersState } from '../../components/search/travelers-popup/travelers-popup-utils';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import {
  parseDepartureAirportsParam,
  serializeDepartureAirportsParam,
} from './departure-airports';
import { filterOffers } from './filtering';
import {
  RESULTS_LIVE_PRICING_CANDIDATE_CAP,
} from './pagination';
import { parseSearchParams } from './parse-search-params';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

function hrefQuery(href: string): Record<string, string | string[] | undefined> {
  const url = new URL(href, 'https://vacationweb.test');
  const record: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of url.searchParams.entries()) {
    record[key] = value;
  }
  return record;
}

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'offer-1',
    provider: 'Corendon',
    hotelName: 'Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    deepLink: 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.200826.8.DZI-U',
    departureAirport: 'BRU',
    ...overrides,
  };
}

test('1. één luchthaven selecteren → departureAirport in Results URL', () => {
  const href = buildResultsHref({
    ...createDefaultSharedSearchState(),
    selectedDepartureAirports: ['BRU'],
  });
  const params = parseSearchParams(hrefQuery(href));
  assert.equal(params.departureAirport, 'BRU');
  assert.deepEqual(parseDepartureAirportsParam(params.departureAirport), ['BRU']);
});

test('2. meerdere luchthavens selecteren → comma-separated param', () => {
  const href = buildResultsHref({
    ...createDefaultSharedSearchState(),
    selectedDepartureAirports: ['AMS', 'BRU', 'EIN'],
  });
  const params = parseSearchParams(hrefQuery(href));
  assert.equal(params.departureAirport, 'AMS,BRU,EIN');
  assert.deepEqual(parseDepartureAirportsParam(params.departureAirport), ['AMS', 'BRU', 'EIN']);
});

test('3. OR-semantiek: multi-airport filter houdt A of B of C', () => {
  const offers = [
    makeOffer({ id: 'bru', departureAirport: 'BRU' }),
    makeOffer({ id: 'crl', departureAirport: 'CRL' }),
    makeOffer({ id: 'ein', departureAirport: 'EIN' }),
    makeOffer({ id: 'ams', departureAirport: 'AMS' }),
  ];
  const filtered = filterOffers(offers, { departureAirport: 'BRU,CRL' });
  assert.deepEqual(filtered.map((o) => o.id), ['bru', 'crl']);
});

test('4. geen luchthaven = bestaande semantiek (geen departureAirport param / geen filter)', () => {
  const href = buildResultsHref({
    ...createDefaultSharedSearchState(),
    selectedDepartureAirports: [],
  });
  const query = hrefQuery(href);
  assert.equal(query.departureAirport, undefined);
  const params = parseSearchParams(query);
  assert.equal(params.departureAirport, undefined);

  const offers = [
    makeOffer({ id: 'bru', departureAirport: 'BRU' }),
    makeOffer({ id: 'ein', departureAirport: 'EIN' }),
    makeOffer({ id: 'none', departureAirport: undefined }),
  ];
  const filtered = filterOffers(offers, {});
  assert.deepEqual(filtered.map((o) => o.id), ['bru', 'ein', 'none']);
});

test('5. Hero → Results behoudt selectie via buildResultsHref + parseSearchParams', () => {
  const href = buildResultsHref({
    selectedCountries: ['Spanje'],
    departureStart: '2026-09-01',
    departureEnd: '2026-09-15',
    flexibilityDays: 0,
    selectedDurations: [8],
    selectedDepartureAirports: ['BRU', 'CRL'],
    travelers: createDefaultTravelersState(),
  });
  const params = parseSearchParams(hrefQuery(href));
  assert.equal(params.departureAirport, 'BRU,CRL');
  assert.equal(params.country, 'Spanje');
  assert.deepEqual(params.nights, [8]);
});

test('6. Results kan selectie wijzigen (serialize + rebuild URL)', () => {
  const fromResults = serializeDepartureAirportsParam(['AMS', 'EIN']);
  assert.equal(fromResults, 'AMS,EIN');
  const href = buildResultsHref({
    ...createDefaultSharedSearchState(),
    selectedDepartureAirports: parseDepartureAirportsParam(fromResults),
  });
  assert.equal(parseSearchParams(hrefQuery(href)).departureAirport, 'AMS,EIN');

  const cleared = buildResultsHref({
    ...createDefaultSharedSearchState(),
    selectedDepartureAirports: [],
  });
  assert.equal(parseSearchParams(hrefQuery(cleared)).departureAirport, undefined);

  const resultsBar = readFileSync(join(ROOT, 'components/results-v2/results-search-bar.tsx'), 'utf8');
  assert.ok(resultsBar.includes('DepartureAirportPopup'));
  assert.ok(resultsBar.includes('selectedDepartureAirports'));
  assert.ok(resultsBar.includes("params.set('departureAirport'"));
  assert.ok(resultsBar.includes("params.delete('departureAirport')"));
});

test('7. combinatie met bestaande filters (country + nights + airport)', () => {
  const offers = [
    makeOffer({ id: 'ok', destinationCountry: 'Spanje', nights: 8, departureAirport: 'BRU' }),
    makeOffer({ id: 'wrong-airport', destinationCountry: 'Spanje', nights: 8, departureAirport: 'EIN' }),
    makeOffer({ id: 'wrong-country', destinationCountry: 'Griekenland', nights: 8, departureAirport: 'BRU' }),
    makeOffer({ id: 'wrong-nights', destinationCountry: 'Spanje', nights: 10, departureAirport: 'BRU' }),
  ];
  const filtered = filterOffers(offers, {
    country: 'Spanje',
    nights: [8],
    departureAirport: 'BRU,CRL',
  });
  assert.deepEqual(filtered.map((o) => o.id), ['ok']);
});

test('8. product resultset cap is removed (no RESULTS_USER_RESULTSET_MAX)', () => {
  const paginationSrc = readFileSync(join(ROOT, 'lib/search/pagination.ts'), 'utf8');
  assert.equal(paginationSrc.includes('RESULTS_USER_RESULTSET_MAX'), false);
  assert.equal(paginationSrc.includes('isResultsResultsetOverLimit'), false);
});

test('9. live-pricing candidate cap ongewijzigd; filtering blijft apart van live window', () => {
  assert.equal(RESULTS_LIVE_PRICING_CANDIDATE_CAP, 150);
  const paginationSrc = readFileSync(join(ROOT, 'lib/search/pagination.ts'), 'utf8');
  assert.match(paginationSrc, /RESULTS_LIVE_PRICING_CANDIDATE_CAP\s*=\s*150/);
  const filteringSrc = readFileSync(join(ROOT, 'lib/search/filtering.ts'), 'utf8');
  assert.ok(filteringSrc.includes('parseDepartureAirportsParam(params.departureAirport)'));
  assert.ok(filteringSrc.includes('offerMatchesDepartureAirports'));
});

test('Hero home-search wires airports into shared state and href (no hardcoded empty)', () => {
  const homeSearch = readFileSync(join(ROOT, 'components/home/home-search.tsx'), 'utf8');
  assert.ok(homeSearch.includes('selectedDepartureAirports,'));
  assert.ok(!homeSearch.includes('selectedDepartureAirports: []'));
  assert.ok(homeSearch.includes('DepartureAirportPopup'));
  assert.ok(homeSearch.includes('departureAirports'));
});
