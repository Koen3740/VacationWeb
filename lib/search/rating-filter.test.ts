import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildResultsBarHref, stateFromUrl } from '@/components/results-v2/results-search-bar-utils';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import {
  offerMeetsRatingMin,
  parseRatingMinParam,
  ratingFilterChipLabel,
  ratingFilterOptionLabel,
} from '@/lib/search/rating-filter';

test('ratingMin accepts 9, 8, 7 and 6 and ignores anything else', () => {
  assert.equal(parseRatingMinParam('9'), 9);
  assert.equal(parseRatingMinParam('8'), 8);
  assert.equal(parseRatingMinParam('7'), 7);
  assert.equal(parseRatingMinParam('6'), 6);
  assert.equal(parseRatingMinParam(null), undefined);
  assert.equal(parseRatingMinParam(''), undefined);
  assert.equal(parseRatingMinParam('10'), undefined);
  assert.equal(parseRatingMinParam('5'), undefined);
  assert.equal(parseRatingMinParam('8.5'), undefined);
  assert.equal(parseSearchParams({ ratingMin: '8' }).ratingMin, 8);
  assert.equal(parseSearchParams({ ratingMin: '4' }).ratingMin, undefined);
  assert.equal(ratingFilterOptionLabel(8), '8 of hoger');
  assert.equal(ratingFilterChipLabel(8), 'Beoordeling 8+');
});

test('a minimum excludes a missing rating and keeps an equal score', () => {
  assert.equal(offerMeetsRatingMin({ rating: 8 }, 8), true);
  assert.equal(offerMeetsRatingMin({ rating: 7.9 }, 8), false);
  assert.equal(offerMeetsRatingMin({ rating: null }, 6), false);
  assert.equal(offerMeetsRatingMin({}, 6), false);
});

test('the search bar keeps ratingMin when dates or duration change', () => {
  const current = new URLSearchParams('adults=2&rooms=1&dob=,&ratingMin=8&country=Spanje&page1Ids=a');
  const state = stateFromUrl(current);
  state.selectedDurations = [7, 8];
  const href = buildResultsBarHref(state, current, { liveQuery: `?${current.toString()}` });
  const params = new URLSearchParams(href.split('?')[1] || '');
  assert.equal(params.get('ratingMin'), '8');
  assert.equal(params.get('nights'), '7,8');
});

test('results sidebar offers a single-choice Beoordeling group with facet counts', () => {
  const sidebar = readFileSync('components/results/filter-sidebar.tsx', 'utf8');
  const page = readFileSync('app/results/page.tsx', 'utf8');
  const facets = readFileSync('components/results/results-facet-counts.tsx', 'utf8');
  assert.match(sidebar, /title="Beoordeling"/);
  assert.match(sidebar, /role="radiogroup"/);
  assert.match(sidebar, /9 of hoger|ratingFilterOptionLabel/);
  assert.match(sidebar, /Toon alle/);
  assert.match(sidebar, /type="radio"/);
  assert.match(sidebar, /min-h-11/);
  assert.match(page, /RatingFacetCount/);
  assert.match(facets, /ratingMin: minimum/);
});
