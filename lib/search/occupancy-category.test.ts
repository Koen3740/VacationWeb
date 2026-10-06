import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatOccupancyCompositionNl,
  occupancyCategoryFromSearchParams,
  searchParamsOccupancyFromParty,
} from './occupancy-category';
import type { SearchParams } from '@/types/travel';

const TWO_ADULTS: SearchParams = {
  party: [
    { age: null, roomIndex: 0 },
    { age: null, roomIndex: 0 },
  ],
};

const TWO_ADULTS_ONE_CHILD: SearchParams = {
  rooms: 1,
  party: [
    { age: null, roomIndex: 0 },
    { age: null, roomIndex: 0 },
    { age: 12, roomIndex: 0 },
  ],
};

const TWO_ADULTS_TWO_CHILDREN_TWO_ROOMS: SearchParams = {
  adults: 4,
  rooms: 2,
  party: [
    { age: null, roomIndex: 0 },
    { age: null, roomIndex: 0 },
    { age: 12, roomIndex: 1 },
    { age: 8, roomIndex: 1 },
  ],
};

test('occupancy category: 2A / 1R', () => {
  assert.equal(occupancyCategoryFromSearchParams(TWO_ADULTS), '2A / 1R');
  assert.equal(occupancyCategoryFromSearchParams({ adults: 2, rooms: 1 }), '2A / 1R');
});

test('occupancy category: 2A / 2R', () => {
  assert.equal(
    occupancyCategoryFromSearchParams(
      {
        rooms: 2,
        party: [
          { age: null, roomIndex: 0 },
          { age: null, roomIndex: 1 },
        ],
      },
    ),
    '2A / 2R',
  );
});

test('occupancy category: 2A+1C / 1R', () => {
  assert.equal(occupancyCategoryFromSearchParams(TWO_ADULTS_ONE_CHILD), '2A+1C / 1R');
});

test('occupancy category: 2A+2C / 2R from child ages, not from adults=4', () => {
  assert.equal(
    occupancyCategoryFromSearchParams(TWO_ADULTS_TWO_CHILDREN_TWO_ROOMS),
    '2A+2C / 2R',
  );
});

test('occupancy category: invalid child ages fall back to nP / nR', () => {
  assert.equal(
    occupancyCategoryFromSearchParams(
      {
        rooms: 2,
        party: [
          { age: null, roomIndex: 0 },
          { age: null, roomIndex: 0 },
          { age: 40, roomIndex: 1 },
          { age: -1, roomIndex: 1 },
        ],
      },
    ),
    '4P / 2R',
  );
});

test('occupancy category never contains dates of birth or ages', () => {
  const category = occupancyCategoryFromSearchParams(TWO_ADULTS_TWO_CHILDREN_TWO_ROOMS);
  assert.equal(category.includes('1990-01-15'), false);
  assert.equal(category.includes('dateOfBirth'), false);
  assert.equal(category.includes('12'), false);
  assert.match(category, /^\d+[ACBP](?:\+\d+[ACB])* \/ \d+R$/);
});

test('presentation: 2 volwassenen', () => {
  assert.equal(
    formatOccupancyCompositionNl(TWO_ADULTS, { includeRooms: false }),
    '2 volwassenen',
  );
});

test('presentation: adults only includes rooms when requested', () => {
  assert.equal(
    formatOccupancyCompositionNl({ adults: 2, rooms: 1 }, { includeRooms: true }),
    '2 volwassenen • 1 kamer',
  );
});

test('presentation: 2 volwassenen + 1 kind', () => {
  assert.equal(
    formatOccupancyCompositionNl(TWO_ADULTS_ONE_CHILD, {}),
    '2 volwassenen • 1 kind • 1 kamer',
  );
});

test('presentation: 2 volwassenen + 2 kinderen + 2 kamers from child ages', () => {
  assert.equal(
    formatOccupancyCompositionNl(TWO_ADULTS_TWO_CHILDREN_TWO_ROOMS, {}),
    '2 volwassenen • 2 kinderen • 2 kamers',
  );
});

test('searchParams occupancy: unclassified 2 travellers / 1 room stays 2A', () => {
  const occupancy = searchParamsOccupancyFromParty(
    [
      { age: null, roomIndex: 0 },
      { age: null, roomIndex: 0 },
    ],
    1,
  );
  assert.equal(occupancy.adults, 2);
  assert.equal(occupancy.children, 0);
  assert.equal(occupancy.babies, 0);
  assert.equal(occupancy.rooms, 1);
  assert.equal(occupancy.party?.length, 2);
});

test('searchParams occupancy: 2A+1C from child ages, not from person count', () => {
  const occupancy = searchParamsOccupancyFromParty(TWO_ADULTS_ONE_CHILD.party ?? [], 1);
  assert.equal(occupancy.adults, 2);
  assert.equal(occupancy.children, 1);
  assert.equal(occupancy.babies, 0);
  assert.equal(occupancy.rooms, 1);
  assert.equal(occupancy.party?.length, 3);
  assert.deepEqual(
    occupancy.party?.map((traveller) => traveller.roomIndex),
    [0, 0, 0],
  );
});

test('searchParams occupancy: an invalid child age does not invent children=1 or adults=3', () => {
  const occupancy = searchParamsOccupancyFromParty(
    [
      { age: null, roomIndex: 0 },
      { age: null, roomIndex: 0 },
      { age: 18, roomIndex: 0 },
    ],
    1,
  );
  assert.equal(occupancy.adults, undefined);
  assert.equal(occupancy.children, undefined);
  assert.equal(occupancy.babies, undefined);
  assert.equal(occupancy.rooms, 1);
  assert.equal(occupancy.party?.length, 3);
});

test('searchParams occupancy: ages 0/1 are babies, 2/17 are children (DEC-019)', () => {
  const occupancy = searchParamsOccupancyFromParty(
    [
      { age: null, roomIndex: 0 },
      { age: null, roomIndex: 0 },
      { age: 0, roomIndex: 0 },
      { age: 1, roomIndex: 0 },
      { age: 2, roomIndex: 0 },
      { age: 17, roomIndex: 0 },
    ],
    1,
  );
  assert.deepEqual([occupancy.adults, occupancy.children, occupancy.babies], [2, 2, 2]);
});

test('presentation: multiple rooms does not relabel children as volwassenen', () => {
  const label = formatOccupancyCompositionNl(TWO_ADULTS_TWO_CHILDREN_TWO_ROOMS, {});
  assert.equal(label.includes('4 volwassenen'), false);
  assert.equal(label.includes('2 volwassenen'), true);
  assert.equal(label.includes('2 kinderen'), true);
  assert.equal(label.includes('2 kamers'), true);
});
