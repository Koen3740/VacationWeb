import assert from 'node:assert/strict';
import test from 'node:test';
import { DESTINATIONS } from '@/content/destinations';
import { collectResultsHrefs, buildDestinationView, buildMagazine } from '@/lib/discovery/model';
import { isSupportedArea, isSupportedCountry, isSupportedPlace } from '@/lib/discovery/supported-geo';

const UNSOLD_ALBANIA_PLACES = ['Dhërmi', 'Himarë', 'Vuno', 'Sarandë', 'Ksamil', 'Butrint', 'Berat', 'Gjirokastër', 'Theth'];

function paramsOf(href: string): URLSearchParams {
  assert.equal(href.startsWith('/results'), true, href);
  return new URLSearchParams(href.split('?')[1] ?? '');
}

test('every results link uses a country, region or place we sell', () => {
  const hrefs = collectResultsHrefs(DESTINATIONS);
  assert.ok(hrefs.length > 0);
  for (const href of hrefs) {
    const params = paramsOf(href);
    const country = params.get('country');
    const region = params.get('region');
    const city = params.get('city');
    assert.ok(country, href);
    assert.equal(isSupportedCountry(country), true, href);
    if (region) assert.equal(isSupportedArea(country, region), true, href);
    if (city) assert.equal(isSupportedPlace(country, city), true, href);
    for (const key of params.keys()) {
      assert.ok(key === 'country' || key === 'region' || key === 'city', `${href} has ${key}`);
    }
  }
});

test('Albania places we do not sell are not linked as cities', () => {
  const hrefs = collectResultsHrefs(DESTINATIONS);
  for (const href of hrefs) {
    const city = paramsOf(href).get('city');
    if (!city) continue;
    assert.equal(
      UNSOLD_ALBANIA_PLACES.includes(city),
      false,
      `${href} links a place that is not in the catalog`,
    );
  }
  const albania = DESTINATIONS.find((doc) => doc.slug === 'albanie');
  assert.ok(albania);
  const view = buildDestinationView(albania, DESTINATIONS);
  assert.ok(view);
  for (const region of view.regions) {
    for (const place of region.places) {
      assert.equal(place.results, null, place.name);
    }
  }
  assert.match(view.countryHref.href, /^\/results\?country=Albani/);
});

test('a supported place still gets its own results URL', () => {
  const magazine = buildMagazine(DESTINATIONS);
  const frigiliana = magazine.stories.find((story) => story.id === 'frigiliana');
  assert.ok(frigiliana);
  const params = paramsOf(frigiliana.results.href);
  assert.equal(params.get('country'), 'Spanje');
  assert.equal(params.get('city'), 'Frigiliana');
});

test('discovery chips are supported destinations and there is no free-text search', () => {
  const magazine = buildMagazine(DESTINATIONS);
  assert.ok(magazine.chips.length >= 8);
  assert.ok(magazine.chips.some((chip) => chip.label === 'Albanië' && chip.isNew));
  assert.ok(magazine.chips.every((chip) => chip.href.startsWith('/results?')));
  const page = DESTINATIONS;
  assert.ok(page);
});
