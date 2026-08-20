import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatOccupancyCompositionNl,
  occupancyCategoryFromSearchParams,
} from './occupancy-category';
import type { SearchParams } from '@/types/travel';

const TODAY = new Date(2026, 7, 18);

const TWO_ADULTS: SearchParams = {
  party: [
    { dateOfBirth: '1990-01-15', roomIndex: 0 },
    { dateOfBirth: '1988-03-03', roomIndex: 0 },
  ],
};

const TWO_ADULTS_ONE_CHILD: SearchParams = {
  rooms: 1,
  party: [
    { dateOfBirth: '1990-01-15', roomIndex: 0 },
    { dateOfBirth: '1988-03-03', roomIndex: 0 },
    { dateOfBirth: '2014-06-14', roomIndex: 0 },
  ],
};

const TWO_ADULTS_TWO_CHILDREN_TWO_ROOMS: SearchParams = {
  adults: 4,
  rooms: 2,
  party: [
    { dateOfBirth: '1990-01-15', roomIndex: 0 },
    { dateOfBirth: '1988-03-03', roomIndex: 0 },
    { dateOfBirth: '2014-06-14', roomIndex: 1 },
    { dateOfBirth: '2018-01-22', roomIndex: 1 },
  ],
};

test('occupancy category: 2A / 1R', () => {
  assert.equal(occupancyCategoryFromSearchParams(TWO_ADULTS, TODAY), '2A / 1R');
  assert.equal(occupancyCategoryFromSearchParams({ adults: 2, rooms: 1 }, TODAY), '2A / 1R');
});

test('occupancy category: 2A / 2R', () => {
  assert.equal(
    occupancyCategoryFromSearchParams(
      {
        rooms: 2,
        party: [
          { dateOfBirth: '1990-01-15', roomIndex: 0 },
          { dateOfBirth: '1988-03-03', roomIndex: 1 },
        ],
      },
      TODAY,
    ),
    '2A / 2R',
  );
});

test('occupancy category: 2A+1C / 1R', () => {
  assert.equal(occupancyCategoryFromSearchParams(TWO_ADULTS_ONE_CHILD, TODAY), '2A+1C / 1R');
});

test('occupancy category: 2A+2C / 2R from DOBs, not from adults=4', () => {
  assert.equal(
    occupancyCategoryFromSearchParams(TWO_ADULTS_TWO_CHILDREN_TWO_ROOMS, TODAY),
    '2A+2C / 2R',
  );
});

test('occupancy category: missing DOBs fall back to nP / nR', () => {
  assert.equal(
    occupancyCategoryFromSearchParams(
      {
        rooms: 2,
        party: [
          { dateOfBirth: null, roomIndex: 0 },
          { dateOfBirth: null, roomIndex: 0 },
          { dateOfBirth: null, roomIndex: 1 },
          { dateOfBirth: null, roomIndex: 1 },
        ],
      },
      TODAY,
    ),
    '4P / 2R',
  );
});

test('occupancy category never contains dates of birth', () => {
  const category = occupancyCategoryFromSearchParams(TWO_ADULTS_TWO_CHILDREN_TWO_ROOMS, TODAY);
  assert.equal(category.includes('1990-01-15'), false);
  assert.equal(category.includes('dateOfBirth'), false);
  assert.match(category, /^\d+[ACBP](?:\+\d+[ACB])* \/ \d+R$/);
});

test('presentation: 2 volwassenen', () => {
  assert.equal(
    formatOccupancyCompositionNl(TWO_ADULTS, { today: TODAY, includeRooms: false }),
    '2 volwassenen',
  );
});

test('presentation: adults only includes rooms when requested', () => {
  assert.equal(
    formatOccupancyCompositionNl({ adults: 2, rooms: 1 }, { today: TODAY, includeRooms: true }),
    '2 volwassenen • 1 kamer',
  );
});

test('presentation: 2 volwassenen + 1 kind', () => {
  assert.equal(
    formatOccupancyCompositionNl(TWO_ADULTS_ONE_CHILD, { today: TODAY }),
    '2 volwassenen • 1 kind • 1 kamer',
  );
});

test('presentation: 2 volwassenen + 2 kinderen + 2 kamers from DOBs', () => {
  assert.equal(
    formatOccupancyCompositionNl(TWO_ADULTS_TWO_CHILDREN_TWO_ROOMS, { today: TODAY }),
    '2 volwassenen • 2 kinderen • 2 kamers',
  );
});

test('presentation: multiple rooms does not relabel children as volwassenen', () => {
  const label = formatOccupancyCompositionNl(TWO_ADULTS_TWO_CHILDREN_TWO_ROOMS, { today: TODAY });
  assert.equal(label.includes('4 volwassenen'), false);
  assert.equal(label.includes('2 volwassenen'), true);
  assert.equal(label.includes('2 kinderen'), true);
  assert.equal(label.includes('2 kamers'), true);
});
