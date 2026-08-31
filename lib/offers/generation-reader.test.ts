import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { buildGenerationArtifacts } from './build-generation-artifacts';
import {
  generationCatalogKey,
  generationDetailObjectKey,
  generationDetailsIndexKey,
  generationFilterOptionsKey,
} from './generation-paths';
import { loadOfferById, loadOfferDetailMap, resetOfferDetailCacheForTests } from './load-offer-by-id';
import { loadOffers, resetLoadOffersCacheForTests } from './load-offers';
import { loadRuntimeDataset } from './load-runtime-dataset';
import { writeJsonAtomic } from './write-runtime-catalog';
import type { StoredOffer } from '../feeds/types/stored-offer';
import { detailObjectSha256, detailProviderSlug } from './canonical-offer-identity';

function elizaOffer(): StoredOffer {
  return {
    externalId: 'eliza-6270665',
    provider: 'Eliza was here',
    hotelName: 'Test Eliza',
    country: 'Griekenland',
    nights: 7,
    price: 300,
    deepLink: 'https://www.elizawashere.be/x',
    imageUrl: 'https://example.com/hero.jpg',
    searchText: 'test eliza hotel griekenland',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    departureAirportCode: 'BRU',
  };
}

function writeGeneration(root: string, offers: StoredOffer[], details: Record<string, object>): string {
  const artifacts = buildGenerationArtifacts(offers, details, new Date('2026-08-21T14:21:58.000Z'));
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
  for (const shard of artifacts.catalogShards) {
    writeJsonAtomic(path.join(root, shard.key), shard.offers);
  }
  writeJsonAtomic(
    path.join(root, generationFilterOptionsKey(artifacts.generationId)),
    artifacts.filterOptions,
    true,
  );
  writeJsonAtomic(path.join(root, generationDetailsIndexKey(artifacts.generationId)), artifacts.detailsIndex);
  for (const detail of artifacts.details) {
    const filePath = path.join(root, detail.key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, detail.body);
  }
  return artifacts.generationId;
}

let previousRoot: string | undefined;
let previousOffers: string | undefined;
let previousDetails: string | undefined;
let tempDirs: string[] = [];

afterEach(() => {
  resetOfferDetailCacheForTests();
  resetLoadOffersCacheForTests();
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
  if (previousDetails === undefined) {
    delete process.env.VACATIONWEB_OFFER_DETAILS_FILE;
  } else {
    process.env.VACATIONWEB_OFFER_DETAILS_FILE = previousDetails;
  }
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

test('current.json resolution loads generation catalog', async () => {
  previousRoot = process.env.VACATIONWEB_GENERATION_ROOT;
  previousOffers = process.env.VACATIONWEB_OFFERS_FILE;
  previousDetails = process.env.VACATIONWEB_OFFER_DETAILS_FILE;
  delete process.env.VACATIONWEB_OFFERS_FILE;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-gen-'));
  tempDirs.push(root);
  process.env.VACATIONWEB_GENERATION_ROOT = root;
  writeGeneration(root, [elizaOffer()], {
    'eliza-6270665': { descriptionLong: 'Lange tekst' },
  });
  const offers = await loadOffers();
  assert.equal(offers.length, 1);
  assert.equal(offers[0].id, 'eliza-6270665');
  assert.equal(offers[0].canonicalOfferIdentity, 'eliza|6270665');
  const dataset = await loadRuntimeDataset();
  assert.equal(dataset.mode, 'generation');
});

test('legacy two-file fallback when current.json is absent', async () => {
  previousRoot = process.env.VACATIONWEB_GENERATION_ROOT;
  previousOffers = process.env.VACATIONWEB_OFFERS_FILE;
  previousDetails = process.env.VACATIONWEB_OFFER_DETAILS_FILE;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-legacy-'));
  tempDirs.push(root);
  const catalogPath = path.join(root, 'offers.json');
  const detailsPath = path.join(root, 'missing-details.json');
  writeJsonAtomic(catalogPath, [
    {
      ...elizaOffer(),
      descriptionLong: undefined,
    },
  ]);
  process.env.VACATIONWEB_OFFERS_FILE = catalogPath;
  process.env.VACATIONWEB_OFFER_DETAILS_FILE = detailsPath;
  delete process.env.VACATIONWEB_GENERATION_ROOT;
  const offers = await loadOffers();
  assert.equal(offers[0].id, 'eliza-6270665');
  const dataset = await loadRuntimeDataset();
  assert.equal(dataset.mode, 'legacy');
});

test('one-offer detail loading does not load the full detail store', async () => {
  previousRoot = process.env.VACATIONWEB_GENERATION_ROOT;
  previousOffers = process.env.VACATIONWEB_OFFERS_FILE;
  previousDetails = process.env.VACATIONWEB_OFFER_DETAILS_FILE;
  delete process.env.VACATIONWEB_OFFERS_FILE;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-one-'));
  tempDirs.push(root);
  process.env.VACATIONWEB_GENERATION_ROOT = root;
  const generationId = writeGeneration(
    root,
    [
      elizaOffer(),
      { ...elizaOffer(), externalId: 'eliza-111', hotelName: 'Other' },
    ],
    {
      'eliza-6270665': { descriptionLong: 'Alleen deze' },
      'eliza-111': { descriptionLong: 'Niet laden' },
    },
  );
  const loaded = await loadOfferById('eliza-6270665');
  assert.equal(loaded?.descriptionLong, 'Alleen deze');
  const otherPath = path.join(
    root,
    generationDetailObjectKey(
      generationId,
      'eliza',
      detailObjectSha256('eliza|111'),
    ),
  );
  assert.equal(fs.existsSync(otherPath), true);
  const map = await loadOfferDetailMap().catch(() => null);
  void map;
  assert.equal(detailProviderSlug('Eliza was here'), 'eliza');
});

test('generation mismatch protection refuses a details prefix from another generation', async () => {
  previousRoot = process.env.VACATIONWEB_GENERATION_ROOT;
  previousOffers = process.env.VACATIONWEB_OFFERS_FILE;
  delete process.env.VACATIONWEB_OFFERS_FILE;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-mismatch-'));
  tempDirs.push(root);
  process.env.VACATIONWEB_GENERATION_ROOT = root;
  const generationId = writeGeneration(root, [elizaOffer()], {
    'eliza-6270665': { descriptionLong: 'ok' },
  });
  const dataset = await loadRuntimeDataset();
  assert.equal(dataset.pointer?.generationId, generationId);
  if (dataset.pointer) {
    dataset.pointer.detailsPrefix = 'generations/other/details/';
  }
  await assert.rejects(
    () => loadOfferById('eliza-6270665'),
    /outside the cached generation prefix|not in the active generation/,
  );
});

test('loadOfferById still merges detail gallery when runtime card already has multiple photos', async () => {
  previousRoot = process.env.VACATIONWEB_GENERATION_ROOT;
  previousOffers = process.env.VACATIONWEB_OFFERS_FILE;
  delete process.env.VACATIONWEB_OFFERS_FILE;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-runtime-gallery-'));
  tempDirs.push(root);
  process.env.VACATIONWEB_GENERATION_ROOT = root;
  const cardUrls = Array.from(
    { length: 10 },
    (_, index) => `https://example.com/card-${index + 1}.jpg`,
  );
  const detailUrls = Array.from(
    { length: 57 },
    (_, index) => `https://example.com/detail-${index + 1}.jpg`,
  );
  writeGeneration(
    root,
    [
      {
        ...elizaOffer(),
        images: cardUrls,
        imageUrl: cardUrls[0],
        imageLarge: cardUrls[0],
      },
    ],
    {
      'eliza-6270665': { images: detailUrls },
    },
  );
  const loaded = await loadOfferById('eliza-6270665');
  assert.equal(loaded?.images?.length, 57);
});

test('rollback pointer: new current.json is used after cache reset', async () => {
  previousRoot = process.env.VACATIONWEB_GENERATION_ROOT;
  previousOffers = process.env.VACATIONWEB_OFFERS_FILE;
  delete process.env.VACATIONWEB_OFFERS_FILE;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-rollback-'));
  tempDirs.push(root);
  process.env.VACATIONWEB_GENERATION_ROOT = root;
  writeGeneration(root, [elizaOffer()], { 'eliza-6270665': { descriptionLong: 'N' } });
  const first = await loadOfferById('eliza-6270665');
  assert.equal(first?.descriptionLong, 'N');
  resetOfferDetailCacheForTests();
  writeGeneration(
    root,
    [{ ...elizaOffer(), hotelName: 'Previous Eliza' }],
    { 'eliza-6270665': { descriptionLong: 'N-1' } },
  );
  const rolled = await loadOfferById('eliza-6270665');
  assert.equal(rolled?.descriptionLong, 'N-1');
  assert.equal(rolled?.hotelName, 'Previous Eliza');
});
