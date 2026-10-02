import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  DESTINATION_SEARCH_PLACEHOLDER,
  MAX_DESTINATION_SUGGESTIONS,
  buildDestinationSearchIndex,
  decodeDestinationLabel,
  formatPlaceSelectionLabel,
  loadDestinationSearchIndex,
  placeSelectionFromState,
  placeSelectionFromSuggestion,
  searchDestinations,
} from '@/components/search/destination-popup/destination-search';
import {
  filterCountriesByQuery,
  loadDestinationCountries,
  loadPopularDestinationCountries,
} from '@/components/search/destination-popup/destination-popup-utils';
import { stateFromUrl } from '@/components/results-v2/results-search-bar-utils';
import {
  buildResultsHref,
  createDefaultSharedSearchState,
  mergeSharedStateIntoSearchForm,
  sharedStateFromSearchForm,
  type SharedSearchState,
} from '@/components/search/shared-search-state';
import { createDefaultTravelersState } from '@/components/search/travelers-popup/travelers-popup-utils';
import { loadFilterOptions } from '@/lib/offers/load-filter-options';
import { buildDestinationDirectory, type DirectoryOfferInput } from '@/lib/search/destination-directory';
import { filterOffers } from '@/lib/search/filtering';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import type { TravelOffer } from '@/types/travel';

const ROOT = process.cwd();
const src = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

function indexFor(offers: DirectoryOfferInput[]) {
  return buildDestinationSearchIndex({ directory: buildDestinationDirectory(offers) });
}

const FIXTURE: DirectoryOfferInput[] = [
  { country: 'Griekenland', region: 'Kreta', province: '', city: 'Agia Pelagia' },
  { country: 'Griekenland', region: 'Kreta', province: '', city: 'Agia Pelagia Spili' },
  { country: 'Griekenland', region: 'Cr\u00e8te', province: '', city: 'Agia Pelagia' },
  { country: 'Griekenland', region: 'Rhodos', province: '', city: 'Rhodos-Stad' },
  { country: 'Griekenland', region: 'Zakynthos', province: '', city: 'Kalamaki' },
  { country: 'Griekenland', region: 'Kreta', province: '', city: 'Kalamaki' },
  { country: 'Griekenland', region: 'Lesbos', province: '', city: 'Petra' },
  { country: 'Spanje', region: 'Costa Brava', province: '', city: 'Tossa de Mar' },
  { country: 'Spanje', region: 'Balearen', province: 'Mallorca', city: 'Cala d&apos;Or' },
  { country: 'Spanje', region: 'Mallorca', province: 'Balearen', city: 'Cala d&#039;Or' },
  { country: 'Spanje', region: 'Balearen', province: 'Mallorca', city: 'Petra' },
  { country: 'Spanje', region: 'Balearen', province: 'Mallorca', city: 'Palma de Mallorca' },
  { country: 'Spanje', region: 'Balearen', province: 'Ibiza', city: 'Santa Eulalia' },
  { country: 'Spanje', region: 'Canarische Eilanden', province: 'Tenerife', city: 'Costa Adeje' },
  { country: 'Spanje', region: 'Gran Canaria', province: 'Canarische Eilanden', city: 'Playa del Ingl\u00e9s' },
  { country: 'Spanje', region: 'Gran Canaria', province: 'Canarische Eilanden', city: 'Playa del Ingles' },
  { country: 'Turkije', region: 'Turkse Riviera', province: 'Alanya', city: 'Alanya' },
  { country: 'Turkije', region: 'Alanya', province: 'Turkse Riviera', city: 'Konakli' },
  { country: 'Turkije', region: 'Turkse Riviera', province: 'Side', city: 'Side' },
  { country: 'Turkije', region: 'Side', province: 'Turkse Riviera', city: 'Kizilagac' },
  { country: 'Turkije', region: 'Blue Cruises', province: 'Blue Cruises', city: 'Blue Cruises Turkse Riviera' },
  { country: 'Griekenland', region: 'Kreta', province: '', city: 'Bingoreizen Kreta' },
  { country: 'Egypte', region: 'Luxor', province: 'Luxor', city: 'Nijlcruise' },
];

const INDEX = indexFor(FIXTURE);

const labels = (query: string) => searchDestinations(INDEX, query).map((s) => s.label);
const kinds = (query: string) => searchDestinations(INDEX, query).map((s) => s.kind);

function hrefFor(partial: Partial<SharedSearchState>): URLSearchParams {
  const href = buildResultsHref({
    ...createDefaultSharedSearchState(),
    travelers: createDefaultTravelersState(),
    ...partial,
  });
  return new URLSearchParams(href.split('?')[1]);
}

/* ---------------- search logic (pure) ---------------- */

test('destination search: placeholder text is exact', () => {
  assert.equal(DESTINATION_SEARCH_PLACEHOLDER, 'Zoek land, regio of plaats');
});

test('destination search: country ("span" -> Spanje)', () => {
  assert.deepEqual(labels('span'), ['Spanje']);
  assert.deepEqual(kinds('span'), ['country']);
  assert.deepEqual(labels('GRIEK'), ['Griekenland']);
});

test('destination search: region/island ("kreta", Tenerife, Gran Canaria, Mallorca)', () => {
  assert.deepEqual(labels('kreta'), ['Kreta']);
  assert.deepEqual(kinds('kreta'), ['region']);
  assert.deepEqual(labels('cr\u00e8te'), [], 'provider language variants are not separate destinations');
  assert.equal(labels('Tenerife')[0], 'Tenerife');
  assert.equal(kinds('Tenerife')[0], 'region');
  assert.equal(labels('gran canaria')[0], 'Gran Canaria');
  assert.equal(labels('mallorca')[0], 'Mallorca');
  assert.equal(kinds('mallorca')[0], 'region');
});

test('destination search: place ("tossa" -> Tossa de Mar, "Agia Pelagia")', () => {
  assert.deepEqual(labels('tossa'), ['Tossa de Mar']);
  assert.deepEqual(kinds('tossa'), ['city']);
  assert.deepEqual(labels('Agia Pelagia'), ['Agia Pelagia', 'Agia Pelagia Spili']);
  assert.deepEqual(labels('  TOSSA DE '), ['Tossa de Mar']);
});

test('destination search: matching is diacritic- and case-insensitive (match only)', () => {
  assert.deepEqual(labels('playa del ingles'), ['Playa del Ingl\u00e9s']);
  assert.deepEqual(labels('PLAYA DEL INGL\u00c9S'), ['Playa del Ingl\u00e9s']);
  assert.equal(labels('playa del').length, 1, 'accent spelling variants are ONE destination');
});

test('destination search: shows names only, HTML entities decoded for display, raw value kept for the URL', () => {
  const hit = searchDestinations(INDEX, 'cala d')[0];
  assert.equal(hit.label, "Cala d'Or");
  assert.equal(hit.value, "Cala d'Or");
  assert.equal(searchDestinations(INDEX, 'cala d').length, 1, '&apos; and &#039; are one destination');
  assert.equal(decodeDestinationLabel('Ca&#039;n Picafort'), "Ca'n Picafort");
  for (const suggestion of searchDestinations(INDEX, 'tossa')) {
    assert.equal(/\u00b7|Costa Brava|Spanje/.test(suggestion.label), false, 'no geographic explanation');
  }
});

test('destination search: empty query gives no suggestions; at most 8 results; no match gives []', () => {
  assert.deepEqual(searchDestinations(INDEX, ''), []);
  assert.deepEqual(searchDestinations(INDEX, '   '), []);
  assert.equal(MAX_DESTINATION_SUGGESTIONS, 8);
  const big = indexFor(
    Array.from({ length: 30 }, (_, i) => ({ country: 'Spanje', region: 'Costa Brava', city: `Sunplaya ${i}` })),
  );
  assert.equal(searchDestinations(big, 'sun').length, 8);
  assert.deepEqual(labels('xyzzy'), []);
});

test('destination search: ranking = exact, then prefix, then word prefix; country before region before place', () => {
  const idx = indexFor([
    { country: 'Cyprus', region: 'Zuid', city: 'Zuidkust' },
    { country: 'Cyprus', region: 'Cyprus Zuid', city: 'Noord Zuid' },
  ]);
  const out = searchDestinations(idx, 'zuid').map((s) => s.label);
  assert.deepEqual(out, ['Zuid', 'Zuidkust', 'Cyprus Zuid', 'Noord Zuid']);
});

test('destination search: a name that is more than one destination gets a SHORT suffix, otherwise none', () => {
  // Petra: Lesbos and Mallorca -> two rows with the area as suffix.
  assert.deepEqual(labels('petra').sort(), ['Petra \u2014 Lesbos', 'Petra \u2014 Mallorca']);
  // Kalamaki: Kreta / Zakynthos.
  assert.deepEqual(labels('kalamaki').sort(), ['Kalamaki \u2014 Kreta', 'Kalamaki \u2014 Zakynthos']);
  // Alanya / Side: area (region) and place (city) are different destinations: "regio" / "stad".
  assert.deepEqual(labels('alanya').sort(), ['Alanya \u2014 regio', 'Alanya \u2014 stad']);
  assert.deepEqual(labels('side').sort(), ['Side \u2014 regio', 'Side \u2014 stad']);
  // Unique names carry no suffix at all.
  assert.deepEqual(labels('tossa'), ['Tossa de Mar']);
  assert.deepEqual(labels('mallorca').filter((l) => l === 'Mallorca'), ['Mallorca']);
  // Choices: region -> region; place -> city (+ region only for homonyms); stad -> city; regio -> region.
  const find = (label: string) => searchDestinations(INDEX, label.split(' \u2014 ')[0]).find((s) => s.label === label)!;
  assert.deepEqual(placeSelectionFromSuggestion(find('Alanya \u2014 regio')), { country: 'Turkije', region: 'Alanya' });
  assert.deepEqual(placeSelectionFromSuggestion(find('Alanya \u2014 stad')), { country: 'Turkije', city: 'Alanya' });
  assert.deepEqual(placeSelectionFromSuggestion(find('Kalamaki \u2014 Kreta')), { country: 'Griekenland', region: 'Kreta', city: 'Kalamaki' });
  assert.deepEqual(placeSelectionFromSuggestion(find('Petra \u2014 Mallorca')), { country: 'Spanje', region: 'Mallorca', city: 'Petra' });
});

test('destination search: Balearen / Canarische Eilanden are destinations next to their islands; product names are not', () => {
  assert.deepEqual(labels('balearen'), ['Balearen']);
  assert.deepEqual(labels('canarische'), ['Canarische Eilanden']);
  for (const island of ['Mallorca', 'Ibiza', 'Tenerife', 'Gran Canaria']) {
    assert.equal(labels(island)[0], island);
  }
  assert.deepEqual(labels('bingo'), []);
  assert.deepEqual(labels('blue cruises'), []);
  assert.deepEqual(labels('nijl'), []);
  assert.deepEqual(labels('luxor'), [], 'areas that only consist of product offers are not in the popup index');
  assert.deepEqual(labels('agia pelagia spili'), ['Agia Pelagia Spili']);
  assert.deepEqual(placeSelectionFromSuggestion(searchDestinations(INDEX, 'agia pelagia spili')[0]), {
    country: 'Griekenland',
    city: 'Agia Pelagia Spili',
  });
});

test('destination search: real filter-options give the expected hits and are fast', () => {
  const options = loadFilterOptions();
  const index = loadDestinationSearchIndex(options.countryCounts ?? {});
  const first = (query: string) => searchDestinations(index, query)[0];
  assert.equal(first('span')?.kind, 'country');
  assert.equal(first('span')?.label, 'Spanje');
  assert.equal(first('kreta')?.kind, 'region');
  assert.equal(first('kreta')?.country, 'Griekenland');
  assert.equal(first('tossa')?.label, 'Tossa de Mar');
  assert.equal(first('tossa')?.country, 'Spanje');
  assert.equal(first('agia pelagia')?.country, 'Griekenland');
  for (const island of ['Tenerife', 'Gran Canaria', 'Mallorca']) {
    const hit = first(island);
    assert.equal(hit?.label, island);
    assert.equal(hit?.kind, 'region');
    assert.equal(hit?.country, 'Spanje');
  }
  // Only the catalog's own countries (with offers) are searchable as countries.
  const countryNames = new Set(index.filter((s) => s.kind === 'country').map((s) => s.value));
  assert.ok(countryNames.has('Spanje') && countryNames.has('Griekenland'));
  const started = performance.now();
  for (let i = 0; i < 50; i += 1) searchDestinations(index, 'ta');
  assert.ok((performance.now() - started) / 50 < 20, 'synchronous search stays well below a frame');
});

test('destination search: region/place pick yields one single selection with its parent country', () => {
  const [kreta] = searchDestinations(INDEX, 'kreta');
  assert.deepEqual(placeSelectionFromSuggestion(kreta), { country: 'Griekenland', region: 'Kreta' });
  const [tossa] = searchDestinations(INDEX, 'tossa');
  assert.deepEqual(placeSelectionFromSuggestion(tossa), { country: 'Spanje', city: 'Tossa de Mar' });
  const [spanje] = searchDestinations(INDEX, 'span');
  assert.equal(placeSelectionFromSuggestion(spanje), null);
  assert.equal(formatPlaceSelectionLabel({ country: 'Spanje', city: 'Cala d&apos;Or' }), "Cala d'Or");
  assert.deepEqual(placeSelectionFromSuggestion(searchDestinations(INDEX, 'cala d')[0]), { country: 'Spanje', city: "Cala d'Or" });
  assert.equal(formatPlaceSelectionLabel({ country: 'Griekenland', region: 'Kreta' }), 'Kreta');
});

test('destination state: a place only exists together with exactly one country', () => {
  assert.equal(placeSelectionFromState(['Spanje', 'Griekenland'], 'Kreta', null), null);
  assert.equal(placeSelectionFromState([], 'Kreta', null), null);
  assert.equal(placeSelectionFromState(['Spanje'], '', ''), null);
  assert.deepEqual(placeSelectionFromState(['Spanje'], null, 'Tossa de Mar'), { country: 'Spanje', city: 'Tossa de Mar' });
  assert.deepEqual(placeSelectionFromState(['Griekenland'], 'Kreta', undefined), { country: 'Griekenland', region: 'Kreta' });
});

/* ---------------- URL contract ---------------- */

test('URL: country (multi-select unchanged) -> country=A,B, no region/city', () => {
  const single = hrefFor({ selectedCountries: ['Spanje'] });
  assert.equal(single.get('country'), 'Spanje');
  assert.equal(single.get('region'), null);
  assert.equal(single.get('city'), null);
  const multi = hrefFor({ selectedCountries: ['Spanje', 'Griekenland'] });
  assert.equal(multi.get('country'), 'Spanje,Griekenland');
  assert.equal(multi.get('region'), null);
  assert.equal(multi.get('city'), null);
});

test('URL: region/island -> country=Parent&region=X (existing single-value contract)', () => {
  const kreta = hrefFor({ selectedCountries: ['Griekenland'], region: 'Kreta' });
  assert.equal(kreta.get('country'), 'Griekenland');
  assert.equal(kreta.get('region'), 'Kreta');
  assert.equal(kreta.get('city'), null);
  const tenerife = hrefFor({ selectedCountries: ['Spanje'], region: 'Tenerife' });
  assert.equal(tenerife.get('country'), 'Spanje');
  assert.equal(tenerife.get('region'), 'Tenerife');
});

test('URL: place -> country=Parent&city=P (existing single-value contract)', () => {
  const tossa = hrefFor({ selectedCountries: ['Spanje'], city: 'Tossa de Mar' });
  assert.equal(tossa.get('country'), 'Spanje');
  assert.equal(tossa.get('city'), 'Tossa de Mar');
  assert.equal(tossa.get('region'), null);
  const params = parseSearchParams(Object.fromEntries(tossa));
  assert.deepEqual(params.countries, ['Spanje']);
  assert.equal(params.city, 'Tossa de Mar');
});

test('URL: region/city are never written without exactly one parent country', () => {
  assert.equal(hrefFor({ selectedCountries: [], region: 'Kreta' }).get('region'), null);
  const two = hrefFor({ selectedCountries: ['Spanje', 'Griekenland'], city: 'Tossa de Mar' });
  assert.equal(two.get('city'), null);
  assert.equal(two.get('country'), 'Spanje,Griekenland');
  // A plain country state (the default) never carries region/city.
  assert.equal(hrefFor({ selectedCountries: ['Spanje'] }).has('region'), false);
});

test('URL: generated hrefs feed the existing Results filter (country+region, country+city)', () => {
  const offer = (id: string, country: string, region: string, city: string): TravelOffer => ({
    id,
    provider: 'Sunweb',
    hotelName: 'Test Hotel',
    destinationCountry: country,
    destinationRegion: region,
    destinationCity: city,
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink:
      'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
      encodeURIComponent(
        'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-20',
      ),
  });
  const offers = [
    offer('a', 'Griekenland', 'Kreta', 'Agia Pelagia'),
    offer('b', 'Griekenland', 'Rhodos', 'Rhodos-Stad'),
    offer('c', 'Spanje', 'Costa Brava', 'Tossa de Mar'),
    offer('d', 'Spanje', 'Tenerife', 'Costa Adeje'),
  ];
  const ids = (partial: Partial<SharedSearchState>) =>
    filterOffers(offers, parseSearchParams(Object.fromEntries(hrefFor(partial)))).map((o) => o.id);
  assert.deepEqual(ids({ selectedCountries: ['Griekenland'], region: 'Kreta' }), ['a']);
  assert.deepEqual(ids({ selectedCountries: ['Spanje'], city: 'Tossa de Mar' }), ['c']);
  assert.deepEqual(ids({ selectedCountries: ['Spanje'], region: 'Tenerife' }), ['d']);
  assert.deepEqual(ids({ selectedCountries: ['Spanje', 'Griekenland'] }).sort(), ['a', 'b', 'c', 'd']);
});

test('shared state: region/city round trip through search form state and merge (consistent with country)', () => {
  const form = {
    countries: ['Griekenland'],
    region: 'Kreta',
    city: '',
    departureStart: '2026-12-01',
    departureEnd: '2026-12-20',
    nightsMin: 7,
    nightsMax: 7,
    adults: 2,
    children: 0,
    rooms: 1,
  };
  const shared = sharedStateFromSearchForm(form);
  assert.equal(shared.region, 'Kreta');
  assert.equal(shared.city, undefined);
  const merged = mergeSharedStateIntoSearchForm({ ...form, region: '', city: '' }, shared);
  assert.equal(merged.region, 'Kreta');
  assert.deepEqual(merged.countries, ['Griekenland']);
  // A stored place with several countries is dropped (country multi-select wins).
  const multi = mergeSharedStateIntoSearchForm(
    { ...form, region: '', city: '' },
    { ...shared, selectedCountries: ['Spanje', 'Griekenland'] },
  );
  assert.equal(multi.region, '');
  assert.equal(multi.city, '');
});

test('Results bar: stateFromUrl/country state untouched; region/city stay preserved by the existing filter keys', () => {
  const state = stateFromUrl(new URLSearchParams('country=Griekenland&region=Kreta'));
  assert.deepEqual(state.selectedCountries, ['Griekenland']);
  const utils = src('components/results-v2/results-search-bar-utils.ts');
  assert.ok(/'region',\s*\r?\n\s*'city',/.test(utils));
});

/* ---------------- popup structure + no regression ---------------- */

test('popup: one search field, popular grid (3 columns, 8 max) and "Alle bestemmingen" list unchanged', () => {
  const popup = src('components/search/destination-popup/destination-popup.tsx');
  assert.equal((popup.match(/<input/g) ?? []).length, 1);
  assert.ok(popup.includes('placeholder={DESTINATION_SEARCH_PLACEHOLDER}'));
  assert.ok(popup.includes('grid grid-cols-3'));
  assert.ok(popup.includes('data-testid="destination-popular"'));
  assert.ok(popup.includes('Populaire bestemmingen'));
  assert.ok(popup.includes('Alle bestemmingen'));
  assert.ok(popup.includes('data-testid="destination-all-list"'));
  assert.ok(popup.includes('data-testid="destination-all-count"'));
  assert.equal(popup.includes('Zoek in alle bestemmingen'), false);
  assert.equal(popup.includes('Zoek bestemming'), false);
  // Suggestions only while typing (empty query -> no dropdown, popup exactly as before).
  assert.ok(popup.includes('data-testid="destination-suggestions"'));
  assert.deepEqual(searchDestinations(INDEX, ''), []);
});

test('popup: popular + all lists and country-level search are unchanged', () => {
  const all = loadDestinationCountries({});
  const popular = loadPopularDestinationCountries(all);
  assert.ok(popular.length >= 6 && popular.length <= 9);
  assert.deepEqual(filterCountriesByQuery(all, 'spa').map((c) => c.name), ['Spanje']);
  assert.deepEqual(filterCountriesByQuery(all, 'grie').map((c) => c.name), ['Griekenland']);
  assert.deepEqual(filterCountriesByQuery(all, 'Kreta'), []);
  assert.equal(filterCountriesByQuery(all, '').length, all.length);
});

test('popup: only the destination popup and its callers changed; Results filtering/parse and other bar parts untouched', () => {
  const popup = src('components/search/destination-popup/destination-popup.tsx');
  assert.equal(/lib\/search\/filtering|parse-search-params/.test(popup), false);
  const search = src('components/search/destination-popup/destination-search.ts');
  assert.equal(/lib\/search\/(filtering|parse-search-params)/.test(search), false);
  // Every caller passes the place through the same contract.
  for (const file of ['components/home/home-search.tsx', 'components/results/filter-sidebar.tsx', 'components/search/search-form.tsx']) {
    assert.ok(src(file).includes('appliedPlace='), file);
  }
});