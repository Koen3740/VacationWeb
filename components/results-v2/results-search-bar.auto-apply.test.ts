import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildResultsBarHref,
  stateFromUrl,
} from '@/components/results-v2/results-search-bar-utils';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('Results bar auto-applies parameter commits without a Zoeken CTA', () => {
  const resultsBar = readFileSync(join(ROOT, 'components/results-v2/results-search-bar.tsx'), 'utf8');
  const homeSearch = readFileSync(join(ROOT, 'components/home/home-search.tsx'), 'utf8');

  assert.equal(resultsBar.includes(">Zoeken<"), false);
  assert.equal(resultsBar.includes("'Zoeken'"), false);
  assert.equal(resultsBar.includes('"Zoeken"'), false);
  assert.ok(resultsBar.includes('applyBarState'));
  assert.ok(resultsBar.includes('router.replace'));
  assert.ok(resultsBar.includes('buildResultsBarHref'));
  assert.equal(resultsBar.includes('RESULTS_CTA'), false);

  // Homepage keeps an explicit search CTA.
  assert.ok(homeSearch.includes('Vakanties zoeken'));
  assert.ok(homeSearch.includes('router.push') || homeSearch.includes('startTransition'));
});

test('buildResultsBarHref preserves sort/filters and clears page on param change', () => {
  const current = new URLSearchParams(
    'adults=2&rooms=1&dob=,&country=Spanje&region=Canarische+Eilanden&sort=price&page=3&page1Ids=a,b&budgetMax=2000',
  );
  const state = stateFromUrl(current);
  state.selectedDurations = [8];

  const href = buildResultsBarHref(state, current, { liveQuery: `?${current.toString()}` });
  const params = new URLSearchParams(href.split('?')[1] || '');

  assert.equal(params.get('country'), 'Spanje');
  assert.equal(params.get('region'), 'Canarische Eilanden');
  assert.equal(params.get('sort'), 'price');
  assert.equal(params.get('budgetMax'), '2000');
  assert.equal(params.get('nights'), '8');
  assert.equal(params.get('page'), null);
  assert.equal(params.get('page1Ids'), 'a,b');
});

test('occupancy change clears page1Ids while keeping country/sort', () => {
  const current = new URLSearchParams(
    'adults=2&rooms=1&dob=,&country=Spanje&sort=value&page=2&page1Ids=keep-me',
  );
  const state = stateFromUrl(current);
  state.travelers = {
    travellers: [
      { id: 't-1', dateOfBirth: '1980-01-01' },
      { id: 't-2', dateOfBirth: '1982-01-01' },
      { id: 't-3', dateOfBirth: '2015-01-01' },
    ],
    roomCount: 1,
    roomAssignments: [0, 0, 0],
  };

  const href = buildResultsBarHref(state, current);
  const params = new URLSearchParams(href.split('?')[1] || '');
  assert.equal(params.get('country'), 'Spanje');
  assert.equal(params.get('sort'), 'value');
  assert.equal(params.get('page'), null);
  assert.equal(params.get('page1Ids'), null);
});

test('airport commit updates only departureAirport and resets page', () => {
  const current = new URLSearchParams(
    'adults=2&rooms=1&dob=,&country=Spanje&departureAirport=BRU&page=4&sort=price-desc',
  );
  const state = stateFromUrl(current);
  state.selectedDepartureAirports = ['AMS', 'EIN'];

  const href = buildResultsBarHref(state, current);
  const params = new URLSearchParams(href.split('?')[1] || '');
  assert.equal(params.get('departureAirport'), 'AMS,EIN');
  assert.equal(params.get('country'), 'Spanje');
  assert.equal(params.get('sort'), 'price-desc');
  assert.equal(params.get('page'), null);
});

test('duration and airport popups commit via onChange; travelers/departure apply on close', () => {
  const resultsBar = readFileSync(join(ROOT, 'components/results-v2/results-search-bar.tsx'), 'utf8');
  assert.match(resultsBar, /DurationPopup[\s\S]*onChange=\{\(next\) => \{[\s\S]*applyBarState/);
  assert.match(resultsBar, /DepartureAirportPopup[\s\S]*onChange=\{\(next\) => \{[\s\S]*applyBarState/);
  assert.match(resultsBar, /TravelersPopup[\s\S]*onClose=\{\(\) => \{[\s\S]*applyAfterPopupClose/);
  assert.match(resultsBar, /DeparturePeriodPopup[\s\S]*onClose=\{\(\) => \{[\s\S]*applyAfterPopupClose/);
});
