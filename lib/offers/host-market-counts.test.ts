/**
 * SUB 33D addendum — host-facing counts outside Results follow the market universe
 * (homepage, /search, destination popup, /bestemmingen, total label).
 * [REAL-SAMPLE]: 26 real catalog offers (data/offers.json, import 2026-10-01), stratified per
 *                TT campaign class, loaded through the real runtime loader (legacy local file).
 * [REAL]: the full catalog (runs only when data/offers.json or VACATIONWEB_OFFERS_FILE exists).
 * [CONSTRUCTED]: wiring checks on source and the no-market fallback.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { loadDestinationCountries } from '../../components/search/destination-popup/destination-popup-utils';
import { normalizeOffer } from '../feeds/canonical/normalize-offer';
import type { StoredOffer } from '../feeds/types/stored-offer';
import { isVacationWebFlightPackage } from './flight-package-eligibility';
import { loadFilterOptions } from './load-filter-options';
import { resetRuntimeDatasetCacheForTests } from './load-runtime-dataset';
import { loadActiveDestinationCountries } from './list-active-destination-countries';
import { loadTotalOffersLabel } from './load-total-offers-label';
import { loadHostFilterOptions, loadPresentedFilterOptions } from './present-active-filter-options';
import { offerSiteMarkets } from '../search/market-inventory';
import type { FilterOptions, TravelOffer } from '../../types/travel';

const ROOT = process.cwd();
const ENV = 'VACATIONWEB_OFFERS_FILE';
const originalEnv = process.env[ENV];
const BE_AIRPORTS = ['BRU', 'ANR', 'CRL', 'LGG', 'OST'];

function restoreEnv(): void {
  if (originalEnv === undefined) {
    delete process.env[ENV];
  } else {
    process.env[ENV] = originalEnv;
  }
  resetRuntimeDatasetCacheForTests();
}
after(restoreEnv);

async function withCatalogFile<T>(file: string, run: () => Promise<T>): Promise<T> {
  process.env[ENV] = file;
  resetRuntimeDatasetCacheForTests();
  try {
    return await run();
  } finally {
    restoreEnv();
  }
}

function countrySum(options: FilterOptions): number {
  return Object.values(options.countryCounts ?? {}).reduce((sum, count) => sum + count, 0);
}

/** Independent expectation: same loader filter, market from the TT site of the own click-outs. */
function expectedPerMarket(stored: StoredOffer[]): { be: TravelOffer[]; nl: TravelOffer[] } {
  const catalog = stored.map(normalizeOffer).filter(isVacationWebFlightPackage);
  return {
    be: catalog.filter((offer) => offerSiteMarkets(offer).includes('be')),
    nl: catalog.filter((offer) => offerSiteMarkets(offer).includes('nl')),
  };
}

const SAMPLE_GZ = path.join(ROOT, 'lib/offers/__fixtures__/sub33d-host-counts-sample-2026-10-01.json.gz');
const sampleRaw = gunzipSync(fs.readFileSync(SAMPLE_GZ)).toString('utf8');
const sampleStored = JSON.parse(sampleRaw) as StoredOffer[];
const sampleFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sub33d-host-counts-')), 'offers.json');
fs.writeFileSync(sampleFile, sampleRaw, 'utf8');

test('[REAL-SAMPLE] host counts per market: BE = Sunweb+Eliza+38103+dual, NL = 38108+dual', async () => {
  const expected = expectedPerMarket(sampleStored);
  assert.equal(expected.be.length, 20);
  assert.equal(expected.nl.length, 10);
  await withCatalogFile(sampleFile, async () => {
    const be = await loadHostFilterOptions('be');
    const nl = await loadHostFilterOptions('nl');
    const all = await loadPresentedFilterOptions();
    assert.equal(all.totalOffers, 26);
    assert.equal(be.totalOffers, 20);
    assert.equal(nl.totalOffers, 10);
    assert.equal(countrySum(be), 20);
    assert.equal(countrySum(nl), 10);
    // NL: only Corendon 38108 + dual offers; no Sunweb/Eliza country counts leak in.
    const nlProviders = new Set(expected.nl.map((offer) => offer.provider));
    assert.deepEqual([...nlProviders], ['Corendon']);
    for (const airport of BE_AIRPORTS) {
      assert.ok(!(nl.departureAirports ?? []).includes(airport), `NL lists BE airport ${airport}`);
    }
    const nlPopular = (nl.popularDestinations ?? []).reduce((sum, item) => sum + item.count, 0);
    assert.ok(nlPopular <= 10);
  });
});

test('[REAL-SAMPLE] total label, popup countries and /bestemmingen follow the market', async () => {
  await withCatalogFile(sampleFile, async () => {
    const nl = await loadHostFilterOptions('nl');
    const nlCountries = await loadActiveDestinationCountries('nl');
    const beCountries = await loadActiveDestinationCountries('be');
    assert.deepEqual(
      nlCountries,
      Object.keys(nl.countryCounts ?? {}).filter((name) => (nl.countryCounts ?? {})[name] > 0).sort((a, b) => a.localeCompare(b, 'nl')),
    );
    assert.ok(beCountries.length >= nlCountries.length);
    const popup = loadDestinationCountries(nl.countryCounts ?? {});
    assert.ok(popup.length > 0);
    for (const country of popup) {
      assert.ok(country.count > 0 && country.count === (nl.countryCounts ?? {})[country.name]);
    }
    assert.equal(popup.reduce((sum, country) => sum + country.count, 0) <= 10, true);
    assert.equal(await loadTotalOffersLabel('nl'), '0.000+ vakanties');
    assert.equal(await loadTotalOffersLabel('be'), '0.000+ vakanties');
  });
});

test('[CONSTRUCTED] no market host: homepage and /search keep the static build options', async () => {
  assert.deepEqual(await loadHostFilterOptions(undefined), loadFilterOptions());
});

test('[CONSTRUCTED] market options are cached per catalog array and market (same object)', async () => {
  await withCatalogFile(sampleFile, async () => {
    const first = await loadPresentedFilterOptions('nl');
    assert.equal(await loadPresentedFilterOptions('nl'), first);
    assert.notEqual(await loadPresentedFilterOptions('be'), first);
  });
});

test('[CONSTRUCTED] wiring: homepage, /search and /bestemmingen use the host market universe', () => {
  const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const file of ['app/page.tsx', 'app/search/page.tsx']) {
    const src = read(file);
    assert.match(src, /await loadHostFilterOptions\(requestSiteMarket\(\)\)/, file);
    assert.doesNotMatch(src, /loadFilterOptions\(\)/, file);
  }
  assert.match(read('app/bestemmingen/page.tsx'), /loadActiveDestinationCountries\(requestSiteMarket\(\)\)/);
  assert.match(read('lib/offers/present-active-filter-options.ts'), /siteMarketUniverse\(catalog, siteMarket\)/);
  assert.match(
    read('lib/search/request-site-market.ts'),
    /resolveSiteMarketFromHost\(requestHeaders\.get\('x-forwarded-host'\) \?\? requestHeaders\.get\('host'\)\)/,
  );
  // No host-facing app route reads the static union options directly anymore.
  const appFiles: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name)) appFiles.push(rel);
    }
  };
  walk('app');
  const direct = appFiles.filter((file) => /\bloadFilterOptions\(\)/.test(read(file)));
  assert.deepEqual(direct, []);
});

const CATALOG = process.env[ENV]?.trim() || path.join(ROOT, 'data', 'offers.json');
const catalogTest = fs.existsSync(CATALOG) ? test : test.skip;

catalogTest('[REAL] full catalog: homepage/search/popup counts per market', async () => {
  const stored = JSON.parse(fs.readFileSync(CATALOG, 'utf8')) as StoredOffer[];
  const expected = expectedPerMarket(stored);
  await withCatalogFile(CATALOG, async () => {
    const be = await loadHostFilterOptions('be');
    const nl = await loadHostFilterOptions('nl');
    assert.equal(be.totalOffers, expected.be.length);
    assert.equal(nl.totalOffers, expected.nl.length);
    assert.ok(nl.totalOffers! < be.totalOffers!);
    assert.equal(countrySum(nl), nl.totalOffers);
    assert.equal(countrySum(be), be.totalOffers);
    assert.ok(expected.nl.every((offer) => offer.provider === 'Corendon'));
    for (const airport of BE_AIRPORTS) {
      assert.ok(!(nl.departureAirports ?? []).includes(airport), `NL lists BE airport ${airport}`);
    }
    for (const country of loadDestinationCountries(nl.countryCounts ?? {})) {
      assert.equal(country.count, (nl.countryCounts ?? {})[country.name]);
    }
    console.log(
      `[REAL] host counts be=${be.totalOffers} nl=${nl.totalOffers} label be="${await loadTotalOffersLabel('be')}" nl="${await loadTotalOffersLabel('nl')}" countries be=${(await loadActiveDestinationCountries('be')).length} nl=${(await loadActiveDestinationCountries('nl')).length} airports nl=${(nl.departureAirports ?? []).join(',')}`,
    );
  });
});
