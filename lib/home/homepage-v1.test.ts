import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { HOMEPAGE_HERO_PHOTO } from '@/lib/home/homepage-hero-photo';
import {
  HOMEPAGE_DISCOVERY_HREF,
  HOMEPAGE_OFFERS_HREF,
  homepageDestinationTiles,
} from '@/lib/home/homepage-sections';

const ROOT = process.cwd();
const src = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

test('hero photo is one config entry: Cefalù, separate crops, Unsplash credit', () => {
  assert.equal(HOMEPAGE_HERO_PHOTO.id, 'cefalu');
  assert.equal(HOMEPAGE_HERO_PHOTO.name, 'Cefalù, Sicilië');
  assert.equal(HOMEPAGE_HERO_PHOTO.credit.unsplashUid, 'spC0l5B5068');
  assert.equal(HOMEPAGE_HERO_PHOTO.credit.unsplashPhotoId, 'photo-1597606904453-920ac2eb8efb');
  assert.equal(HOMEPAGE_HERO_PHOTO.credit.licence, 'Unsplash License');
  assert.equal(HOMEPAGE_HERO_PHOTO.credit.licenceUrl, 'https://unsplash.com/license');
  assert.equal(HOMEPAGE_HERO_PHOTO.desktop.objectPosition, '55% 50%');
  assert.notEqual(HOMEPAGE_HERO_PHOTO.desktop.src, HOMEPAGE_HERO_PHOTO.mobile.src);
  for (const file of [HOMEPAGE_HERO_PHOTO.desktop.src, HOMEPAGE_HERO_PHOTO.mobile.src]) {
    assert.equal(existsSync(join(ROOT, 'public', file)), true, file);
  }
  const photoModule = src('lib/home/homepage-hero-photo.ts');
  assert.equal(photoModule.includes('export const HOMEPAGE_HERO_PHOTO'), true);
  assert.equal((photoModule.match(/export const HOMEPAGE_HERO_PHOTO/g) ?? []).length, 1);
});

test('fixed photo layer, no background-attachment, reduced motion is respected', () => {
  const backdrop = src('components/home/home-hero-backdrop.tsx');
  const css = src('app/globals.css');
  const dim = src('components/home/home-photo-dim.tsx');
  assert.match(backdrop, /HOMEPAGE_HERO_PHOTO/);
  assert.match(backdrop, /max-width: 640px/);
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(dim, /prefers-reduced-motion/);
  for (const file of [
    'app/page.tsx',
    'app/globals.css',
    'components/home/home-hero-backdrop.tsx',
    'components/home/home-hero.tsx',
  ]) {
    assert.equal(src(file).includes('background-attachment'), false, file);
  }
  assert.match(src('app/page.tsx'), /<HomeHeroBackdrop/);
});

test('homepage tiles link to Discovery, Albania and supported results', () => {
  assert.equal(HOMEPAGE_DISCOVERY_HREF, '/ontdek');
  assert.equal(HOMEPAGE_OFFERS_HREF, '/aanbiedingen');
  const tiles = homepageDestinationTiles();
  assert.equal(tiles.length, 6);
  assert.equal(tiles[0]?.href, '/ontdek/albanie');
  assert.equal(tiles[0]?.kind, 'longread');
  const results = tiles.slice(1);
  assert.ok(results.every((tile) => tile.kind === 'results'));
  for (const tile of results) {
    const params = new URL(tile.href, 'https://vacationweb.test').searchParams;
    assert.match(tile.href, /^\/results\?/);
    assert.ok(params.get('country'), tile.id);
    assert.equal(existsSync(join(ROOT, 'public', tile.imageSrc)), true, tile.imageSrc);
  }
  const sicily = tiles.find((tile) => tile.id === 'sicilie');
  assert.equal(sicily && new URL(sicily.href, 'https://vacationweb.test').searchParams.get('region'), 'Sicilië');
  const teaser = src('components/home/home-discover-teaser.tsx');
  assert.match(teaser, /HOMEPAGE_DISCOVERY_HREF/);
  assert.match(teaser, /HOMEPAGE_OFFERS_HREF/);
  assert.match(teaser, /id="ontdekt"/);
});

test('homepage keeps search fields, anchors and does not invent sales claims', () => {
  const page = src('app/page.tsx');
  for (const tag of ['<HomeHero', '<HomeDiscoverTeaser', '<HomeInspirationBand', '<HomeValueSection', '<HomeFooter']) {
    assert.ok(page.includes(tag), tag);
  }
  assert.match(src('components/home/home-hero.tsx'), /id="hero"/);
  assert.match(src('components/home/home-inspiration-band.tsx'), /id="inspiratie"/);
  assert.match(src('components/home/home-value-section.tsx'), /id="value"/);
  const search = src('components/home/home-search.tsx');
  for (const needle of [
    'DestinationPopup',
    'DeparturePeriodPopup',
    'DurationPopup',
    'DepartureAirportPopup',
    'TravelersPopup',
    'buildResultsHref',
    'requestHomeLivePricePrefetch',
    'label={t.destinationLabel}',
    'label={t.whenLabel}',
    'label={t.durationLabel}',
    'label={t.airportLabel}',
    'label={t.travelersLabel}',
  ]) {
    assert.ok(search.includes(needle), needle);
  }
  const homepage = [
    'app/page.tsx',
    'components/home/home-hero.tsx',
    'components/home/home-search.tsx',
    'components/home/home-trust-strip.tsx',
    'components/home/home-discover-teaser.tsx',
    'components/home/home-value-section.tsx',
    'components/home/home-inspiration-band.tsx',
    'components/home/home-popular-destinations.tsx',
    'components/home/home-newsletter.tsx',
    'components/home/home-footer.tsx',
    'lib/i18n/chrome-copy.ts',
  ]
    .map(src)
    .join('\n');
  assert.equal(/geen verborgen kosten/i.test(homepage), false);
  assert.equal(/veilige betaling/i.test(homepage), false);
  assert.equal(/24\/7 ondersteuning/i.test(homepage), false);
});
