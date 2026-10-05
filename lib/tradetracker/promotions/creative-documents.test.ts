import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { TRADETRACKER_SOURCE } from './constants';
import {
  CREATIVE_IMAGE_MANIFEST_STORAGE_KEY,
  assertIsolatedCreativeDocumentKey,
  publishIsolatedCreativeDocument,
  readIsolatedCreativeDocument,
  selectedCreativeStorageKey,
} from './creative-documents';
import { loadCreativeImageIndex } from './creative-images';
import { loadSelectedCreativesForMarket } from './load-selected-creatives';
import type { SelectedTradeTrackerCreative, SelectedTradeTrackerCreativeSnapshot } from './types';
import { promotionalValidity } from './validity';

const AS_OF = Date.UTC(2026, 9, 5);

function creative(materialItemId: string): SelectedTradeTrackerCreative {
  return {
    id: `be|511873|${materialItemId}`,
    dedupeKey: `be|511873|${materialItemId}`,
    provider: 'Corendon',
    market: 'be',
    campaignId: '38103',
    campaignName: 'Corendon.be',
    campaignUrl: 'https://www.corendon.be/',
    affiliateSiteId: '511873',
    materialItemId,
    title: 'Banner3-lastminute',
    creativeType: 'banner_image',
    width: 300,
    height: 250,
    dimensionId: '18',
    isMobile: false,
    isCommon: true,
    relation: 'unique',
    validity: promotionalValidity({ startDate: null, endDate: null, asOfMs: AS_OF }),
    validFromDate: null,
    validToDate: null,
    discountFixed: null,
    discountVariable: null,
    voucherCode: null,
    description: null,
    conditions: null,
    embedCode: null,
    staticImageUrlHint: null,
    trackingClickUrlTemplate: `https://referral.corendon.be/c?c=38103&m=${materialItemId}&a=511873&r=&u=`,
    impressionUrlTemplate: null,
    referenceSupported: true,
    source: TRADETRACKER_SOURCE,
    sourceSnapshot: 'snapshot-be-511873.json',
    fetchedAt: '2026-10-05T14:56:36.417Z',
    displayable: true,
  };
}

function snapshot(materialItemId: string, market: 'be' | 'nl' = 'be'): SelectedTradeTrackerCreativeSnapshot {
  return {
    source: TRADETRACKER_SOURCE,
    selectedAt: '2026-10-05T14:56:36.417Z',
    snapshotIngestedAt: '2026-10-05T14:56:36.417Z',
    wsdlUrl: 'https://ws.tradetracker.com/soap-literal-wsi/affiliate?wsdl',
    market,
    scopedAffiliateSiteId: market === 'be' ? '511873' : '512226',
    sourceSnapshot: 'snapshot-be-511873.json',
    imageDelivery: 'metadata-and-embed-code',
    inputCount: 1,
    selectedCount: 1,
    excludedCount: 0,
    providers: { Corendon: 1 },
    dedupe: {
      key: 'market|affiliateSiteId|materialItemId',
      collapsed: 0,
      relations: { unique: 1, dimension_variant: 0, same_dimension_distinct_material: 0 },
    },
    exclusions: [],
    creatives: [creative(materialItemId)],
  };
}

test('document keys stay inside the isolated prefix', () => {
  assert.equal(selectedCreativeStorageKey('nl'), 'tradetracker-creatives/selected-nl-512226.json');
  assert.equal(selectedCreativeStorageKey('be'), 'tradetracker-creatives/selected-be-511873.json');
  assert.equal(CREATIVE_IMAGE_MANIFEST_STORAGE_KEY, 'tradetracker-creatives/creative-image-manifest.json');
  assert.doesNotThrow(() => assertIsolatedCreativeDocumentKey(selectedCreativeStorageKey('be')));
  for (const key of ['offers.json', 'current.json', 'live-price/v1/x', 'generations/current.json', 'tradetracker-creatives/images/be/511873/38103/1-1x1-abcdef0123456789.png']) {
    assert.throws(() => assertIsolatedCreativeDocumentKey(key), /isolated prefix/);
  }
});

test('selected creatives load from object storage when the local file is absent', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vw-creative-docs-'));
  const calls: string[] = [];
  const loaded = await loadSelectedCreativesForMarket('be', {
    root,
    readRemote: async (key) => {
      calls.push(key);
      return JSON.stringify(snapshot('2499693'));
    },
  });
  assert.deepEqual(calls, ['tradetracker-creatives/selected-be-511873.json']);
  assert.equal(loaded.status, 'ok');
  assert.equal(loaded.sourceFile, 'tradetracker-creatives/selected-be-511873.json');
  assert.deepEqual(loaded.creatives.map((item) => item.materialItemId), ['2499693']);
});

test('a local selected snapshot is used and object storage is not read', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vw-creative-docs-'));
  const dir = path.join(root, 'data', 'tradetracker-creatives');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'selected-be-511873.json'), JSON.stringify(snapshot('2499691')), 'utf8');
  let remoteCalls = 0;
  const loaded = await loadSelectedCreativesForMarket('be', {
    root,
    readRemote: async () => {
      remoteCalls += 1;
      return JSON.stringify(snapshot('2499700'));
    },
  });
  assert.equal(remoteCalls, 0);
  assert.equal(loaded.status, 'ok');
  assert.deepEqual(loaded.creatives.map((item) => item.materialItemId), ['2499691']);
});

test('a remote snapshot for the wrong market is invalid', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vw-creative-docs-'));
  const loaded = await loadSelectedCreativesForMarket('be', {
    root,
    readRemote: async () => JSON.stringify(snapshot('2499693', 'nl')),
  });
  assert.equal(loaded.status, 'invalid');
  assert.equal(loaded.creatives.length, 0);
});

test('the image manifest falls back to object storage and drops unsafe paths', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vw-creative-docs-'));
  const safe = '/aanbiedingen/creative-images/be/511873/38103/2499693-300x250-abcdef0123456789.png';
  const index = await loadCreativeImageIndex(root, {
    readRemote: async (key) => {
      assert.equal(key, CREATIVE_IMAGE_MANIFEST_STORAGE_KEY);
      return JSON.stringify({
        source: 'vacationweb-tradetracker-creative-images',
        generatedAt: '2026-10-05T14:56:36.417Z',
        storage: 'local+r2',
        entries: [
          {
            market: 'be',
            affiliateSiteId: '511873',
            campaignId: '38103',
            materialItemId: '2499693',
            width: 300,
            height: 250,
            publicPath: safe,
          },
          {
            market: 'be',
            affiliateSiteId: '511873',
            campaignId: '38103',
            materialItemId: '2499691',
            width: 1,
            height: 1,
            publicPath: 'https://referral.corendon.be/i?c=38103&m=2499691',
          },
        ],
      });
    },
  });
  assert.equal(index.get('be|511873|2499693')?.publicPath, safe);
  assert.equal(index.has('be|511873|2499691'), false);
});

test('publishing refuses catalog keys and stores the isolated document', async () => {
  const stored: string[] = [];
  const result = await publishIsolatedCreativeDocument(
    selectedCreativeStorageKey('nl'),
    '{"market":"nl"}',
    async (key, body) => {
      stored.push(`${key}:${body}`);
    },
  );
  assert.equal(result, 'stored');
  assert.deepEqual(stored, ['tradetracker-creatives/selected-nl-512226.json:{"market":"nl"}']);
  await assert.rejects(
    () => publishIsolatedCreativeDocument('offers.json', '{}', async () => undefined),
    /isolated prefix/,
  );
  const missing = await readIsolatedCreativeDocument(CREATIVE_IMAGE_MANIFEST_STORAGE_KEY, async () => null);
  assert.equal(missing, null);
});
