import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/** LIG-006: geo attribution (HotelGeo data contract v1.0 section 7) is rendered in the public footer. */
const footer = readFileSync('components/home/home-footer.tsx', 'utf8');
const homePage = readFileSync('app/page.tsx', 'utf8');

test('LIG-006: footer carries source and licence text for SMOD, OSM and GeoNames', () => {
  assert.ok(footer.includes('<GeoAttribution />'));
  assert.ok(footer.includes('GHS-SMOD R2023A'));
  assert.ok(footer.includes('Europese Commissie, JRC, GHSL'));
  assert.ok(footer.includes('https://creativecommons.org/licenses/by/4.0'));
  assert.ok(footer.includes('https://www.openstreetmap.org/copyright'));
  assert.ok(footer.includes('ODbL'));
  assert.ok(footer.includes('https://www.geonames.org'));
});

test('LIG-006: footer is rendered on the homepage', () => {
  assert.ok(homePage.includes('<HomeFooter />'));
});

test('LIG-006: attribution wording stays in line with the HotelGeo table metadata', () => {
  const geo = JSON.parse(readFileSync('data/geo/hotel-geo.v1.json', 'utf8')) as {
    meta: { smod: { licence: string; coastline: string; places: string } };
  };
  assert.match(geo.meta.smod.licence, /CC BY 4\.0/);
  assert.match(geo.meta.smod.coastline, /ODbL/);
  assert.match(geo.meta.smod.places, /GeoNames/);
});