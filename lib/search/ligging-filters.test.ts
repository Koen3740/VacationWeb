import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { buildResultsBarHref, stateFromUrl } from '@/components/results-v2/results-search-bar-utils';
import { normalizeOffer } from '@/lib/feeds/canonical/normalize-offer';
import type { StoredOffer } from '@/lib/feeds/types/stored-offer';
import { applyHotelGeo, loadHotelGeoTable } from '@/lib/offers/hotel-geo';
import { hotelKeyFromOfferId } from '@/lib/offers/hotel-key';
import { FAST_FILTER_PARAMS } from '@/lib/search/filter-classification';
import { filterOffers } from '@/lib/search/filtering';
import { buildPricingRunKey } from '@/lib/search/live-pricing-admission';
import {
  LIGGING_PARAMS,
  offerMatchesLiggingFilters,
  parseBeachDistanceParam,
  parseCenterDistanceParam,
  serializeBeachDistanceParam,
  serializeCenterDistanceParam,
} from '@/lib/search/ligging-filters';
import { parseBeachLocationsParam } from '@/lib/search/location-filters';
import { buildResultsSearchQuery } from '@/lib/search/pagination';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import React from 'react';

// `cache` is a React server API; identity is enough for a pure key test.
(React as unknown as { cache?: unknown }).cache ??= <T>(fn: T) => fn;
async function stableKey(params: SearchParams): Promise<string> {
  const mod = await import('@/lib/search/prepared-results-request');
  return mod.stableFilterKeyForTests(params);
}

const DEEP_LINK =
  'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
  encodeURIComponent(
    'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-11-20',
  );

let seq = 0;
function offer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  seq += 1;
  return {
    id: `sunweb-${seq}-BRU-201126-8-LO`,
    provider: 'Sunweb',
    hotelName: `Hotel ${seq}`,
    destinationCountry: 'Spanje',
    nights: 8,
    price: 800,
    pricePerDay: 100,
    imageUrl: 'https://example.com/a.jpg',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    departureDate: '2026-11-20',
    deepLink: DEEP_LINK,
    ...overrides,
  };
}

function ids(offers: TravelOffer[], params: SearchParams): string[] {
  return filterOffers(offers, params).map((o) => o.id);
}

// ---- parse / serialise / roundtrip -------------------------------------------------------

test('parse: all five ligging params', () => {
  const p = parseSearchParams({
    coast: '1',
    urban: '1',
    rural: '1',
    centerDistance: 'in,lt500,ge1000',
    beachDistance: 'direct,lt250',
  });
  assert.equal(p.coast, true);
  assert.equal(p.urban, true);
  assert.equal(p.rural, true);
  assert.deepEqual(p.centerDistance, ['in', 'lt500', 'ge1000']);
  assert.deepEqual(p.beachDistance, ['direct', 'lt250']);
});

test('parse: absent, invalid and non-1 values are no filter', () => {
  const p = parseSearchParams({ coast: '0', urban: 'true', centerDistance: 'foo,lt150', beachDistance: 'in' });
  assert.equal(p.coast, undefined);
  assert.equal(p.urban, undefined);
  assert.equal(p.rural, undefined);
  assert.equal(p.centerDistance, undefined);
  assert.equal(p.beachDistance, undefined);
});

test('parse: tokens are per parameter (centre has `in`, strand has `direct`)', () => {
  assert.deepEqual(parseCenterDistanceParam('direct,in'), ['in']);
  assert.deepEqual(parseBeachDistanceParam('direct,in'), ['direct']);
});

test('parse: canonical order and de-duplication', () => {
  assert.deepEqual(parseCenterDistanceParam('ge1000,lt100,in,lt100'), ['in', 'lt100', 'ge1000']);
  assert.equal(serializeBeachDistanceParam(['lt500', 'direct']), 'direct,lt500');
  assert.equal(serializeCenterDistanceParam([]), undefined);
  assert.equal(serializeCenterDistanceParam(['bogus']), undefined);
});

test('roundtrip: params -> buildResultsSearchQuery -> parseSearchParams', () => {
  const source: SearchParams = {
    coast: true,
    urban: true,
    rural: true,
    centerDistance: ['in', 'lt250'],
    beachDistance: ['direct', 'ge1000'],
  };
  const query = buildResultsSearchQuery(source, 1);
  assert.equal(query.get('coast'), '1');
  assert.equal(query.get('urban'), '1');
  assert.equal(query.get('rural'), '1');
  assert.equal(query.get('centerDistance'), 'in,lt250');
  assert.equal(query.get('beachDistance'), 'direct,ge1000');
  const back = parseSearchParams(Object.fromEntries(query.entries()));
  assert.equal(back.coast, true);
  assert.equal(back.urban, true);
  assert.equal(back.rural, true);
  assert.deepEqual(back.centerDistance, ['in', 'lt250']);
  assert.deepEqual(back.beachDistance, ['direct', 'ge1000']);
});

test('buildResultsSearchQuery: nothing is written when no ligging filter is active', () => {
  const query = buildResultsSearchQuery({}, 1);
  for (const key of LIGGING_PARAMS) {
    assert.equal(query.has(key), false, key);
  }
});

// ---- filtering per filter ----------------------------------------------------------------

const KUST_NEAR = offer({ coastDistanceM: 0, settingClass: 30 });
const KUST_EDGE = offer({ coastDistanceM: 1000, settingClass: 12 });
const KUST_FAR = offer({ coastDistanceM: 1001, settingClass: 12 });
const KUST_UNKNOWN = offer({ settingClass: 23 });
const ALL = [KUST_NEAR, KUST_EDGE, KUST_FAR, KUST_UNKNOWN];

test('Kust alone: coast distance <= 1000 m; unknown drops out', () => {
  assert.deepEqual(ids(ALL, { coast: true }), [KUST_NEAR.id, KUST_EDGE.id]);
  assert.equal(ids(ALL, {}).length, 4);
});

const SMOD = [30, 23, 22, 21, 13, 12, 11, 10].map((settingClass) => offer({ settingClass }));
const SMOD_UNKNOWN = offer({});

test('Stedelijk alone: SMOD 30/23/22 only', () => {
  const result = filterOffers([...SMOD, SMOD_UNKNOWN], { urban: true });
  assert.deepEqual(result.map((o) => o.settingClass), [30, 23, 22]);
});

test('Landelijk alone: SMOD 13/12/11 only', () => {
  const result = filterOffers([...SMOD, SMOD_UNKNOWN], { rural: true });
  assert.deepEqual(result.map((o) => o.settingClass), [13, 12, 11]);
});

test('class 21, water 10 and unclassified offers are never urban or rural', () => {
  const rest = [offer({ settingClass: 21 }), offer({ settingClass: 10 }), offer({})];
  assert.equal(ids(rest, { urban: true }).length, 0);
  assert.equal(ids(rest, { rural: true }).length, 0);
});

test('Stedelijk + Landelijk = AND = empty', () => {
  assert.equal(ids([...SMOD, SMOD_UNKNOWN], { urban: true, rural: true }).length, 0);
});

const C = {
  in: offer({ centerIsIn: true }),
  inWithFarNumber: offer({ centerIsIn: true, centerDistanceM: 1500 }),
  m0: offer({ centerDistanceM: 0 }),
  m100: offer({ centerDistanceM: 100 }),
  m101: offer({ centerDistanceM: 101 }),
  m250: offer({ centerDistanceM: 250 }),
  m500: offer({ centerDistanceM: 500 }),
  m1000: offer({ centerDistanceM: 1000 }),
  m1001: offer({ centerDistanceM: 1001 }),
  m5000: offer({ centerDistanceM: 5000 }),
  unknown: offer({}),
};
const CENTERS = Object.values(C);
const idOf = (...keys: Array<keyof typeof C>) => keys.map((k) => C[k].id);

test('centre: `in` is literal in-centre only (not distance 0, not unknown)', () => {
  assert.deepEqual(ids(CENTERS, { centerDistance: ['in'] }), idOf('in', 'inWithFarNumber'));
});

test('centre: <N buckets are cumulative (0..N), `in` falls under each', () => {
  assert.deepEqual(ids(CENTERS, { centerDistance: ['lt100'] }), idOf('in', 'inWithFarNumber', 'm0', 'm100'));
  assert.deepEqual(
    ids(CENTERS, { centerDistance: ['lt250'] }),
    idOf('in', 'inWithFarNumber', 'm0', 'm100', 'm101', 'm250'),
  );
  assert.deepEqual(
    ids(CENTERS, { centerDistance: ['lt500'] }),
    idOf('in', 'inWithFarNumber', 'm0', 'm100', 'm101', 'm250', 'm500'),
  );
  assert.deepEqual(
    ids(CENTERS, { centerDistance: ['lt1000'] }),
    idOf('in', 'inWithFarNumber', 'm0', 'm100', 'm101', 'm250', 'm500', 'm1000'),
  );
});

test('centre: >=1 km is disjoint from <1 km (boundary 1000 is <1 km)', () => {
  assert.deepEqual(ids(CENTERS, { centerDistance: ['ge1000'] }), idOf('m1001', 'm5000'));
});

test('centre: unknown drops out whenever a centre filter is active; multi-select is the union', () => {
  assert.equal(ids(CENTERS, { centerDistance: ['in', 'ge1000'] }).includes(C.unknown.id), false);
  assert.deepEqual(
    ids(CENTERS, { centerDistance: ['in', 'ge1000'] }),
    idOf('in', 'inWithFarNumber', 'm1001', 'm5000'),
  );
  // union of cumulative buckets = the widest bucket
  assert.deepEqual(
    ids(CENTERS, { centerDistance: ['lt100', 'lt500'] }),
    ids(CENTERS, { centerDistance: ['lt500'] }),
  );
  assert.equal(ids(CENTERS, {}).length, CENTERS.length);
});

const B = {
  direct: offer({ beachDirect: true }),
  directWith80: offer({ beachDirect: true, beachDistanceM: 80 }),
  m50: offer({ beachDistanceM: 50 }),
  m100: offer({ beachDistanceM: 100 }),
  m200: offer({ beachDistanceM: 200 }),
  m500: offer({ beachDistanceM: 500 }),
  m1000: offer({ beachDistanceM: 1000 }),
  m2500: offer({ beachDistanceM: 2500 }),
  unknown: offer({}),
};
const BEACHES = Object.values(B);
const bid = (...keys: Array<keyof typeof B>) => keys.map((k) => B[k].id);

test('strand: `direct` is a separate value and is not <=100 m', () => {
  assert.deepEqual(ids(BEACHES, { beachDistance: ['direct'] }), bid('direct', 'directWith80'));
  assert.equal(ids(BEACHES, { beachDistance: ['lt100'] }).includes(B.direct.id), false);
});

test('strand: <N cumulative on the stated distance; >=1 km disjoint; unknown drops out', () => {
  assert.deepEqual(ids(BEACHES, { beachDistance: ['lt100'] }), bid('directWith80', 'm50', 'm100'));
  assert.deepEqual(ids(BEACHES, { beachDistance: ['lt250'] }), bid('directWith80', 'm50', 'm100', 'm200'));
  assert.deepEqual(
    ids(BEACHES, { beachDistance: ['lt1000'] }),
    bid('directWith80', 'm50', 'm100', 'm200', 'm500', 'm1000'),
  );
  assert.deepEqual(ids(BEACHES, { beachDistance: ['ge1000'] }), bid('m2500'));
  assert.equal(ids(BEACHES, { beachDistance: ['direct', 'lt100', 'ge1000'] }).includes(B.unknown.id), false);
  assert.deepEqual(
    ids(BEACHES, { beachDistance: ['direct', 'ge1000'] }),
    bid('direct', 'directWith80', 'm2500'),
  );
});

// ---- combinations -----------------------------------------------------------------------

test('Kust and Afstand tot strand are independent', () => {
  const a = offer({ coastDistanceM: 500, beachDistanceM: 3000 });
  const b = offer({ coastDistanceM: 5000, beachDirect: true });
  assert.deepEqual(ids([a, b], { coast: true }), [a.id]);
  assert.deepEqual(ids([a, b], { beachDistance: ['direct'] }), [b.id]);
  assert.deepEqual(ids([a, b], { coast: true, beachDistance: ['direct'] }), []);
  assert.deepEqual(ids([a, b], { coast: true, beachDistance: ['ge1000'] }), [a.id]);
});

test('combinations: kust+stedelijk, kust+centrum<500, strand+centrum+country', () => {
  const a = offer({ coastDistanceM: 200, settingClass: 30, centerDistanceM: 300, beachDistanceM: 150 });
  const b = offer({ coastDistanceM: 200, settingClass: 12, centerDistanceM: 300, beachDistanceM: 150 });
  const c = offer({ coastDistanceM: 200, settingClass: 30, centerDistanceM: 900 });
  const d = offer({ coastDistanceM: 200, settingClass: 30, centerDistanceM: 300, beachDistanceM: 150, destinationCountry: 'Turkije' });
  const all = [a, b, c, d];
  assert.deepEqual(ids(all, { coast: true, urban: true }), [a.id, c.id, d.id]);
  assert.deepEqual(ids(all, { coast: true, centerDistance: ['lt500'] }), [a.id, b.id, d.id]);
  assert.deepEqual(
    ids(all, { beachDistance: ['lt250'], centerDistance: ['lt500'], country: 'Spanje', countries: ['Spanje'] }),
    [a.id, b.id],
  );
  assert.deepEqual(ids(all, { urban: true, rural: true }), []);
  assert.equal(offerMatchesLiggingFilters(a, {}), true);
});

// ---- legacy compat ----------------------------------------------------------------------

test('legacy beachLocation/centerLocation still parse and filter unchanged', () => {
  const p = parseSearchParams({ beachLocation: 'direct,lt150', centerLocation: 'in,lt500' });
  assert.deepEqual(p.beachLocation, ['direct', 'lt150']);
  assert.deepEqual(p.centerLocation, ['in', 'lt500']);
  assert.equal(p.beachDistance, undefined);
  assert.equal(p.centerDistance, undefined);
  const q = buildResultsSearchQuery(p, 1);
  assert.equal(q.get('beachLocation'), 'direct,lt150');
  assert.equal(q.has('beachDistance'), false);
  // legacy alias lt100 -> lt150 stays legacy-only; new param keeps lt100
  assert.deepEqual(parseBeachLocationsParam('lt100'), ['lt150']);
  assert.deepEqual(parseBeachDistanceParam('lt100'), ['lt100']);
  const textOffer = offer({ searchText: 'ligging * aan het strand * op 300 meter van het strand' });
  assert.equal(filterOffers([textOffer], { beachLocation: ['direct'] }).length, 1);
  assert.equal(filterOffers([textOffer], { beachDistance: ['direct'] }).length, 0);
});

// ---- cache keys, fast params, preserve keys, URL persistence -----------------------------

test('stable filter key differs per ligging param and per value', async () => {
  const base = await stableKey({});
  const keys = new Set<string>([base]);
  for (const p of [
    { coast: true },
    { urban: true },
    { rural: true },
    { centerDistance: ['in'] },
    { centerDistance: ['lt100'] },
    { beachDistance: ['direct'] },
    { beachDistance: ['lt100'] },
    { coast: true, urban: true },
  ] satisfies SearchParams[]) {
    keys.add(await stableKey(p));
  }
  assert.equal(keys.size, 9);
  assert.equal(await stableKey({ coast: true }), await stableKey({ coast: true }));
});

test('FAST_FILTER_PARAMS contains the five ligging params', () => {
  for (const key of LIGGING_PARAMS) {
    assert.ok(FAST_FILTER_PARAMS.includes(key as never), key);
  }
});

test('URL persistence: params survive the search-bar href (dates, travelers change)', () => {
  const current = new URLSearchParams(
    'country=Spanje&coast=1&urban=1&rural=1&centerDistance=in,lt500&beachDistance=direct,lt250&sort=price&budgetMax=900',
  );
  const state = stateFromUrl(current);
  const href = buildResultsBarHref({ ...state, selectedDurations: [8] }, current);
  const out = new URLSearchParams(href.split('?')[1]);
  assert.equal(out.get('coast'), '1');
  assert.equal(out.get('urban'), '1');
  assert.equal(out.get('rural'), '1');
  assert.equal(out.get('centerDistance'), 'in,lt500');
  assert.equal(out.get('beachDistance'), 'direct,lt250');
  assert.equal(out.get('sort'), 'price');
  assert.equal(out.get('budgetMax'), '900');
});

test('URL persistence: page/sort/budget links built from parsed params keep the ligging params', () => {
  const parsed = parseSearchParams({ coast: '1', centerDistance: 'lt250', beachDistance: 'direct', sort: 'price', budgetMax: '900' });
  const page2 = buildResultsSearchQuery(parsed, 2);
  assert.equal(page2.get('page'), '2');
  assert.equal(page2.get('coast'), '1');
  assert.equal(page2.get('centerDistance'), 'lt250');
  assert.equal(page2.get('beachDistance'), 'direct');
  assert.equal(page2.get('sort'), 'price');
  const resorted = buildResultsSearchQuery({ ...parsed, sort: 'value' }, 1);
  assert.equal(resorted.get('coast'), '1');
  const rebudget = buildResultsSearchQuery({ ...parsed, budgetMax: 1200 }, 1);
  assert.equal(rebudget.get('beachDistance'), 'direct');
});

// ---- geo join and real catalogue ---------------------------------------------------------

test('hotel key: first two id segments', () => {
  assert.equal(hotelKeyFromOfferId('corendon-8143-BRUADB-081026-7-DEX'), 'corendon-8143');
  assert.equal(hotelKeyFromOfferId('eliza-39209'), 'eliza-39209');
  assert.equal(hotelKeyFromOfferId('x'), null);
});

function stored(externalId: string, extra: Partial<StoredOffer> = {}): StoredOffer {
  return { externalId, provider: 'Sunweb', hotelName: 'H', country: 'Spanje', nights: 8, price: 500, currency: 'EUR', ...extra } as StoredOffer;
}

test('applyHotelGeo: table join by hotel key, per-offer beach override, missing table = unknown, centre union', () => {
  const table = {
    schema: 1 as const,
    meta: {},
    hotels: { 'sunweb-1': { s: 30, c: 50, bm: 300 }, 'sunweb-2': { s: 21 } },
    offers: { 'sunweb-2-A': { bd: 1 as const } },
  };
  const out = applyHotelGeo(
    [
      stored('sunweb-1-A', { centerDistanceM: 400 }),
      stored('sunweb-1-B'),
      stored('sunweb-2-A'),
      stored('sunweb-2-B'),
      stored('sunweb-3-A'),
    ],
    table,
  ).offers;
  assert.deepEqual(
    out.map((o) => [o.settingClass, o.coastDistanceM, o.beachDistanceM, o.beachDirect, o.centerDistanceM]),
    [
      [30, 50, 300, undefined, 400],
      [30, 50, 300, undefined, 400],
      [21, undefined, undefined, true, undefined],
      [21, undefined, undefined, undefined, undefined],
      [undefined, undefined, undefined, undefined, undefined],
    ],
  );
  const none = applyHotelGeo([stored('sunweb-1-A')], null).offers[0];
  assert.equal(none.settingClass, undefined);
});

test('applyHotelGeo: conflicting centre numbers within one hotel are not propagated', () => {
  const out = applyHotelGeo(
    [stored('sunweb-9-A', { centerDistanceM: 100 }), stored('sunweb-9-B', { centerDistanceM: 900 }), stored('sunweb-9-C')],
    null,
  );
  assert.equal(out.offers[2].centerDistanceM, undefined);
  assert.equal(out.stats.hotelsWithConflictingCenter, 1);
});

const TABLE = loadHotelGeoTable();
const OFFERS_FILE = path.join(process.cwd(), 'data', 'offers.json');

test('real catalogue + derived table: urban 3239, rural 2938, class 21 excluded, coast 6786', { skip: !TABLE || !fs.existsSync(OFFERS_FILE) }, () => {
  const raw = JSON.parse(fs.readFileSync(OFFERS_FILE, 'utf8')) as StoredOffer[];
  assert.equal(raw.length, 8238);
  const geo = applyHotelGeo(raw, TABLE).offers.map((o) => normalizeOffer(o));
  const count = (params: SearchParams) => geo.filter((o) => offerMatchesLiggingFilters(o, params)).length;
  assert.equal(count({ urban: true }), 3239);
  assert.equal(count({ rural: true }), 2938);
  assert.equal(count({ urban: true, rural: true }), 0);
  assert.equal(count({ coast: true }), 6786);
  const class21 = geo.filter((o) => o.settingClass === 21);
  assert.equal(class21.length, 1579);
  assert.equal(class21.filter((o) => offerMatchesLiggingFilters(o, { urban: true }) || offerMatchesLiggingFilters(o, { rural: true })).length, 0);
  assert.equal(geo.filter((o) => o.settingClass === undefined).length, 480);
  assert.equal(count({ beachDistance: ['direct'] }), 2211);
});

test('pricingRunKey differs per ligging filter (matchset changes => new pricing run)', () => {
  const base = buildPricingRunKey({ adults: 2, country: 'Spanje' } as SearchParams);
  const variants: SearchParams[] = [
    { adults: 2, country: 'Spanje', coast: true },
    { adults: 2, country: 'Spanje', urban: true },
    { adults: 2, country: 'Spanje', rural: true },
    { adults: 2, country: 'Spanje', centerDistance: ['lt500'] },
    { adults: 2, country: 'Spanje', beachDistance: ['direct'] },
  ];
  const keys = variants.map((v) => buildPricingRunKey(v));
  for (const key of keys) assert.notEqual(key, base);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(buildPricingRunKey({ adults: 2, country: 'Spanje' } as SearchParams), base);
});