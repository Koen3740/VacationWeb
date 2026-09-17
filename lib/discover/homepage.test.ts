import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { HOMEPAGE_DISCOVER_SLOT_COUNT } from './constants';
import { DISCOVER_DESTINATIONS } from './destinations';
import { getHomepageDiscoverDestinations } from './homepage';
import type { DiscoverDestination } from './types';

test('central Discover dataset holds the four existing destinations only', () => {
  assert.equal(DISCOVER_DESTINATIONS.length, 4);
  assert.deepEqual(
    DISCOVER_DESTINATIONS.map((destination) => destination.destinationId),
    ['albania', 'sicily', 'crete', 'sardinia'],
  );
  assert.deepEqual(
    DISCOVER_DESTINATIONS.map((destination) => destination.name),
    ['Albanië', 'Sicilië', 'Kreta', 'Sardinië'],
  );
  assert.deepEqual(
    DISCOVER_DESTINATIONS.map((destination) => destination.teaser),
    [
      'De verborgen parel van Europa',
      'Waar de zon nooit verveelt',
      'Meer dan alleen stranden',
      'Wild, puur en onvergetelijk',
    ],
  );
  assert.equal(DISCOVER_DESTINATIONS[0]?.href, '/#hero');
  assert.equal(DISCOVER_DESTINATIONS[1]?.href, undefined);
});

test('homepage helper returns up to five active destinations from the source', () => {
  const homepage = getHomepageDiscoverDestinations();
  assert.ok(homepage.length <= HOMEPAGE_DISCOVER_SLOT_COUNT);
  assert.equal(homepage.length, 4);
  assert.equal(HOMEPAGE_DISCOVER_SLOT_COUNT, 5);
});

test('homepage helper skips draft destinations and does not invent extras', () => {
  const source: DiscoverDestination[] = [
    {
      destinationId: 'albania',
      name: 'Albanië',
      teaser: 'De verborgen parel van Europa',
      imageSrc: '/images/wow-ssot/discover-albania.jpg',
      status: 'draft',
    },
    {
      destinationId: 'sicily',
      name: 'Sicilië',
      teaser: 'Waar de zon nooit verveelt',
      imageSrc: '/images/wow-ssot/discover-sicily.jpg',
      status: 'active',
    },
  ];

  const homepage = getHomepageDiscoverDestinations(source);
  assert.deepEqual(
    homepage.map((destination) => destination.destinationId),
    ['sicily'],
  );
});

test('homepage helper is ready for a fifth destination added to data only', () => {
  const fifth: DiscoverDestination = {
    destinationId: 'fifth-slot',
    name: 'Fifth',
    teaser: 'Placeholder for capacity test only',
    imageSrc: '/images/hero.jpg',
    status: 'active',
  };
  const sixth: DiscoverDestination = {
    destinationId: 'sixth-slot',
    name: 'Sixth',
    teaser: 'Must not appear on homepage',
    imageSrc: '/images/hero.jpg',
    status: 'active',
  };

  const homepage = getHomepageDiscoverDestinations([...DISCOVER_DESTINATIONS, fifth, sixth]);
  assert.equal(homepage.length, 5);
  assert.equal(homepage[4]?.destinationId, 'fifth-slot');
  assert.equal(
    homepage.some((destination) => destination.destinationId === 'sixth-slot'),
    false,
  );
});

test('Discover teaser source imports the getter and does not own a CARDS array', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'components/home/home-discover-teaser.tsx'),
    'utf8',
  );
  assert.match(source, /getHomepageDiscoverDestinations/);
  assert.doesNotMatch(source, /const CARDS/);
});
