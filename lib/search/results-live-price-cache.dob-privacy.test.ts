import assert from 'node:assert/strict';
import { test } from 'node:test';
import { livePriceCacheKey } from './results-live-price-cache';

test('livePriceCacheKey does not embed plaintext DOB', () => {
  const key = livePriceCacheKey('offer-1', {
    adults: 2,
    children: 0,
    babies: 0,
    rooms: 1,
    party: [
      { dateOfBirth: '1990-01-15', roomIndex: 0 },
      { dateOfBirth: '1988-03-03', roomIndex: 0 },
    ],
  });
  assert.equal(key.includes('1990-01-15'), false);
  assert.equal(key.includes('1988-03-03'), false);
  assert.match(key, /p:[a-f0-9]{16}@0,[a-f0-9]{16}@0/);
});

test('different DOBs produce different cache keys', () => {
  const a = livePriceCacheKey('offer-1', {
    adults: 2,
    party: [
      { dateOfBirth: '1990-01-15', roomIndex: 0 },
      { dateOfBirth: '1988-03-03', roomIndex: 0 },
    ],
  });
  const b = livePriceCacheKey('offer-1', {
    adults: 2,
    party: [
      { dateOfBirth: '1991-01-15', roomIndex: 0 },
      { dateOfBirth: '1988-03-03', roomIndex: 0 },
    ],
  });
  assert.notEqual(a, b);
});
