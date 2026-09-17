import assert from 'node:assert/strict';
import test from 'node:test';
import { homepageDiscoverGridClass } from './home-discover-grid';

test('Discover grid uses four columns today and five when a fifth destination exists', () => {
  assert.match(homepageDiscoverGridClass(4), /lg:grid-cols-4/);
  assert.doesNotMatch(homepageDiscoverGridClass(4), /lg:grid-cols-5/);
  assert.match(homepageDiscoverGridClass(5), /lg:grid-cols-5/);
});
