import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  filterCountriesByQuery,
  formatSelectedCountriesLabel,
  loadDestinationCountries,
  loadPopularDestinationCountries,
} from '@/components/search/destination-popup/destination-popup-utils';
import {
  DURATION_MAX,
  DURATION_MIN,
  DEFAULT_EXACT_DURATION,
  durationModeFromSelection,
  durationSelectionFromExact,
  exactDurationFromSelection,
  expandDurationRange,
  flexibleRangeFromExact,
  flexibleRangeFromSelection,
  formatDurationRangeLabel,
  formatSelectedDurationsLabel,
  normalizeFlexibleDurationRange,
  parseDurationsFromSearchParams,
} from '@/components/search/duration-popup/duration-popup-utils';
import {
  buildResultsHref,
  createDefaultSharedSearchState,
  type SharedSearchState,
} from '@/components/search/shared-search-state';
import {
  getCountriesWithSelectedAirports,
  getPublicPickerCountryGroups,
  parseDepartureAirportsParam,
  setDepartureAirportsSelection,
  toggleDepartureAirport,
} from '@/components/search/departure-airport-popup/departure-airport-popup-utils';
import { stateFromUrl } from '@/components/results-v2/results-search-bar-utils';
import { createDefaultTravelersState } from '@/components/search/travelers-popup/travelers-popup-utils';
import { parseSearchParams } from '@/lib/search/parse-search-params';

const ROOT = process.cwd();
const src = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

function hrefFor(partial: Partial<SharedSearchState>): URLSearchParams {
  const href = buildResultsHref({
    ...createDefaultSharedSearchState(),
    travelers: createDefaultTravelersState(),
    ...partial,
  });
  return new URLSearchParams(href.split('?')[1]);
}

/* ---------------- Destination ---------------- */

test('destination: one search field over country + region/island + place, built on the existing filter-options lists', () => {
  const popup = src('components/search/destination-popup/destination-popup.tsx');
  const search = src('components/search/destination-popup/destination-search.ts');
  assert.ok(popup.includes('placeholder={DESTINATION_SEARCH_PLACEHOLDER}'));
  // M1: the index is built from the VacationWeb destination directory (derived from the catalog fields; no new geo-data source).
  assert.ok(search.includes('destination-directory'));
  assert.ok(search.includes('buildDestinationEntries'));
  // No geographic explanation line in the popup or in a suggestion.
  assert.equal(popup.includes('Costa Brava'), false);
  assert.equal(/Plaats\s*\u00b7/.test(popup), false);
  assert.equal(/Plaats\s*\u00b7/.test(search), false);
});

test('destination: popular destinations are a compact 3-column grid; every popular name is a real country', () => {
  const popup = src('components/search/destination-popup/destination-popup.tsx');
  assert.ok(popup.includes('grid grid-cols-3'));
  assert.ok(popup.includes('data-testid="destination-popular"'));
  assert.equal(popup.includes('flex flex-wrap gap-2" data-testid="destination-popular"'), false);
  const all = loadDestinationCountries({});
  const popular = loadPopularDestinationCountries(all);
  assert.ok(popular.length >= 6 && popular.length <= 9, `popular count ${popular.length}`);
  const names = new Set(all.map((country) => country.name));
  for (const country of popular) assert.ok(names.has(country.name));
});

test('destination: "all destinations" list + count stay visible next to the popular grid, and search still narrows', () => {
  const popup = src('components/search/destination-popup/destination-popup.tsx');
  assert.ok(popup.includes('Alle bestemmingen'));
  assert.ok(popup.includes('data-testid="destination-all-count"'));
  assert.ok(popup.includes('data-testid="destination-all-list"'));
  const list = loadDestinationCountries({});
  assert.deepEqual(filterCountriesByQuery(list, 'spa').map((country) => country.name), ['Spanje']);
  assert.deepEqual(filterCountriesByQuery(list, 'grie').map((country) => country.name), ['Griekenland']);
});

test('destination: multi-select OR stays on country level (URL country=A,B), single and none', () => {
  assert.equal(formatSelectedCountriesLabel([]), 'Bestemming kiezen');
  assert.equal(formatSelectedCountriesLabel(['Spanje']), 'Spanje');
  assert.equal(formatSelectedCountriesLabel(['Spanje', 'Griekenland']), '2 bestemmingen');
  const query = hrefFor({ selectedCountries: ['Spanje', 'Griekenland'] });
  assert.equal(query.get('country'), 'Spanje,Griekenland');
  assert.deepEqual(parseSearchParams(Object.fromEntries(query)).countries, ['Spanje', 'Griekenland']);
  assert.equal(hrefFor({}).get('country'), null);
});

test('destination: existing region/city URL params still parse (backward compatible, not offered in the popup)', () => {
  const params = parseSearchParams({ country: 'Spanje', region: 'Costa Brava', city: 'Tossa de Mar' });
  assert.equal(params.region, 'Costa Brava');
  assert.equal(params.city, 'Tossa de Mar');
});

/* ---------------- Date ---------------- */

test('date: two modes kept, prominent segmented control, no third logic and no +-7', () => {
  const popup = src('components/search/departure-period-popup/departure-period-popup.tsx');
  assert.ok(popup.includes('role="tablist"'));
  assert.ok(popup.includes("['vast', 'Vaste vertrekdatum'"));
  assert.ok(popup.includes("['periode', 'Vertrekperiode'"));
  assert.ok(popup.includes('aria-selected={activeTab === tab}'));
  const css = src('components/search/departure-period-popup/departure-period-popup.css');
  assert.match(css, /departure-period-popup__tab--active \{[^}]*background: #1e40af;[^}]*color: #ffffff;/);
  assert.equal(/\u00B1\s*7/.test(popup), false);
  assert.match(popup, /0: 'Exacte datum'/);
  for (const days of [1, 2, 3]) assert.ok(popup.includes(`${days}: '\u00B1 ${days} dag`));
});

test('date: exact, +-1/+-2/+-3 and period map to the existing departureStart/End + flexibilityDays params', () => {
  const exact = hrefFor({ departureStart: '2027-02-10', departureEnd: '2027-02-10', flexibilityDays: 0 });
  assert.equal(exact.get('departureStart'), '2027-02-10');
  assert.equal(exact.get('flexibilityDays'), null);
  for (const days of [1, 2, 3] as const) {
    const flex = hrefFor({ departureStart: '2027-02-10', departureEnd: '2027-02-10', flexibilityDays: days });
    assert.equal(flex.get('flexibilityDays'), String(days));
    assert.equal(stateFromUrl(flex).flexibilityDays, days);
  }
  const period = hrefFor({ departureStart: '2027-02-10', departureEnd: '2027-02-17', flexibilityDays: 0 });
  assert.equal(period.get('departureStart'), '2027-02-10');
  assert.equal(period.get('departureEnd'), '2027-02-17');
  assert.equal(period.get('flexibilityDays'), null);
});

/* ---------------- Duration ---------------- */

test('duration: no "Elke duur" string in any SearchForm source (UI, utils, tests excluded only by name)', () => {
  const files = [
    'components/home/home-search.tsx',
    'components/search/search-form.tsx',
    'components/search/duration-popup/duration-popup.tsx',
    'components/search/duration-popup/duration-popup-utils.ts',
    'components/search/duration-popup/duration-popup.css',
    'components/search/departure-airport-popup/departure-airport-popup.tsx',
    'components/search/destination-popup/destination-popup.tsx',
    'components/search/departure-period-popup/departure-period-popup.tsx',
    'components/results-v2/results-search-bar.tsx',
  ];
  for (const file of files) assert.equal(src(file).includes('Elke duur'), false, file);
  assert.equal(formatSelectedDurationsLabel([]), 'Reisduur');
  assert.equal(formatDurationRangeLabel({ min: DURATION_MIN, max: DURATION_MAX }), '2\u201332 dagen');
});

test('duration: exact = one day value (nights=8), mode detection, other exact values', () => {
  assert.equal(DEFAULT_EXACT_DURATION, 8);
  assert.deepEqual(durationSelectionFromExact(8), [8]);
  for (const days of [2, 5, 7, 8, 14, 21, 32]) {
    const query = hrefFor({ selectedDurations: durationSelectionFromExact(days) });
    assert.equal(query.get('nights'), String(days));
    const parsed = parseSearchParams(Object.fromEntries(query));
    assert.deepEqual(parsed.nights, [days]);
    assert.equal(durationModeFromSelection(parsed.nights ?? []), 'exact');
    assert.equal(exactDurationFromSelection(parsed.nights ?? []), days);
  }
  assert.deepEqual(durationSelectionFromExact(99), [DURATION_MAX]);
  assert.deepEqual(durationSelectionFromExact(0), [DURATION_MIN]);
  assert.equal(formatSelectedDurationsLabel([8]), '8 dagen');
});

test('duration: flexible range 7-10 = contiguous nights list; never the full 2-32 span as a choice', () => {
  const selection = expandDurationRange(7, 10);
  assert.deepEqual(selection, [7, 8, 9, 10]);
  const query = hrefFor({ selectedDurations: selection });
  assert.equal(query.get('nights'), '7,8,9,10');
  assert.equal(durationModeFromSelection(selection), 'flexibel');
  assert.equal(formatSelectedDurationsLabel(selection), '7\u201310 dagen');
  assert.deepEqual(flexibleRangeFromSelection(selection), { min: 7, max: 10 });
  assert.deepEqual(flexibleRangeFromExact(7), { min: 7, max: 10 });
  assert.deepEqual(flexibleRangeFromExact(31), { min: 31, max: 32 });
  assert.deepEqual(normalizeFlexibleDurationRange(DURATION_MIN, DURATION_MAX, 'min'), { min: DURATION_MIN + 1, max: DURATION_MAX });
  assert.deepEqual(normalizeFlexibleDurationRange(DURATION_MIN, DURATION_MAX, 'max'), { min: DURATION_MIN, max: DURATION_MAX - 1 });
  assert.deepEqual(flexibleRangeFromSelection(expandDurationRange(DURATION_MIN, DURATION_MAX)), { min: DURATION_MIN, max: DURATION_MAX - 1 });
});

test('duration: empty = no nights param (internal), legacy URLs (nights list, nightsMin/Max) still read', () => {
  assert.equal(hrefFor({ selectedDurations: [] }).get('nights'), null);
  assert.deepEqual(parseDurationsFromSearchParams(new URLSearchParams('nightsMin=8&nightsMax=8')), [8]);
  assert.deepEqual(parseDurationsFromSearchParams(new URLSearchParams('nights=14,7')), [7, 14]);
  assert.equal(durationModeFromSelection([]), 'exact');
  assert.equal(durationModeFromSelection([7, 14]), 'flexibel');
});

test('duration popup: two tabs Exact / Flexibel, optional empty state, no full-range option, range 2-32', () => {
  const popup = src('components/search/duration-popup/duration-popup.tsx');
  assert.ok(popup.includes("['exact', 'Exact'"));
  assert.ok(popup.includes("['flexibel', 'Flexibel'"));
  assert.ok(popup.includes('role="tablist"'));
  assert.ok(popup.includes('Optioneel'));
  assert.ok(popup.includes('normalizeFlexibleDurationRange'));
  assert.equal(DURATION_MIN, 2);
  assert.equal(DURATION_MAX, 32);
  const home = src('components/home/home-search.tsx');
  assert.ok(home.includes("'Aantal dagen'"));
  assert.ok(home.includes('label="Reisduur"'));
});

/* ---------------- Airports ---------------- */

const BE = ['BRU', 'CRL', 'ANR', 'OST', 'LGG'];

test('airports: groups keep the canonical order and Belgian airport list', () => {
  const groups = getPublicPickerCountryGroups();
  assert.deepEqual(groups.map((group) => group.countryCode), ['BE', 'NL', 'DE', 'FR', 'LU']);
  assert.deepEqual(groups[0].airports.map((airport) => airport.iata), BE);
  assert.deepEqual(groups[0].airports.map((airport) => airport.displayNameNl), ['Brussel', 'Brussel Charleroi', 'Antwerpen', 'Oostende', 'Luik']);
});

test('airports: select all of Belgium, individual, several, several countries -> departureAirport param', () => {
  const groups = getPublicPickerCountryGroups();
  const nl = groups[1].airports.map((airport) => airport.iata);
  let selected = setDepartureAirportsSelection([], BE, true);
  assert.deepEqual([...selected].sort(), [...BE].sort());
  selected = setDepartureAirportsSelection(selected, BE, false);
  assert.deepEqual(selected, []);
  selected = toggleDepartureAirport([], 'CRL');
  assert.deepEqual(selected, ['CRL']);
  selected = toggleDepartureAirport(selected, 'BRU');
  assert.deepEqual([...selected].sort(), ['BRU', 'CRL']);
  selected = setDepartureAirportsSelection(selected, nl, true);
  const query = hrefFor({ selectedDepartureAirports: selected });
  const param = query.get('departureAirport') ?? '';
  assert.deepEqual(parseDepartureAirportsParam(param).sort(), [...selected].sort());
  assert.deepEqual(stateFromUrl(query).selectedDepartureAirports.sort(), [...selected].sort());
  assert.equal(hrefFor({}).get('departureAirport'), null);
});

test('airports: groups with a selected airport open on popup open, others stay closed', () => {
  const groups = getPublicPickerCountryGroups();
  assert.deepEqual([...getCountriesWithSelectedAirports([], groups)], []);
  assert.deepEqual([...getCountriesWithSelectedAirports(['CRL'], groups)], ['BE']);
});

test('airports popup: checkbox and expand are separate controls with correct ARIA, default compact', () => {
  const popup = src('components/search/departure-airport-popup/departure-airport-popup.tsx');
  assert.ok(popup.includes('role="checkbox"'));
  assert.ok(popup.includes("aria-checked={allSelected ? true : someSelected ? 'mixed' : false}"));
  assert.ok(popup.includes('aria-expanded={expanded}'));
  assert.ok(popup.includes('aria-controls={listId}'));
  assert.ok(popup.includes('className="dap__country-check"'));
  assert.ok(popup.includes('className="dap__expand"'));
  // checkbox button comes before (and is not nested in) the expand button
  assert.ok(popup.indexOf('dap__country-check') < popup.indexOf('className="dap__expand"'));
  assert.equal(popup.includes('Empty selection: open the full tree'), false);
  const css = src('components/search/departure-airport-popup/departure-airport-popup.css');
  assert.match(css, /\.dap__airports \{[^}]*padding: 0 2px 4px 40px;/);
});

/* ---------------- Funnel / regression ---------------- */

test('funnel: Bestemming > Wanneer > Reisduur > Vertrekluchthaven > Reizigers > CTA on the homepage form', () => {
  const home = src('components/home/home-search.tsx');
  const order = ['label="Bestemming"', 'label="Wanneer"', 'label="Reisduur"', 'label="Vertrekluchthaven"', 'label="Reizigers"', 'Vakanties vergelijken'];
  const positions = order.map((needle) => home.indexOf(needle));
  for (const position of positions) assert.ok(position > 0);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  assert.equal(home.includes('Elke duur'), false);
  assert.equal(home.includes('Land of regio'), false);
  assert.ok(home.includes('router.push') || home.includes('startTransition'));
});

test('regression: travelers, rooms and the full href (all params together) are unchanged', () => {
  const query = hrefFor({
    selectedCountries: ['Spanje'],
    departureStart: '2027-02-10',
    departureEnd: '2027-02-10',
    flexibilityDays: 2,
    selectedDurations: [8],
    selectedDepartureAirports: ['BRU'],
  });
  assert.equal(query.get('country'), 'Spanje');
  assert.equal(query.get('flexibilityDays'), '2');
  assert.equal(query.get('nights'), '8');
  assert.equal(query.get('departureAirport'), 'BRU');
  assert.ok(query.get('adults'));
  assert.equal(query.get('childAges'), '');
  assert.equal(query.get('dob'), null);
  const parsed = parseSearchParams(Object.fromEntries(query));
  assert.deepEqual(parsed.countries, ['Spanje']);
  assert.deepEqual(parsed.nights, [8]);
});