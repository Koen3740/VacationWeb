import assert from 'node:assert/strict';
import { test } from 'node:test';
import { livePriceCacheKey } from './results-live-price-cache';

function twoAdultsWithChild(age: number) {
  return {
    adults: 2,
    children: age >= 2 ? 1 : 0,
    babies: age < 2 ? 1 : 0,
    rooms: 1,
    party: [
      { age: null, roomIndex: 0 },
      { age: null, roomIndex: 0 },
      { age, roomIndex: 0 },
    ],
  };
}

test('livePriceCacheKey does not embed plaintext DOB or plaintext age', () => {
  const key = livePriceCacheKey('offer-1', twoAdultsWithChild(11));
  assert.equal(/\d{4}-\d{2}-\d{2}/.test(key), false);
  assert.equal(key.includes('1986-01-01'), false);
  assert.match(key, /p:(empty|[a-f0-9]{16})@0,(empty|[a-f0-9]{16})@0,(empty|[a-f0-9]{16})@0$/);
  assert.equal(key.includes('empty@0,empty@0'), true);
  assert.equal(key.includes('11'), false);
});

test('adult-only party keys are unchanged (no schema bump needed)', () => {
  const key = livePriceCacheKey('offer-1', {
    adults: 2,
    children: 0,
    babies: 0,
    rooms: 1,
    party: [
      { age: null, roomIndex: 0 },
      { age: null, roomIndex: 0 },
    ],
  });
  assert.match(key, /p:empty@0,empty@0$/);
});

test('2A + child 2 / 5 / 8 / 11 produce four different cache keys', () => {
  const keys = [2, 5, 8, 11].map((age) => livePriceCacheKey('offer-1', twoAdultsWithChild(age)));
  assert.equal(new Set(keys).size, 4);
});

test('baby age 0 and 1 differ from each other and from child age 2', () => {
  const keys = [0, 1, 2].map((age) => livePriceCacheKey('offer-1', twoAdultsWithChild(age)));
  assert.equal(new Set(keys).size, 3);
});

test('child age order inside a room does not change the cache key', () => {
  const mk = (ages: number[]) => ({
    adults: 2,
    children: 2,
    babies: 0,
    rooms: 1,
    party: [
      { age: null, roomIndex: 0 },
      { age: null, roomIndex: 0 },
      ...ages.map((age) => ({ age, roomIndex: 0 })),
    ],
  });
  assert.equal(livePriceCacheKey('offer-1', mk([5, 8])), livePriceCacheKey('offer-1', mk([8, 5])));
});

test('the same child age in a different room produces a different key', () => {
  const mk = (room: number) => ({
    adults: 2,
    children: 1,
    babies: 0,
    rooms: 2,
    party: [
      { age: null, roomIndex: 0 },
      { age: null, roomIndex: 1 },
      { age: 5, roomIndex: room },
    ],
  });
  assert.notEqual(livePriceCacheKey('offer-1', mk(0)), livePriceCacheKey('offer-1', mk(1)));
});