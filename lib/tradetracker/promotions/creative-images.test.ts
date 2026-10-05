import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { TRADETRACKER_SOURCE } from './constants';
import { inspectCreativeImage } from './creative-image-bytes';
import { assertIsolatedCreativeImageKey } from './creative-image-path';
import {
  assertImpressionRequestUrl,
  CreativeImageFetchError,
  fetchImpressionImage,
  impressionUrlFromEmbed,
  ingestDisplayableCreativeImages,
  readLocalCreativeImage,
  resolveCreativeImageParts,
} from './creative-images';
import type { SelectedTradeTrackerCreative } from './types';
import { promotionalValidity } from './validity';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);
const AS_OF = Date.UTC(2026, 9, 5);

function creative(overrides: Partial<SelectedTradeTrackerCreative> = {}): SelectedTradeTrackerCreative {
  const market = overrides.market ?? 'be';
  const affiliateSiteId = overrides.affiliateSiteId ?? '511873';
  const materialItemId = overrides.materialItemId ?? '2499691';
  const impression =
    overrides.impressionUrlTemplate ??
    `https://referral.corendon.be/i?c=38103&m=${materialItemId}&a=511873&r=`;
  const click = `https://referral.corendon.be/c?c=38103&m=${materialItemId}&a=511873&r=`;
  return {
    id: `${market}|${affiliateSiteId}|${materialItemId}`,
    dedupeKey: `${market}|${affiliateSiteId}|${materialItemId}`,
    provider: 'Corendon',
    market,
    campaignId: '38103',
    campaignName: 'Corendon.be',
    campaignUrl: 'https://www.corendon.be/',
    affiliateSiteId,
    materialItemId,
    title: 'Banner1-lastminute',
    creativeType: 'banner_image',
    width: 1,
    height: 1,
    dimensionId: '1',
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
    embedCode: `<a href="${click}"><img src="${impression}" /></a>`,
    staticImageUrlHint: null,
    trackingClickUrlTemplate: click,
    impressionUrlTemplate: impression,
    referenceSupported: true,
    source: TRADETRACKER_SOURCE,
    sourceSnapshot: 'snapshot-be-511873.json',
    fetchedAt: '2026-10-05T14:56:36.417Z',
    displayable: true,
    ...overrides,
  };
}

test('image bytes must match the declared content type', () => {
  const png = inspectCreativeImage(PNG_1X1, 'image/png');
  assert.equal(png?.width, 1);
  assert.equal(png?.height, 1);
  assert.equal(png?.ext, 'png');
  assert.equal(inspectCreativeImage(PNG_1X1, 'image/jpeg'), null);
  assert.equal(inspectCreativeImage(PNG_1X1, 'text/html'), null);
  assert.equal(inspectCreativeImage(Buffer.from('not-an-image'), 'image/png'), null);
});

test('impression URLs are parsed from embed code and click URLs are refused', () => {
  const item = creative();
  assert.equal(impressionUrlFromEmbed(item.embedCode), item.impressionUrlTemplate);
  assert.equal(impressionUrlFromEmbed(null), null);
  assert.equal(
    impressionUrlFromEmbed('<a href="https://referral.corendon.be/c?c=1"><img src="https://referral.corendon.be/c?c=1" /></a>'),
    null,
  );
  assert.equal(impressionUrlFromEmbed('<img src="https://ti.tradetracker.net/x" />'), null);
  assert.throws(() => assertImpressionRequestUrl('https://referral.corendon.be/c?c=1'), CreativeImageFetchError);
  const withoutEmbed = creative({ embedCode: null, impressionUrlTemplate: 'https://referral.corendon.be/i?c=1' });
  assert.equal(impressionUrlFromEmbed(withoutEmbed.embedCode), null);
});

test('an image redirect is followed and a click redirect is not requested', async () => {
  const calls: string[] = [];
  const image = await fetchImpressionImage('https://referral.corendon.be/i?c=38103&m=1', async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      return {
        status: 302,
        location: 'https://cdn.example/banners/1.png',
        contentType: null,
        body: Buffer.alloc(0),
      };
    }
    return { status: 200, location: null, contentType: 'image/png', body: PNG_1X1 };
  });
  assert.equal(image.contentType, 'image/png');
  assert.equal(image.body.equals(PNG_1X1), true);
  assert.deepEqual(calls, ['https://referral.corendon.be/i?c=38103&m=1', 'https://cdn.example/banners/1.png']);
});

test('a redirect to /c is refused before the next request', async () => {
  const calls: string[] = [];
  await assert.rejects(
    () =>
      fetchImpressionImage('https://referral.corendon.be/i?c=38103&m=1', async (url) => {
        calls.push(url);
        return {
          status: 302,
          location: 'https://referral.corendon.be/c?c=38103&m=1',
          contentType: null,
          body: Buffer.alloc(0),
        };
      }),
    (error: unknown) => error instanceof CreativeImageFetchError && error.reason === 'refused_click_url',
  );
  assert.deepEqual(calls, ['https://referral.corendon.be/i?c=38103&m=1']);
});

test('ingest stores only displayable offers and never puts tracking URLs in the manifest', async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vw-creative-images-'));
  const fetched: string[] = [];
  const storedKeys: string[] = [];
  const publishedDocuments: string[] = [];
  const report = await ingestDisplayableCreativeImages({
    root,
    generatedAt: '2026-10-05T14:56:36.417Z',
    creatives: [
      creative(),
      creative({ materialItemId: '10', title: 'Banner10' }),
      creative({
        materialItemId: '11',
        title: 'Banner11-lastminute',
        embedCode: '<a href="https://referral.corendon.be/c?c=1"><img src="https://referral.corendon.be/c?c=1" /></a>',
        width: 1,
        height: 1,
      }),
      creative({ materialItemId: '12', title: 'Banner12-lastminute', width: 300, height: 250 }),
    ],
    fetchImpression: async (url) => {
      fetched.push(url);
      return { status: 200, location: null, contentType: 'image/png', body: PNG_1X1 };
    },
    putIsolatedBytes: async (key) => {
      storedKeys.push(key);
      assert.equal(key.startsWith('tradetracker-creatives/images/be/511873/38103/'), true);
      assert.equal(key.includes('offers'), false);
      assert.equal(key.includes('current.json'), false);
      assert.equal(key.includes('live-price'), false);
      assertIsolatedCreativeImageKey(key);
      return 'stored';
    },
    publishDocument: async (key, body) => {
      publishedDocuments.push(key);
      assert.equal(key, 'tradetracker-creatives/creative-image-manifest.json');
      assert.equal(body.includes('/i?'), false);
      assert.equal(body.includes('offers.json'), false);
      assert.equal(body.includes('current.json'), false);
      return 'stored';
    },
  });

  assert.equal(report.considered, 4);
  assert.equal(report.displayable, 3);
  assert.equal(report.excluded, 1);
  assert.equal(report.doubt, 0);
  assert.equal(report.stored, 1);
  assert.equal(report.failed, 2);
  assert.equal(report.storage, 'local+r2');
  assert.deepEqual(publishedDocuments, ['tradetracker-creatives/creative-image-manifest.json']);
  assert.equal(storedKeys.length, 1);
  assert.deepEqual(fetched, [
    'https://referral.corendon.be/i?c=38103&m=12&a=511873&r=',
    'https://referral.corendon.be/i?c=38103&m=2499691&a=511873&r=',
  ]);
  assert.equal(report.publicPaths[0]?.startsWith('/aanbiedingen/creative-images/be/511873/38103/2499691-1x1-'), true);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'data', 'tradetracker-creatives', 'creative-image-manifest.json'), 'utf8'),
  ) as { entries: Array<{ publicPath: string; storageKey: string }> };
  const manifestText = JSON.stringify(manifest);
  assert.equal(manifestText.includes('/i?'), false);
  assert.equal(manifestText.includes('referral.corendon'), false);
  assert.equal(manifestText.includes('/c?'), false);
  assert.equal(fs.existsSync(path.join(root, 'data', 'offers.json')), false);

  const again = await ingestDisplayableCreativeImages({
    root,
    generatedAt: '2026-10-05T14:56:36.417Z',
    creatives: [creative()],
    fetchImpression: async () => {
      throw new Error('second fetch');
    },
    putIsolatedBytes: async () => {
      throw new Error('second put');
    },
  });
  assert.equal(again.skipped, 1);
  assert.equal(again.stored, 0);
  assert.equal(again.failed, 0);

  const fileName = report.publicPaths[0]?.split('/').pop() ?? '';
  const local = readLocalCreativeImage(
    { market: 'be', affiliateSiteId: '511873', campaignId: '38103', fileName },
    root,
  );
  assert.equal(local?.contentType, 'image/png');
  assert.equal(resolveCreativeImageParts({ market: 'nl', site: '511873', campaignId: '38103', file: fileName }), null);
  assert.throws(() => assertIsolatedCreativeImageKey('offers.json'), /isolated prefix/);
  assert.throws(
    () => assertIsolatedCreativeImageKey(`tradetracker-creatives/images/nl/511873/38103/${fileName}`),
    /site does not match/,
  );
});

test('creative image ingest source does not touch catalog objects or /c', () => {
  const source = fs
    .readFileSync(path.join(process.cwd(), 'lib/tradetracker/promotions/creative-images.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.equal(source.includes('putOffersObject'), false);
  assert.equal(source.includes('getOffersObject'), false);
  assert.equal(source.includes('current.json'), false);
  assert.equal(source.includes('live-price'), false);
  assert.equal(/https?:\/\/[^'"\s]+\/c/.test(source), false);
});
