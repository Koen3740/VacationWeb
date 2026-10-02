import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { normalizeOffer } from '@/lib/feeds/canonical/normalize-offer';
import type { StoredOffer } from '@/lib/feeds/types/stored-offer';
import { canonicalizeRegionName } from '@/lib/offers/canonical-region';
import { buildPricingRunKey } from '@/lib/search/live-pricing-admission';
import {
  DESTINATION_PARENTS,
  PLACE_ALIASES,
  createCityMatcher,
  createRegionMatcher,
  expandAreaLabels,
  normalizePlaceText,
  offerAreaLabels,
  placeGroupKey,
} from '@/lib/search/destination-mapping';
import {
  PRODUCT_NAME_GUARD_PATTERN,
  isProductDestinationValue,
  listProductDenyEntries,
} from '@/lib/search/destination-product-names';
import {
  UNRESOLVED_AMBIGUOUS_PLACES,
  buildDestinationDirectory,
  buildDestinationEntries,
  entryLabel,
  type DestinationDirectory,
} from '@/lib/search/destination-directory';
import { filterOffers } from '@/lib/search/filtering';
import React from 'react';
import { buildResultsSearchQuery } from '@/lib/search/pagination';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import type { SearchParams, TravelOffer } from '@/types/travel';
import directoryJson from '@/data/destination-directory.json';

// `cache` is a React server API; identity is enough for a pure key test (same approach as ligging-filters.test.ts).
(React as unknown as { cache?: unknown }).cache ??= <T>(fn: T) => fn;
async function stableKey(params: SearchParams): Promise<string> {
  const mod = await import('@/lib/search/prepared-results-request');
  return mod.stableFilterKeyForTests(params);
}

/* ------------------------------------------------------------------ fixtures (always run) */

function offer(
  id: string,
  fields: { country?: string; region?: string; province?: string; city?: string; provider?: string },
): TravelOffer {
  return {
    id,
    provider: fields.provider ?? 'Sunweb',
    hotelName: `Hotel ${id}`,
    destinationCountry: fields.country ?? 'Spanje',
    destinationRegion: fields.region,
    destinationProvince: fields.province,
    destinationCity: fields.city,
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    deepLink:
      (fields.provider ?? 'Sunweb') === 'Corendon'
        ? 'https://www.corendon.be/vakantie#5007.MLELC.BRUPMI.200826.8.DZI-U'
        : 'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
      encodeURIComponent(
        'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-20',
      ),
  };
}

const ids = (offers: TravelOffer[], params: SearchParams) => filterOffers(offers, params).map((o) => o.id).sort();

test('mapping: region matches region OR province (mirror hierarchy), whichever field carries the label', () => {
  const offers = [
    offer('a', { region: 'Balearen', province: 'Mallorca', city: 'Palma' }), // collective in region
    offer('b', { region: 'Mallorca', province: 'Balearen', city: 'Palma' }), // mirror
    offer('c', { region: 'Mallorca', city: 'Alcudia' }), // province empty
    offer('d', { region: 'Majorque' }), // provider language variant
    offer('e', { region: 'Ibiza', province: 'Balearen' }),
    offer('f', { region: 'Menorca' }),
  ];
  assert.deepEqual(ids(offers, { country: 'Spanje', region: 'Mallorca' }), ['a', 'b', 'c', 'd']);
  assert.deepEqual(ids(offers, { country: 'Spanje', region: 'Ibiza' }), ['e']);
  assert.deepEqual(ids(offers, { country: 'Spanje', region: 'Balearen' }), ['a', 'b', 'c', 'd', 'e', 'f']);
  // Majorque in the URL canonicalises to Mallorca (parse-search-params + REGION_ALIASES).
  assert.equal(canonicalizeRegionName('Majorque'), 'Mallorca');
  assert.deepEqual(ids(offers, { country: 'Spanje', region: 'Majorque' }), ['a', 'b', 'c', 'd']);
});

test('mapping: Canarische Eilanden = all islands + the Iles Canaries-only offers; islands stay disjoint', () => {
  const offers = [
    offer('t', { region: 'Canarische Eilanden', province: 'Tenerife' }),
    offer('g', { region: 'Gran Canaria', province: 'Canarische Eilanden' }),
    offer('l', { region: 'Lanzarote' }),
    offer('x', { region: '\u00cEles Canaries'.replace('\u00cE', '\u00ce'), province: '\u00celes Canaries', city: 'Costa Adeje' }),
  ];
  assert.deepEqual(ids(offers, { country: 'Spanje', region: 'Tenerife' }), ['t']);
  assert.deepEqual(ids(offers, { country: 'Spanje', region: 'Gran Canaria' }), ['g']);
  assert.deepEqual(ids(offers, { country: 'Spanje', region: 'Canarische Eilanden' }), ['g', 'l', 't', 'x']);
  assert.deepEqual(ids(offers, { country: 'Spanje', region: '\u00celes Canaries' }), ['g', 'l', 't', 'x']);
  // the Iles Canaries-only offer is NOT guessed to an island
  assert.equal(ids(offers, { country: 'Spanje', region: 'Tenerife' }).includes('x'), false);
});

test('mapping: city = spelling group (entity, accent, case, hyphen, period, explicit pairs)', () => {
  const offers = [
    offer('1', { city: 'Cala d&apos;Or' }),
    offer('2', { city: 'Cala d&#039;Or' }),
    offer('3', { city: "Cala d'Or" }),
    offer('4', { city: 'Playa del Ingles' }),
    offer('5', { city: 'Playa del Ingl\u00e9s' }),
    offer('6', { city: 'Calamandia' }),
  ];
  assert.deepEqual(ids(offers, { country: 'Spanje', city: "Cala d'Or" }), ['1', '2', '3']);
  assert.deepEqual(ids(offers, { country: 'Spanje', city: 'Cala d&apos;Or' }), ['1', '2', '3']);
  assert.deepEqual(ids(offers, { country: 'Spanje', city: 'Cala d&#039;Or' }), ['1', '2', '3']);
  assert.deepEqual(ids(offers, { country: 'Spanje', city: 'Playa del Ingles' }), ['4', '5']);
  assert.deepEqual(ids(offers, { country: 'Spanje', city: 'Playa del Ingl\u00e9s' }), ['4', '5']);
  assert.equal(placeGroupKey('Marsa Alam.'), placeGroupKey('Marsa Alam'));
  assert.equal(placeGroupKey('Magaluf - Calvia Beach'), placeGroupKey('Magaluf-Calvia Beach'));
  for (const [variant, target] of Object.entries(PLACE_ALIASES)) {
    assert.equal(placeGroupKey(variant), placeGroupKey(target), `${variant} -> ${target}`);
  }
  assert.equal(createCityMatcher('Lissabon')(offer('z', { country: 'Portugal', city: 'Lisbonne' })), true);
});

test('mapping: unknown region/city values keep the old exact behaviour', () => {
  const offers = [
    offer('a', { region: 'Nergensland', city: 'Ergens' }),
    offer('b', { region: 'Anders', province: 'Nergensland', city: 'Elders' }),
  ];
  // Unknown region: exact on destinationRegion (province is NOT consulted).
  assert.deepEqual(ids(offers, { country: 'Spanje', region: 'Nergensland' }), ['a']);
  assert.deepEqual(ids(offers, { country: 'Spanje', city: 'Ergens' }), ['a']);
  assert.deepEqual(ids(offers, { country: 'Spanje', city: 'Ergen' }), []);
  assert.deepEqual(ids(offers, { country: 'Spanje' }), ['a', 'b']);
});

test('mapping: homonyms need region+city (AND); same place name in two areas stays separable', () => {
  const offers = [
    offer('k1', { country: 'Griekenland', region: 'Zakynthos', city: 'Kalamaki' }),
    offer('k2', { country: 'Griekenland', region: 'Kreta', city: 'Kalamaki' }),
    offer('k3', { country: 'Griekenland', region: 'Cr\u00e8te', city: 'Kalamaki' }),
  ];
  assert.deepEqual(ids(offers, { country: 'Griekenland', region: 'Zakynthos', city: 'Kalamaki' }), ['k1']);
  assert.deepEqual(ids(offers, { country: 'Griekenland', region: 'Kreta', city: 'Kalamaki' }), ['k2', 'k3']);
  assert.deepEqual(ids(offers, { country: 'Griekenland', city: 'Kalamaki' }), ['k1', 'k2', 'k3']);
});

test('mapping: gebied=plaats-naam: region=Alanya is the area (R or P), city=Alanya is the place', () => {
  const offers = [
    offer('r1', { country: 'Turkije', region: 'Alanya', province: 'Turkse Riviera', city: 'Konakli' }),
    offer('r2', { country: 'Turkije', region: 'Turkse Riviera', province: 'Alanya', city: 'Oba' }),
    offer('p1', { country: 'Turkije', region: 'Turkse Riviera', province: 'Turkse Riviera', city: 'Alanya' }),
  ];
  assert.deepEqual(ids(offers, { country: 'Turkije', region: 'Alanya' }), ['r1', 'r2']);
  assert.deepEqual(ids(offers, { country: 'Turkije', city: 'Alanya' }), ['p1']);
});

test('mapping: provider independent - no provider/sourceProvider branch in the mapping code', () => {
  for (const rel of ['lib/search/destination-mapping.ts', 'lib/search/destination-directory.ts', 'lib/search/destination-product-names.ts']) {
    const code = fs.readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(/sourceProvider|\.provider\b|Corendon|Sunweb|Eliza/.test(code), false, rel);
  }
  // identical result for the same fields from different providers
  const a = offer('a', { region: 'Balearen', province: 'Ibiza', provider: 'Corendon' });
  const b = offer('b', { region: 'Balearen', province: 'Ibiza', provider: 'Eliza was here' });
  const c = offer('c', { region: 'Ibiza', provider: 'Sunweb' });
  assert.deepEqual(ids([a, b, c], { country: 'Spanje', region: 'Ibiza' }), ['a', 'b', 'c']);
});

test('mapping: collective destinations - parent contains children, children are disjoint, only catalog islands listed', () => {
  assert.deepEqual(DESTINATION_PARENTS.Balearen, ['Mallorca', 'Menorca', 'Ibiza']);
  assert.equal(DESTINATION_PARENTS.Balearen.includes('Formentera'), false, 'Formentera has 0 offers: no dead entry');
  assert.deepEqual([...expandAreaLabels('Balearen')].sort(), ['Balearen', 'Ibiza', 'Mallorca', 'Menorca']);
  assert.deepEqual([...expandAreaLabels('Mallorca')], ['Mallorca']);
  assert.deepEqual(offerAreaLabels('Mallorca', 'Balearen'), ['Mallorca', 'Balearen']);
  assert.deepEqual(offerAreaLabels('Mallorca', 'Mallorca'), ['Mallorca']);
  assert.deepEqual(offerAreaLabels(undefined, undefined), []);
});

test('mapping: popup choices write the existing URL contract; larger match sets change no key', async () => {
  const base: SearchParams = { country: 'Spanje', countries: ['Spanje'], nights: [8] };
  const keys = new Set(
    await Promise.all(['Mallorca', 'Balearen', 'Canarische Eilanden', 'Ibiza'].map((region) => stableKey({ ...base, region }))),
  );
  assert.equal(keys.size, 4, 'different region values give different stableFilterKeys');
  const pricing = new Set(
    ['Mallorca', 'Balearen', 'Canarische Eilanden'].map((region) => buildPricingRunKey({ ...base, region })),
  );
  assert.equal(pricing.size, 3, 'different region values give different pricingRunKeys');
  assert.notEqual(
    await stableKey({ ...base, region: 'Kreta', city: 'Kalamaki' }),
    await stableKey({ ...base, region: 'Zakynthos', city: 'Kalamaki' }),
  );
  // url -> params -> query round trip keeps region and city (page1Ids / pagination use the same builder)
  const params = parseSearchParams({ country: 'Griekenland', region: 'Zakynthos', city: 'Kalamaki' });
  const query = buildResultsSearchQuery(params, 2);
  assert.equal(query.get('region'), 'Zakynthos');
  assert.equal(query.get('city'), 'Kalamaki');
  assert.equal(query.get('country'), 'Griekenland');
  const mallorca = parseSearchParams({ country: 'Spanje', region: 'Majorque' });
  assert.equal(mallorca.region, 'Mallorca');
});

test('product names: exact deny-list of 43 values is the source of truth; real areas stay findable', () => {
  const entries = listProductDenyEntries();
  assert.equal(entries.length, 43);
  assert.equal(entries.filter((e) => e.field === 'city').length, 34);
  assert.equal(entries.filter((e) => e.field === 'region').length, 5);
  assert.equal(entries.filter((e) => e.field === 'province').length, 4);
  assert.equal(isProductDestinationValue('Griekenland', 'city', 'Bingoreizen Kreta'), true);
  assert.equal(isProductDestinationValue('Turkije', 'city', 'Turgutreis'), false);
  assert.equal(PRODUCT_NAME_GUARD_PATTERN.test('Turgutreis'), false);
  assert.equal(PRODUCT_NAME_GUARD_PATTERN.test('Bingoreizen Kreta'), true);
  // t333u: a multi-island tour is a product, not a place (3 Sunweb offers stay findable through region Santorini)
  assert.equal(isProductDestinationValue('Griekenland', 'city', 'Eilandhoppen Cycladen'), true);
  assert.equal(PRODUCT_NAME_GUARD_PATTERN.test('Eilandhoppen Cycladen'), true);
  // The product offer stays in its real area: region=Kreta still finds it.
  const offers = [offer('b', { country: 'Griekenland', region: 'Kreta', province: 'Kreta', city: 'Bingoreizen Kreta' })];
  assert.deepEqual(ids(offers, { country: 'Griekenland', region: 'Kreta' }), ['b']);
});

test('directory: product places never become destinations; product-only areas/countries are left out', () => {
  const dir = buildDestinationDirectory([
    { country: 'Griekenland', region: 'Kreta', province: 'Kreta', city: 'Bingoreizen Kreta' },
    { country: 'Griekenland', region: 'Kreta', city: 'Chania' },
    { country: 'Turkije', region: 'Blue Cruises', province: 'Blue Cruises', city: 'Blue Cruises Turkse Riviera' },
    { country: 'Egypte', region: 'Luxor', province: 'Luxor', city: 'Nijlcruise' },
    { country: 'Canada', region: 'Vancouver', province: 'Vancouver', city: 'Cruisereizen' },
  ]);
  assert.deepEqual(dir.countries, ['Griekenland']);
  assert.deepEqual(dir.areas, [{ c: 'Griekenland', n: 'Kreta' }]);
  assert.deepEqual(dir.places.map((p) => p.n), ['Chania']);
});

test('directory: Agia Pelagia and Agia Pelagia Spili stay two places; entity pair is one place', () => {
  const dir = buildDestinationDirectory([
    { country: 'Griekenland', region: 'Kreta', city: 'Agia Pelagia' },
    { country: 'Griekenland', region: 'Cr\u00e8te', city: 'Agia Pelagia' },
    { country: 'Griekenland', region: 'Kreta', city: 'Agia Pelagia Spili' },
    { country: 'Spanje', region: 'Balearen', province: 'Mallorca', city: 'Cala d&apos;Or' },
    { country: 'Spanje', region: 'Mallorca', province: 'Balearen', city: 'Cala d&#039;Or' },
  ]);
  assert.deepEqual(
    dir.places.map((p) => `${p.c}|${p.n}${p.a ? '|' + p.a : ''}`),
    ['Griekenland|Agia Pelagia', 'Griekenland|Agia Pelagia Spili', "Spanje|Cala d'Or"],
  );
  assert.equal(dir.places.some((p) => p.a), false, 'crete/kreta + balearen/mallorca are not homonyms');
  assert.equal(normalizePlaceText('Agia Pelagia') === normalizePlaceText('Agia Pelagia Spili'), false);
});

test('directory: entries label homonyms with a short suffix only; area=place equal is one entry', () => {
  const dir = buildDestinationDirectory([
    { country: 'Turkije', region: 'Turkse Riviera', province: 'Alanya', city: 'Alanya' },
    { country: 'Turkije', region: 'Alanya', province: 'Turkse Riviera', city: 'Konakli' },
    { country: 'Curacao', region: 'Willemstad', province: 'Willemstad', city: 'Willemstad' },
    { country: 'Griekenland', region: 'Zakynthos', city: 'Kalamaki' },
    { country: 'Griekenland', region: 'Kreta', city: 'Kalamaki' },
  ]);
  const labels = buildDestinationEntries(dir).map(entryLabel);
  assert.ok(labels.includes('Alanya \u2014 stad') && labels.includes('Alanya \u2014 regio'));
  assert.ok(labels.includes('Kalamaki \u2014 Kreta') && labels.includes('Kalamaki \u2014 Zakynthos'));
  assert.equal(labels.filter((l) => l.startsWith('Willemstad')).length, 1);
  assert.equal(new Set(labels).size, labels.length, 'labels are unique');
});

/* ------------------------------------------------------------------ catalog golden tests (need data/offers.json) */

const OFFERS_FILE = process.env.VACATIONWEB_OFFERS_FILE?.trim() || path.join(process.cwd(), 'data', 'offers.json');
const CATALOG_PRESENT = fs.existsSync(OFFERS_FILE);
const catalogTest = CATALOG_PRESENT ? test : test.skip;

let cachedCatalog: TravelOffer[] | null = null;
function catalog(): TravelOffer[] {
  if (!cachedCatalog) {
    const stored = JSON.parse(fs.readFileSync(OFFERS_FILE, 'utf8')) as StoredOffer[];
    cachedCatalog = stored.map(normalizeOffer);
  }
  return cachedCatalog;
}

function count(params: SearchParams): number {
  return filterOffers(catalog(), params).length;
}

const PROVIDER_OF = (o: TravelOffer) => o.provider;

catalogTest('golden (catalog 8.433): islands, collectives and places', () => {
  assert.equal(catalog().length, 8433, 'golden numbers are measured on catalog g20261001T132455Z-a8b4ff889c90');
  const golden: Array<[string, SearchParams, number]> = [
    ['Mallorca', { country: 'Spanje', region: 'Mallorca' }, 421],
    ['Ibiza', { country: 'Spanje', region: 'Ibiza' }, 172],
    ['Menorca', { country: 'Spanje', region: 'Menorca' }, 16],
    ['Tenerife', { country: 'Spanje', region: 'Tenerife' }, 321],
    ['Gran Canaria', { country: 'Spanje', region: 'Gran Canaria' }, 317],
    ['Lanzarote', { country: 'Spanje', region: 'Lanzarote' }, 209],
    ['Fuerteventura', { country: 'Spanje', region: 'Fuerteventura' }, 221],
    ['La Palma', { country: 'Spanje', region: 'La Palma' }, 22],
    ['Kreta', { country: 'Griekenland', region: 'Kreta' }, 850],
    ['Balearen', { country: 'Spanje', region: 'Balearen' }, 609],
    ['Canarische Eilanden', { country: 'Spanje', region: 'Canarische Eilanden' }, 1092],
    ['Agia Pelagia', { country: 'Griekenland', city: 'Agia Pelagia' }, 28],
    ['Tossa de Mar', { country: 'Spanje', city: 'Tossa de Mar' }, 2],
    ["Cala d'Or (apostrof)", { country: 'Spanje', city: "Cala d'Or" }, 47],
    ['Cala d&apos;Or (zelfde groep)', { country: 'Spanje', city: 'Cala d&apos;Or' }, 47],
    ['Cala d&#039;Or (zelfde groep)', { country: 'Spanje', city: 'Cala d&#039;Or' }, 47],
  ];
  for (const [name, params, expected] of golden) {
    assert.equal(count(params), expected, name);
  }
});

catalogTest('golden: island sets are disjoint; Balearen = sum of islands; Canarische = islands + 2 Iles Canaries-only', () => {
  const sets = (names: string[]) =>
    names.map((region) => new Set(filterOffers(catalog(), { country: 'Spanje', region }).map((o) => o.id)));
  const balearic = sets(['Mallorca', 'Ibiza', 'Menorca']);
  const canary = sets(['Tenerife', 'Gran Canaria', 'Lanzarote', 'Fuerteventura', 'La Palma']);
  for (const group of [balearic, canary]) {
    const union = new Set<string>();
    let sum = 0;
    for (const set of group) {
      sum += set.size;
      set.forEach((id) => union.add(id));
    }
    assert.equal(union.size, sum, 'no offer sits in two islands');
  }
  const balearen = count({ country: 'Spanje', region: 'Balearen' });
  assert.equal(balearen, balearic.reduce((acc, set) => acc + set.size, 0));
  const canarias = count({ country: 'Spanje', region: 'Canarische Eilanden' });
  assert.equal(canarias, canary.reduce((acc, set) => acc + set.size, 0) + 2);
  const onlyCollective = filterOffers(catalog(), { country: 'Spanje', region: 'Canarische Eilanden' }).filter(
    (o) => !canary.some((set) => set.has(o.id)),
  );
  assert.equal(onlyCollective.length, 2);
  assert.ok(onlyCollective.every((o) => canonicalizeRegionName(o.destinationRegion) === 'Canarische Eilanden'));
});

catalogTest('golden: provider split of the island destinations (Corendon / Sunweb / Eliza)', () => {
  const by = (params: SearchParams) => {
    const out: Record<string, number> = {};
    for (const o of filterOffers(catalog(), params)) out[PROVIDER_OF(o)] = (out[PROVIDER_OF(o)] ?? 0) + 1;
    return out;
  };
  assert.deepEqual(by({ country: 'Spanje', region: 'Balearen' }), { Corendon: 333, Sunweb: 224, 'Eliza was here': 52 });
});

catalogTest('golden: gebied=plaats-naam - Alanya/Side/Hurghada/Marmaris: regio = R-or-P, stad = city', () => {
  const alanyaArea = count({ country: 'Turkije', region: 'Alanya' });
  const alanyaPlace = count({ country: 'Turkije', city: 'Alanya' });
  assert.equal(alanyaArea, 341);
  assert.equal(alanyaPlace, 105);
  const union = new Set([
    ...filterOffers(catalog(), { country: 'Turkije', region: 'Alanya' }).map((o) => o.id),
    ...filterOffers(catalog(), { country: 'Turkije', city: 'Alanya' }).map((o) => o.id),
  ]);
  assert.equal(union.size, 446);
  for (const name of ['Side', 'Hurghada', 'Marmaris']) {
    const country = name === 'Hurghada' ? 'Egypte' : 'Turkije';
    assert.ok(count({ country, region: name }) > count({ country, city: name }) || name === 'Marmaris', name);
  }
});

catalogTest('golden: homonyms are separable with region+city', () => {
  const zak = count({ country: 'Griekenland', region: 'Zakynthos', city: 'Kalamaki' });
  const kreta = count({ country: 'Griekenland', region: 'Kreta', city: 'Kalamaki' });
  const all = count({ country: 'Griekenland', city: 'Kalamaki' });
  assert.ok(zak > 0 && kreta > 0 && zak + kreta <= all);
  assert.ok(count({ country: 'Griekenland', region: 'Kreta', city: 'Agios Nikolaos' }) > 0);
  assert.ok(count({ country: 'Griekenland', region: 'Zakynthos', city: 'Agios Nikolaos' }) > 0);
  assert.equal(count({ country: 'Griekenland', city: 'Agia Pelagia Spili' }), 1);
});

catalogTest('regression: country-only and old exact URLs still return the same sets', () => {
  assert.equal(count({ country: 'Spanje' }) > 2000, true);
  // an unknown region value keeps the exact old behaviour (0 offers, no guessing)
  assert.equal(count({ country: 'Spanje', region: 'Atlantis' }), 0);
  assert.equal(count({ country: 'Spanje', city: 'Atlantis' }), 0);
  // region value that exists only as a raw spelling resolves through the canonical alias
  assert.equal(count({ country: 'Griekenland', region: 'Cr\u00e8te' }), count({ country: 'Griekenland', region: 'Kreta' }));
  assert.equal(count({ country: 'Spanje', region: 'Majorque' }), count({ country: 'Spanje', region: 'Mallorca' }));
});

/* ------------------------------------------------------------------ guard tests (catalog) */

catalogTest('guard: stored destination-directory.json equals the directory built from the catalog', () => {
  const stored = JSON.parse(fs.readFileSync(OFFERS_FILE, 'utf8')) as StoredOffer[];
  const built = buildDestinationDirectory(
    stored.map((o) => ({ country: o.country, region: o.region, province: o.province, city: o.city })),
  );
  const current = directoryJson as unknown as DestinationDirectory;
  const diff = (a: string[], b: string[]) => a.filter((x) => !b.includes(x));
  const key = (d: DestinationDirectory) => [
    ...d.areas.map((a) => `A|${a.c}|${a.n}`),
    ...d.places.map((p) => `P|${p.c}|${p.n}|${p.a ?? ''}`),
    ...d.countries.map((c) => `C|${c}`),
  ];
  assert.deepEqual(diff(key(built), key(current)), [], 'NEW destinations in the catalog: run npx tsx scripts/build-destination-directory.ts and review');
  assert.deepEqual(diff(key(current), key(built)), [], 'REMOVED destinations: run npx tsx scripts/build-destination-directory.ts');
});

catalogTest('guard: no dead entries - every mapping/deny/alias value exists in the catalog', () => {
  const stored = JSON.parse(fs.readFileSync(OFFERS_FILE, 'utf8')) as StoredOffer[];
  const regionValues = new Set<string>();
  const cityValues = new Set<string>();
  const provinceValues = new Set<string>();
  for (const o of stored) {
    if (o.region) regionValues.add(`${o.country}|${o.region}`);
    if (o.province) provinceValues.add(`${o.country}|${o.province}`);
    if (o.city) cityValues.add(o.city);
  }
  const canonicalAreas = new Set<string>();
  for (const o of stored) {
    for (const v of [o.region, o.province]) if (v) canonicalAreas.add(canonicalizeRegionName(v));
  }
  for (const [parent, children] of Object.entries(DESTINATION_PARENTS)) {
    assert.ok(canonicalAreas.has(parent), `parent ${parent}`);
    for (const child of children) assert.ok(canonicalAreas.has(child), `child ${child}`);
  }
  for (const [variant, target] of Object.entries(PLACE_ALIASES)) {
    assert.ok(cityValues.has(variant), `alias variant ${variant}`);
    assert.ok(cityValues.has(target), `alias target ${target}`);
  }
  for (const entry of listProductDenyEntries()) {
    const set = entry.field === 'city' ? cityValues : entry.field === 'region' ? regionValues : provinceValues;
    const present =
      entry.field === 'city'
        ? [...set].includes(entry.value)
        : [...set].some((v) => v.endsWith(`|${entry.value}`));
    assert.ok(present, `deny ${entry.field} ${entry.country} ${entry.value}`);
  }
  // cat.1 provider-language aliases: every key exists in the catalog
  for (const raw of ['Majorque', 'Cr\u00e8te', 'Zakynthos (Zante)', 'Santorin', 'Mad\u00e8re', 'Chalcidique', 'Chypre', 'Mer Rouge', 'La Riviera Turque', 'C\u00f4te Eg\u00e9enne']) {
    assert.ok([...regionValues].some((v) => v.endsWith(`|${raw}`)), `cat.1 alias ${raw}`);
  }
  // unresolved cat.3 list: every entry still has more than one cluster or is still present
  const placeKeys = new Set(stored.filter((o) => o.city).map((o) => `${canonicalCountry(o.country)}|${placeGroupKey(o.city)}`));
  for (const entry of UNRESOLVED_AMBIGUOUS_PLACES) {
    assert.ok(placeKeys.has(entry), `unresolved ${entry}`);
  }
});

function canonicalCountry(country: string): string {
  const map: Record<string, string> = { 'Gr\u00e8ce': 'Griekenland', Espagne: 'Spanje', Turquie: 'Turkije', Maroc: 'Marokko', Chypre: 'Cyprus' };
  return map[country] ?? country;
}

catalogTest('guard: product-looking catalog values that are not on the deny-list are reported, not guessed', () => {
  const stored = JSON.parse(fs.readFileSync(OFFERS_FILE, 'utf8')) as StoredOffer[];
  const unreviewed = new Set<string>();
  for (const o of stored) {
    const country = canonicalCountry(o.country);
    for (const [field, value] of [['city', o.city], ['region', o.region], ['province', o.province]] as const) {
      if (value && PRODUCT_NAME_GUARD_PATTERN.test(value) && !isProductDestinationValue(country, field, value)) {
        unreviewed.add(`${field}|${country}|${value}`);
      }
    }
  }
  assert.deepEqual([...unreviewed], [], 'new product-like value in the catalog: review and add it to the deny-list');
});

catalogTest('guard: category 3 stays unmapped (no alias between Parga/Epirus, Pieria, Klassieke Kust, Costa del Sol/Andalusie)', () => {
  for (const [a, b] of [
    ['Parga', 'Epirus (Parga)'],
    ['Pieria', 'Pieria - Olympus Riviera'],
    ['Klassieke Kust', 'Egeïsche Kust'],
    ['Costa del Sol', 'Andalusië'],
    ['Costa de Lisboa', 'Lissabon'],
    ['Agadir', 'Atlantische Kust'],
    ['Centraal Marokko', 'Marrakech'],
  ]) {
    assert.notEqual(canonicalizeRegionName(a), canonicalizeRegionName(b), `${a} / ${b} must not be mapped`);
  }
  // Iles Canaries places are not guessed to an island
  const placeIds = filterOffers(catalog(), { country: 'Spanje', region: 'Tenerife', city: 'Costa Adeje' });
  assert.ok(placeIds.every((o) => canonicalizeRegionName(o.destinationRegion) === 'Tenerife' || canonicalizeRegionName(o.destinationProvince) === 'Tenerife'));
});

catalogTest('guard: popup index has one entry per destination, no product names, unique labels', () => {
  const entries = buildDestinationEntries(directoryJson as unknown as DestinationDirectory);
  const labels = entries.map(entryLabel);
  assert.equal(new Set(labels).size, labels.length);
  for (const label of labels) assert.equal(PRODUCT_NAME_GUARD_PATTERN.test(label), false, label);
  assert.ok(labels.includes('Balearen') && labels.includes('Canarische Eilanden'));
  assert.equal(labels.includes('Luxor'), false, 'Luxor consists only of Nijlcruise offers: not in the popup index');
  assert.equal(labels.some((l) => /Cala d(&apos;|&#039;)Or/.test(l)), false);
  assert.ok(labels.includes("Cala d'Or"));
  assert.equal(labels.filter((l) => l.startsWith('Cala d')).length, 1);
  assert.ok(labels.includes('Agia Pelagia') && labels.includes('Agia Pelagia Spili'));
  for (const homonym of ['Kalamaki \u2014 Kreta', 'Kalamaki \u2014 Zakynthos', 'Alanya \u2014 stad', 'Alanya \u2014 regio']) {
    assert.ok(labels.includes(homonym), homonym);
  }
});

catalogTest('guard: the 6 explicit pairs, 20 mechanical and 19 provider-composite place groups are exactly what the catalog shows', () => {
  const stored = JSON.parse(fs.readFileSync(OFFERS_FILE, 'utf8')) as StoredOffer[];
  const groups = new Map<string, Set<string>>();
  for (const o of stored) {
    if (!o.city) continue;
    const key = `${canonicalCountry(o.country)}|${placeGroupKey(o.city)}`;
    groups.set(key, new Set([...(groups.get(key) ?? []), o.city]));
  }
  const multi = [...groups.entries()].filter(([, v]) => v.size > 1);
  const explicit = Object.keys(PLACE_ALIASES).length;
  assert.equal(explicit, 6);
  const mechanical = multi.filter(([, variants]) => {
    const keys = new Set([...variants].map(normalizePlaceText));
    return keys.size === 1;
  });
  assert.equal(mechanical.length, 20);
  const compositeNames = new Set(
    (directoryJson as unknown as DestinationDirectory).composites.map((composite) => normalizePlaceText(composite.n)),
  );
  const compositeGroups = multi.filter(([, variants]) => [...variants].some((v) => compositeNames.has(normalizePlaceText(v))));
  assert.equal(compositeGroups.length, 19);
  assert.equal(multi.length, 20 + 6 + 19);
});

/* ------------------------------------------------------------------ t333u: provider composite place names */

test('directory: provider composite names - the repeated side is the parent; the place merges into the standalone place', () => {
  const kreta = { country: 'Griekenland', region: 'Kreta', province: 'Kreta' };
  const sunKreta = { country: 'Griekenland', region: 'Kreta' };
  const dir = buildDestinationDirectory([
    { ...kreta, city: 'Agia Marina' }, // Corendon style: plain place
    { ...kreta, city: 'Agia Marina' },
    { ...sunKreta, city: 'Chania - Agia Marina' }, // Sunweb style: "Parent - Place"
    { ...sunKreta, city: 'Chania Agia Marina' }, // Eliza style: the same text without hyphen
    { ...sunKreta, city: 'Chania - Almyrida' },
    { ...sunKreta, city: 'Chania - Daratso' },
    { ...sunKreta, city: 'Ierapetra - Agia Fotia' },
    { ...sunKreta, city: 'Ierapetra - Koutsounari' },
    { country: 'Griekenland', region: 'Chalkidiki', city: 'Afitos - Kassandra' }, // "Place - Parent"
    { country: 'Griekenland', region: 'Chalkidiki', city: 'Hanioti - Kassandra' },
    { country: 'Spanje', region: 'Costa del Sol', city: 'Marbella - San Pedro' }, // direction not provable
  ]);
  const names = dir.places.map((place) => place.n);
  assert.deepEqual(names, ['Afitos', 'Agia Fotia', 'Agia Marina', 'Almyrida', 'Daratso', 'Hanioti', 'Koutsounari', 'Marbella - San Pedro']);
  assert.equal(names.filter((name) => name === 'Agia Marina').length, 1, 'Agia Marina and Chania - Agia Marina are ONE destination');
  assert.deepEqual(
    dir.composites.map((composite) => `${composite.n} => ${composite.p}`),
    [
      'Afitos - Kassandra => Afitos',
      'Chania - Agia Marina => Agia Marina',
      'Chania - Almyrida => Almyrida',
      'Chania - Daratso => Daratso',
      'Hanioti - Kassandra => Hanioti',
      'Ierapetra - Agia Fotia => Agia Fotia',
      'Ierapetra - Koutsounari => Koutsounari',
    ],
  );
  assert.equal(dir.places.find((place) => place.n === 'Agia Marina')?.p, 'Chania');
  assert.equal(dir.places.find((place) => place.n === 'Afitos')?.p, 'Kassandra');
  const labels = buildDestinationEntries(dir).map(entryLabel);
  assert.equal(labels.includes('Chania - Agia Marina'), false);
  assert.equal(labels.includes('Agia Marina'), true);
  // unresolved (no repeated side): left as the provider wrote it, reported, never guessed
  assert.equal(dir.composites.some((composite) => composite.n === 'Marbella - San Pedro'), false);
});

test('directory: a composite whose place name is already a homonym stays its own destination (own URL value)', () => {
  const sunKreta = { country: 'Griekenland', region: 'Kreta' };
  const dir = buildDestinationDirectory([
    { country: 'Griekenland', region: 'Zakynthos', city: 'Kalamaki' },
    { country: 'Griekenland', region: 'Kreta', city: 'Kalamaki' },
    { country: 'Griekenland', region: 'Peloponnesos', city: 'Kalamaki' },
    { ...sunKreta, city: 'Chania - Kalamaki' },
    { ...sunKreta, city: 'Chania - Platanias' },
  ]);
  const entries = buildDestinationEntries(dir);
  const labels = entries.map(entryLabel).sort();
  assert.deepEqual(labels, [
    'Griekenland',
    'Kalamaki \u2014 Chania',
    'Kalamaki \u2014 Kreta',
    'Kalamaki \u2014 Peloponnesos',
    'Kalamaki \u2014 Zakynthos',
    'Kreta',
    'Platanias',
    'Peloponnesos',
    'Zakynthos',
  ].sort());
  const chania = entries.find((entry) => entryLabel(entry) === 'Kalamaki \u2014 Chania')!;
  assert.equal(chania.city, 'Chania - Kalamaki', 'the URL keeps working through the raw value');
  assert.equal(chania.region, undefined);
  assert.equal(dir.composites.some((composite) => composite.n === 'Chania - Kalamaki'), false);
});

test('directory: product-looking places (island hopping, bingo, cruises) never become destinations', () => {
  const dir = buildDestinationDirectory([
    { country: 'Griekenland', region: 'Santorini', city: 'Eilandhoppen Cycladen' },
    { country: 'Griekenland', region: 'Santorini', city: 'Kamari' },
    { country: 'Turkije', region: 'Turkse Riviera', city: 'Bingoreizen Marmaris' },
    { country: 'Turkije', region: 'Turkse Riviera', city: 'Marmaris' },
  ]);
  assert.deepEqual(dir.places.map((place) => place.n), ['Kamari', 'Marmaris']);
});

catalogTest('golden t333u: Agia Marina is ONE destination (Corendon + Sunweb + Eliza), no offer lost or added', () => {
  const stored = JSON.parse(fs.readFileSync(OFFERS_FILE, 'utf8')) as StoredOffer[];
  const agia = stored.filter((o) => o.country === 'Griekenland' && o.city && /^(Chania[ -]+)?Agia Marina$/i.test(o.city.replace(/\s+-\s+/, ' ')));
  assert.equal(agia.length, 15);
  assert.deepEqual(
    Object.fromEntries([...new Set(agia.map((o) => o.provider))].map((p) => [p, agia.filter((o) => o.provider === p).length])),
    { Corendon: 8, Sunweb: 6, 'Eliza was here': 1 },
  );
  assert.equal(count({ country: 'Griekenland', city: 'Agia Marina' }), 15);
  assert.equal(count({ country: 'Griekenland', region: 'Kreta', city: 'Agia Marina' }), 15);
  // an old bookmarked URL keeps working and now returns the whole place
  assert.equal(count({ country: 'Griekenland', city: 'Chania - Agia Marina' }), 15);
  const labels = buildDestinationEntries(directoryJson as unknown as DestinationDirectory).map(entryLabel);
  assert.equal(labels.filter((label) => /^(Chania - )?Agia Marina/.test(label)).join('|'), 'Agia Marina');
});

catalogTest('golden t333u: every resolved composite finds exactly standalone + composite offers through its place', () => {
  const stored = JSON.parse(fs.readFileSync(OFFERS_FILE, 'utf8')) as StoredOffer[];
  const composites = (directoryJson as unknown as DestinationDirectory).composites;
  assert.equal(composites.length, 30);
  for (const composite of composites) {
    const placeKey = normalizePlaceText(composite.p);
    const compositeKey = normalizePlaceText(composite.n);
    const expected = stored.filter((o) => {
      const city = o.city ? normalizePlaceText(o.city) : '';
      return canonicalCountry(o.country) === composite.c && (city === placeKey || city === compositeKey);
    }).length;
    assert.ok(expected > 0, composite.n);
    assert.equal(count({ country: composite.c, city: composite.p }), expected, composite.n);
  }
});

catalogTest('golden t333u: Kalamaki Chania stays separate; Kalamaki Kreta/Zakynthos unchanged; golden counts hold', () => {
  const zak = count({ country: 'Griekenland', region: 'Zakynthos', city: 'Kalamaki' });
  const kreta = count({ country: 'Griekenland', region: 'Kreta', city: 'Kalamaki' });
  assert.ok(zak > 0 && kreta > 0);
  const chania = count({ country: 'Griekenland', city: 'Chania - Kalamaki' });
  assert.equal(chania, 3);
  assert.equal(count({ country: 'Griekenland', city: 'Kalamaki' }) >= zak + kreta, true);
  const labels = buildDestinationEntries(directoryJson as unknown as DestinationDirectory).map(entryLabel);
  for (const label of ['Kalamaki \u2014 Chania', 'Kalamaki \u2014 Kreta', 'Kalamaki \u2014 Zakynthos', 'Kalamaki \u2014 Peloponnesos']) {
    assert.ok(labels.includes(label), label);
  }
  assert.equal(count({ country: 'Griekenland', region: 'Kreta' }), 850);
});

catalogTest('guard t334u: no provider-composite label "X - Y" in the popup at all; the 5 former ones are name-first', () => {
  const labels = buildDestinationEntries(directoryJson as unknown as DestinationDirectory).map(entryLabel);
  assert.deepEqual(labels.filter((label) => / - /.test(label)), []);
  for (const label of [
    'Guvercinlik \u2014 Bodrum',
    'San Pedro \u2014 Marbella',
    'Ouranoupoli \u2014 Athos',
    'Olympus Riviera \u2014 Pieria',
    'Caloura \u2014 Sao Miguel',
  ]) {
    assert.ok(labels.includes(label), label);
  }
  assert.equal(labels.includes('Magaluf-Calvia Beach'), true, '5th unresolved composite shows in its compact catalog spelling');
  assert.equal(labels.includes('Eilandhoppen Cycladen'), false);
});
