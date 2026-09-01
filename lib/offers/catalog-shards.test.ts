import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { buildGenerationArtifacts } from './build-generation-artifacts';
import {
  beginCatalogReadKeyCaptureForTests,
  getCatalogReadKeysForTests,
  resetRuntimeDatasetCacheForTests,
} from './load-runtime-dataset';
import { resetLoadOffersCacheForTests, loadOffers } from './load-offers';
import { writeJsonAtomic } from './write-runtime-catalog';
import {
  generationCatalogKey,
  generationCatalogShardKey,
  generationDetailsIndexKey,
  generationFilterOptionsKey,
} from './generation-paths';
import type { StoredOffer } from '../feeds/types/stored-offer';
import {
  excludeParkedProvidersFromStoredCatalog,
  isRuntimeCatalogActiveProvider,
  partitionStoredOffersByProvider,
} from './catalog-shards';
import { PRIJSVRIJ_PROVIDER_NAME } from '../search/presentable-price';

function baseOffer(overrides: Partial<StoredOffer> & Pick<StoredOffer, 'externalId' | 'provider'>): StoredOffer {
  return {
    hotelName: 'Hotel',
    country: 'Spanje',
    nights: 7,
    price: 400,
    deepLink: 'https://example.com/x',
    imageUrl: 'https://example.com/h.jpg',
    searchText: 'hotel spanje',
    flightIncluded: 'true',
    departureAirport: 'AMS',
    departureAirportCode: 'AMS',
    ...overrides,
  };
}

function corendon(): StoredOffer {
  return baseOffer({
    externalId: 'corendon-11721',
    provider: 'Corendon',
    hotelName: 'Corendon Test',
    deepLink: 'https://www.corendon.be/vakantie#11721.ALABEF.BRUAYT.171126.7-8-7.DZ-H',
    departureDate: '2026-11-17',
    boardType: 'All Inclusive',
  });
}

function sunweb(): StoredOffer {
  const landing =
    'https://www.sunweb.be/nl/vakantie/griekenland/kos/kos-stad/appartementen-bristol-seaview' +
    '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
    '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-09-26' +
    '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30';
  return baseOffer({
    externalId: 'sunweb-84012-2026-09-26-8-BRU-Logies',
    provider: 'Sunweb',
    hotelName: 'Sunweb Test',
    deepLink:
      'https://www.sunweb.be/nl/vakantie/reizen?tt=1393_1754875_511747_&r=' +
      encodeURIComponent(landing),
    departureDate: '2026-09-26',
    boardType: 'Logies',
    nights: 8,
  });
}

function eliza(): StoredOffer {
  return baseOffer({
    externalId: 'eliza-6270665',
    provider: 'Eliza was here',
    hotelName: 'Eliza Test',
    deepLink: 'https://www.elizawashere.be/x',
  });
}

function prijsvrij(): StoredOffer {
  return baseOffer({
    externalId: 'prijsvrij-12345-2026-08-20-8-400-LG',
    provider: PRIJSVRIJ_PROVIDER_NAME,
    hotelName: 'Prijsvrij Test',
    deepLink: 'https://www.prijsvrij.nl/x',
    departureDate: '2026-08-20',
    boardType: 'Logies',
    nights: 8,
  });
}

let previousRoot: string | undefined;
let previousOffers: string | undefined;
let tempDirs: string[] = [];

afterEach(() => {
  resetLoadOffersCacheForTests();
  resetRuntimeDatasetCacheForTests();
  if (previousRoot === undefined) {
    delete process.env.VACATIONWEB_GENERATION_ROOT;
  } else {
    process.env.VACATIONWEB_GENERATION_ROOT = previousRoot;
  }
  if (previousOffers === undefined) {
    delete process.env.VACATIONWEB_OFFERS_FILE;
  } else {
    process.env.VACATIONWEB_OFFERS_FILE = previousOffers;
  }
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

function writeShardedGeneration(
  root: string,
  offers: StoredOffer[],
  options: { omitPrijsvrijShardFile?: boolean; breakCorendonShard?: boolean } = {},
): ReturnType<typeof buildGenerationArtifacts> {
  const artifacts = buildGenerationArtifacts(offers, {}, new Date('2026-08-21T14:21:58.000Z'));
  writeJsonAtomic(path.join(root, 'current.json'), {
    schemaVersion: 1,
    generationId: artifacts.generationId,
    catalogKey: generationCatalogKey(artifacts.generationId),
    detailsPrefix: `generations/${artifacts.generationId}/details/`,
    filterOptionsKey: generationFilterOptionsKey(artifacts.generationId),
    updatedAt: '2026-08-21T14:21:58.000Z',
    catalogShards: artifacts.catalogShardPointers,
  });
  writeJsonAtomic(path.join(root, generationCatalogKey(artifacts.generationId)), artifacts.catalog);
  writeJsonAtomic(
    path.join(root, generationFilterOptionsKey(artifacts.generationId)),
    artifacts.filterOptions,
    true,
  );
  writeJsonAtomic(path.join(root, generationDetailsIndexKey(artifacts.generationId)), artifacts.detailsIndex);
  for (const shard of artifacts.catalogShards) {
    if (options.omitPrijsvrijShardFile && shard.provider === PRIJSVRIJ_PROVIDER_NAME) {
      continue;
    }
    if (options.breakCorendonShard && shard.provider === 'Corendon') {
      writeJsonAtomic(path.join(root, shard.key), { broken: true });
      continue;
    }
    writeJsonAtomic(path.join(root, shard.key), shard.offers);
  }
  for (const detail of artifacts.details) {
    const filePath = path.join(root, detail.key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, detail.body);
  }
  return artifacts;
}

test('partition keeps Prijsvrij reversible and active providers separate', () => {
  const offers = [corendon(), sunweb(), eliza(), prijsvrij()];
  const parts = partitionStoredOffersByProvider(offers);
  assert.equal(parts.get(PRIJSVRIJ_PROVIDER_NAME)?.length, 1);
  assert.equal(excludeParkedProvidersFromStoredCatalog(offers).length, 3);
  assert.equal(isRuntimeCatalogActiveProvider(PRIJSVRIJ_PROVIDER_NAME), false);
  assert.equal(isRuntimeCatalogActiveProvider('Corendon'), true);
});

test('pre-load exclusion: active shard load never reads prijsvrij shard key', async () => {
  previousRoot = process.env.VACATIONWEB_GENERATION_ROOT;
  previousOffers = process.env.VACATIONWEB_OFFERS_FILE;
  delete process.env.VACATIONWEB_OFFERS_FILE;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-shard-excl-'));
  tempDirs.push(root);
  process.env.VACATIONWEB_GENERATION_ROOT = root;

  const artifacts = writeShardedGeneration(root, [corendon(), sunweb(), eliza(), prijsvrij()], {
    omitPrijsvrijShardFile: true,
  });
  const prijsvrijKey = generationCatalogShardKey(artifacts.generationId, 'prijsvrij');
  assert.equal(fs.existsSync(path.join(root, prijsvrijKey)), false);

  beginCatalogReadKeyCaptureForTests();
  const offers = await loadOffers();
  const keys = getCatalogReadKeysForTests() ?? [];

  assert.ok(!keys.some((key) => key.includes('/shards/prijsvrij.json')));
  assert.ok(!keys.some((key) => key.endsWith('/catalog.json')));
  assert.ok(keys.some((key) => key.includes('/shards/corendon.json')));
  assert.ok(keys.some((key) => key.includes('/shards/sunweb.json')));
  assert.ok(keys.some((key) => key.includes('/shards/eliza.json')));
  assert.equal(offers.some((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME), false);
  assert.equal(offers.filter((offer) => offer.provider === 'Corendon').length, 1);
  assert.equal(offers.filter((offer) => offer.provider === 'Sunweb').length, 1);
  assert.equal(offers.filter((offer) => offer.provider === 'Eliza was here').length, 1);
});

test('active provider offers match full-catalog active subset (functional equality)', async () => {
  previousRoot = process.env.VACATIONWEB_GENERATION_ROOT;
  previousOffers = process.env.VACATIONWEB_OFFERS_FILE;
  delete process.env.VACATIONWEB_OFFERS_FILE;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-shard-eq-'));
  tempDirs.push(root);
  process.env.VACATIONWEB_GENERATION_ROOT = root;

  const source = [corendon(), sunweb(), eliza(), prijsvrij()];
  const artifacts = writeShardedGeneration(root, source);
  const expectedIds = new Set(
    artifacts.catalog
      .filter((offer) => isRuntimeCatalogActiveProvider(offer.provider))
      .map((offer) => offer.externalId),
  );

  const offers = await loadOffers();
  const gotIds = new Set(offers.map((offer) => offer.id));
  assert.deepEqual([...gotIds].sort(), [...expectedIds].sort());
  assert.equal(offers.some((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME), false);
  assert.equal(offers.length, expectedIds.size);
});

test('failing active shard does not silently drop the whole catalog', async () => {
  previousRoot = process.env.VACATIONWEB_GENERATION_ROOT;
  previousOffers = process.env.VACATIONWEB_OFFERS_FILE;
  delete process.env.VACATIONWEB_OFFERS_FILE;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-shard-partial-'));
  tempDirs.push(root);
  process.env.VACATIONWEB_GENERATION_ROOT = root;

  writeShardedGeneration(root, [corendon(), sunweb(), eliza()], { breakCorendonShard: true });

  const offers = await loadOffers();
  assert.ok(offers.length >= 2);
  assert.equal(offers.some((offer) => offer.provider === 'Corendon'), false);
  assert.ok(offers.some((offer) => offer.provider === 'Sunweb'));
  assert.ok(offers.some((offer) => offer.provider === 'Eliza was here'));
});

test('legacy monolithic catalog without shards still strips parked Prijsvrij', async () => {
  previousRoot = process.env.VACATIONWEB_GENERATION_ROOT;
  previousOffers = process.env.VACATIONWEB_OFFERS_FILE;
  delete process.env.VACATIONWEB_GENERATION_ROOT;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-shard-legacy-'));
  tempDirs.push(root);
  const catalogPath = path.join(root, 'offers.json');
  const artifacts = buildGenerationArtifacts(
    [corendon(), prijsvrij()],
    {},
    new Date('2026-08-21T14:21:58.000Z'),
  );
  writeJsonAtomic(catalogPath, artifacts.catalog);
  process.env.VACATIONWEB_OFFERS_FILE = catalogPath;

  const offers = await loadOffers();
  assert.equal(offers.length, 1);
  assert.equal(offers[0]?.provider, 'Corendon');
});
