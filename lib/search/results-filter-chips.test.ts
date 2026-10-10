import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listActiveResultFilterChips,
  searchParamsWithoutFilterChip,
  searchParamsWithoutSidebarFilters,
} from '@/lib/search/results-filter-chips';

test('active filter chips list sidebar filters and leave the search bar alone', () => {
  const params = new URLSearchParams(
    'adults=2&departureStart=2026-10-10&departureEnd=2026-10-24&nights=8&departureAirport=BRU&boardTypes=All+Inclusive&coast=1&sort=price',
  );
  const chips = listActiveResultFilterChips(params);
  assert.deepEqual(
    chips.map((chip) => chip.label),
    ['All Inclusive', 'Kust'],
  );
});

test('removing one chip keeps the other filters and the search', () => {
  const params = new URLSearchParams(
    'adults=2&nights=8&boardTypes=All+Inclusive,Logies&coast=1&country=Spanje',
  );
  const chips = listActiveResultFilterChips(params);
  const board = chips.find((chip) => chip.label === 'All Inclusive');
  assert.ok(board);

  const next = searchParamsWithoutFilterChip(params, board.id);
  assert.equal(next.get('boardTypes'), 'Logies');
  assert.equal(next.get('coast'), '1');
  assert.equal(next.get('country'), 'Spanje');
  assert.equal(next.get('adults'), '2');
  assert.equal(next.get('nights'), '8');
});

test('Wis filters clears sidebar filters and keeps dates, party, airport and sort', () => {
  const params = new URLSearchParams(
    'adults=2&rooms=1&departureStart=2026-10-10&departureAirport=BRU&sort=price&boardTypes=All+Inclusive&coast=1&budgetMax=1500&provider=Sunweb&hasCarRental=1&vacationTypes=Fly+%26+Drive',
  );
  const cleared = searchParamsWithoutSidebarFilters(params);
  assert.equal(cleared.get('boardTypes'), null);
  assert.equal(cleared.get('coast'), null);
  assert.equal(cleared.get('budgetMax'), null);
  assert.equal(cleared.get('provider'), null);
  assert.equal(cleared.get('hasCarRental'), null);
  assert.equal(cleared.get('vacationTypes'), null);
  assert.equal(cleared.get('adults'), '2');
  assert.equal(cleared.get('rooms'), '1');
  assert.equal(cleared.get('departureStart'), '2026-10-10');
  assert.equal(cleared.get('departureAirport'), 'BRU');
  assert.equal(cleared.get('sort'), 'price');
});

test('Roadtrip chip uses the sidebar label', () => {
  const chips = listActiveResultFilterChips(new URLSearchParams('vacationTypes=Fly+%26+Drive'));
  assert.equal(chips.length, 1);
  assert.equal(chips[0]?.label, 'Roadtrip (Fly & Drive)');
  const next = searchParamsWithoutFilterChip(new URLSearchParams('vacationTypes=Fly+%26+Drive'), chips[0]!.id);
  assert.equal(next.get('vacationTypes'), null);
});
