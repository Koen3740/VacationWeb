import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { GET } from '../../../app/api/cron/tradetracker-creatives/route';
import { TRADETRACKER_AFFILIATE_WSDL_URL, TRADETRACKER_CREATIVE_CANONICAL_SITE, TRADETRACKER_SOURCE } from './constants';
import { CREATIVE_IMAGE_MANIFEST_STORAGE_KEY, selectedCreativeStorageKey } from './creative-documents';
import { ingestDisplayableCreativeImages } from './creative-images';
import { loadAanbiedingenForMarket } from './load-aanbiedingen';
import { refreshTradeTrackerCreatives } from './refresh-creatives';
import type { CreativeIngestTarget } from './ingest-creatives';
import type { CreativeImageManifestEntry } from './creative-images';
import type { TradeTrackerBannerCreativeRecord, TradeTrackerCreativeSnapshot } from './types';
import { promotionalValidity } from './validity';

const FETCHED_AT = '2026-10-06T10:20:00.000Z';
const NL_KEY = selectedCreativeStorageKey('nl');
const BE_KEY = selectedCreativeStorageKey('be');

function creative(market: 'nl' | 'be'): TradeTrackerBannerCreativeRecord {
  const affiliateSiteId = TRADETRACKER_CREATIVE_CANONICAL_SITE[market];
  const campaignId = market === 'be' ? '38103' : '38108';
  const click = `https://referral.corendon.${market}/c?c=${campaignId}&m=55&a=${affiliateSiteId}&r=&u=`;
  const impression = `https://referral.corendon.${market}/i?c=${campaignId}&m=55&a=${affiliateSiteId}&r=`;
  return {
    source: TRADETRACKER_SOURCE,
    kind: 'banner_image',
    materialItemId: '55',
    name: 'Banner1',
    campaignId,
    campaignName: market === 'be' ? 'Corendon.be' : 'Corendon NL',
    campaignUrl: market === 'be' ? 'https://www.corendon.be/' : 'https://www.corendon.nl/',
    affiliateSiteId,
    market,
    width: 300,
    height: 250,
    dimensionId: '18',
    isMobile: false,
    isCommon: true,
    referenceSupported: true,
    description: null,
    conditions: null,
    validFromDate: null,
    validToDate: null,
    discountFixed: null,
    discountVariable: null,
    voucherCode: null,
    creationDate: null,
    modificationDate: null,
    status: null,
    embedCode: `<a href="${click}"><img src="${impression}" alt="" /></a>`,
    trackingClickUrlTemplate: click,
    impressionUrlTemplate: impression,
    staticImageUrlHint: null,
    validity: promotionalValidity({ startDate: null, endDate: null, asOfMs: Date.parse(FETCHED_AT) }),
    fetchedAt: FETCHED_AT,
    sourceMetadata: {},
  };
}

function snapshot(target: CreativeIngestTarget): TradeTrackerCreativeSnapshot {
  const item = creative(target.market);
  return {
    source: TRADETRACKER_SOURCE,
    ingestedAt: FETCHED_AT,
    wsdlUrl: TRADETRACKER_AFFILIATE_WSDL_URL,
    market: target.market,
    scopedAffiliateSiteId: target.affiliateSiteId,
    credentialScope: target.market,
    imageDelivery: 'metadata-and-embed-code',
    campaignIds: [...target.campaignIds],
    creatives: target.affiliateSiteId === TRADETRACKER_CREATIVE_CANONICAL_SITE[target.market] ? [item] : [],
    methodErrors: [],
    counts: {
      creatives: 1,
      campaignsRequested: target.campaignIds.length,
      methodErrors: 0,
      byCampaignId: { [target.campaignIds[0] ?? '0']: 1 },
    },
  };
}

function keptEntry(): CreativeImageManifestEntry {
  return {
    market: 'nl',
    affiliateSiteId: '512226',
    campaignId: '38108',
    materialItemId: '1',
    width: 1,
    height: 1,
    contentHash: 'abc',
    sourceUrlSha256: 'def',
    byteSize: 8,
    contentType: 'image/png',
    ext: 'png',
    publicPath: '/aanbiedingen/creative-images/nl/512226/38108/1-1x1-abcdef0123456789.png',
    storageKey: 'tradetracker-creatives/images/nl/512226/38108/1-1x1-abcdef0123456789.png',
    localRelativePath: 'data/tradetracker-creatives/images/nl/512226/38108/1-1x1-abcdef0123456789.png',
  };
}

function imageReport() {
  return {
    considered: 1,
    displayable: 0,
    excluded: 1,
    doubt: 0,
    stored: 0,
    skipped: 0,
    failed: 0,
    storage: 'local' as const,
    publicPaths: [],
    failures: [],
    manifest: {
      source: 'vacationweb-tradetracker-creative-images' as const,
      generatedAt: FETCHED_AT,
      storage: 'local' as const,
      entries: [],
    },
  };
}

test('A/B a successful refresh with zero displayable offers publishes both snapshots', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vw-refresh-'));
  const published: string[] = [];
  const summary = await refreshTradeTrackerCreatives({
    root,
    requireRemote: true,
    deps: {
      ingestMarket: async (target) => snapshot(target),
      ingestImages: async () => imageReport(),
      readDocument: async () => null,
      publishDocument: async (key, body) => {
        published.push(key);
        assert.equal(body.includes('passphrase'), false);
        assert.equal(key.includes('offers.json'), false);
        assert.equal(key.includes('current.json'), false);
        assert.equal(key.includes('live-price'), false);
        return 'stored';
      },
    },
  });
  assert.equal(summary.ok, true);
  assert.equal(summary.manifestPublished, true);
  assert.deepEqual(published, [NL_KEY, BE_KEY, CREATIVE_IMAGE_MANIFEST_STORAGE_KEY]);
  assert.equal(summary.markets.every((market) => market.displayableCount === 0 && market.status === 'published'), true);
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'data/tradetracker-creatives/creative-image-manifest.json'), 'utf8'));
  assert.deepEqual(manifest.entries, []);
  const nl = JSON.parse(await fs.readFile(path.join(root, 'data/tradetracker-creatives/selected-nl-512226.json'), 'utf8'));
  assert.equal(nl.market, 'nl');
  assert.equal(nl.scopedAffiliateSiteId, '512226');
});

test('C/D a failed market does not replace its previous snapshot or the other market images', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vw-refresh-fail-'));
  const previousNl = '{"market":"nl","previous":true}';
  const nlPath = path.join(root, 'data/tradetracker-creatives/selected-nl-512226.json');
  await fs.mkdir(path.dirname(nlPath), { recursive: true });
  await fs.writeFile(nlPath, previousNl, 'utf8');
  const remote = new Map<string, string>([
    [NL_KEY, previousNl],
    [BE_KEY, '{"market":"be","previous":true}'],
    [
      CREATIVE_IMAGE_MANIFEST_STORAGE_KEY,
      JSON.stringify({
        source: 'vacationweb-tradetracker-creative-images',
        generatedAt: '2020-01-01T00:00:00.000Z',
        storage: 'local',
        entries: [keptEntry()],
      }),
    ],
  ]);
  const summary = await refreshTradeTrackerCreatives({
    root,
    requireRemote: true,
    deps: {
      ingestMarket: async (target) => {
        if (target.market === 'nl' && target.affiliateSiteId === '512226') {
          throw new Error('SOAP fault passphrase=secret-value');
        }
        return snapshot(target);
      },
      ingestImages: async () => imageReport(),
      readDocument: async (key) => remote.get(key) ?? null,
      publishDocument: async (key, body) => {
        remote.set(key, body);
        return 'stored';
      },
    },
  });
  assert.equal(summary.ok, false);
  assert.equal(summary.markets.find((market) => market.market === 'nl')?.status, 'failed');
  assert.equal(summary.markets.find((market) => market.market === 'be')?.status, 'published');
  assert.equal(remote.get(NL_KEY), previousNl);
  assert.equal(await fs.readFile(nlPath, 'utf8'), previousNl);
  assert.equal(summary.markets.find((market) => market.market === 'nl')?.error?.includes('secret-value'), false);
  const manifest = JSON.parse(remote.get(CREATIVE_IMAGE_MANIFEST_STORAGE_KEY) ?? '{}');
  assert.equal(manifest.entries.some((entry: { publicPath: string }) => entry.publicPath.includes('/nl/512226/')), true);
  const be = JSON.parse(remote.get(BE_KEY) ?? '{}');
  assert.equal(be.market, 'be');
  assert.equal(be.scopedAffiliateSiteId, '511873');
});

test('an object-storage failure publishes nothing over the previous documents', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vw-refresh-r2-'));
  const calls: string[] = [];
  const summary = await refreshTradeTrackerCreatives({
    root,
    requireRemote: true,
    deps: {
      ingestMarket: async (target) => snapshot(target),
      ingestImages: async () => imageReport(),
      readDocument: async () => null,
      publishDocument: async (key) => {
        calls.push(key);
        throw new Error('r2 unavailable');
      },
    },
  });
  assert.equal(summary.ok, false);
  assert.equal(summary.manifestPublished, false);
  assert.deepEqual(calls, [NL_KEY, BE_KEY]);
  await assert.rejects(fs.access(path.join(root, 'data/tradetracker-creatives/selected-nl-512226.json')));
  await assert.rejects(fs.access(path.join(root, 'data/tradetracker-creatives/creative-image-manifest.json')));
});

test('image ingest can defer the remote manifest until the refresh publishes it', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vw-images-defer-'));
  let published = 0;
  const report = await ingestDisplayableCreativeImages({
    root,
    generatedAt: FETCHED_AT,
    creatives: [],
    publishRemote: false,
    writeLocalManifest: false,
    publishDocument: async () => {
      published += 1;
      return 'stored';
    },
    putIsolatedBytes: async () => 'unavailable',
  });
  assert.equal(published, 0);
  assert.ok(report.manifest);
  await assert.rejects(fs.access(path.join(root, 'data/tradetracker-creatives/creative-image-manifest.json')));
});

test('E cron route refuses a missing or invalid bearer and does not require a secret in the body', async () => {
  const previous = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    const missing = await GET(new Request('http://localhost/api/cron/tradetracker-creatives'));
    assert.equal(missing.status, 401);
    assert.equal((await missing.json()).error, 'refused');
  } finally {
    if (previous === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previous;
    }
  }

  process.env.CRON_SECRET = 'cron-test-secret';
  try {
    const absent = await GET(new Request('http://localhost/api/cron/tradetracker-creatives'));
    const wrong = await GET(
      new Request('http://localhost/api/cron/tradetracker-creatives', {
        headers: { authorization: 'Bearer not-the-secret' },
      }),
    );
    assert.equal(absent.status, 401);
    assert.equal(wrong.status, 401);
    assert.equal((await absent.json()).error, 'unauthorized');
    assert.equal((await wrong.json()).error, 'unauthorized');
  } finally {
    if (previous === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = previous;
    }
  }

  const route = await fs.readFile(path.join(process.cwd(), 'app/api/cron/tradetracker-creatives/route.ts'), 'utf8');
  const secretAt = route.indexOf('CRON_SECRET');
  const refreshAt = route.indexOf('refreshTradeTrackerCreatives({');
  assert.equal(secretAt > 0 && secretAt < refreshAt, true);
  assert.equal(route.includes('requireRemote: true'), true);
  assert.equal(route.includes('tmpdir'), true);
  const vercel = JSON.parse(await fs.readFile(path.join(process.cwd(), 'vercel.json'), 'utf8'));
  assert.equal(vercel.crons.length, 1);
  assert.equal(vercel.crons[0].path, '/api/cron/tradetracker-creatives');
  assert.equal(vercel.crons[0].schedule, '17 2 * * *');
});

test('F/G the page loader reads a snapshot and does not call TradeTracker', async () => {
  const loader = await fs.readFile(path.join(process.cwd(), 'lib/tradetracker/promotions/load-aanbiedingen.ts'), 'utf8');
  const page = await fs.readFile(path.join(process.cwd(), 'app/aanbiedingen/page.tsx'), 'utf8');
  assert.equal(loader.includes('load-for-page'), false);
  assert.equal(loader.includes('ingestTradeTracker'), false);
  assert.equal(loader.includes('soap'), false);
  assert.equal(page.includes('ingestTradeTracker'), false);
  assert.equal(page.includes('load-for-page'), false);
  assert.equal(page.includes('Momenteel zijn er geen actuele aanbiedingen.'), false);
  assert.equal(page.includes('AanbiedingenEmptyState'), true);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('unexpected fetch');
  };
  try {
    const empty = await loadAanbiedingenForMarket('nl', {
      root: await fs.mkdtemp(path.join(os.tmpdir(), 'vw-page-')),
      readRemote: async () => null,
    });
    assert.equal(empty.cards.length, 0);
    assert.equal(empty.secondaryCount, 0);
    assert.equal(empty.error, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('I/J/K/L/M page sources do not fall back to homepage offers, Kaching, /i or automatic /c', async () => {
  const files = [
    'app/aanbiedingen/page.tsx',
    'components/promotions/aanbiedingen-experience.tsx',
    'lib/tradetracker/promotions/present-aanbiedingen.ts',
    'lib/tradetracker/promotions/load-aanbiedingen.ts',
  ];
  for (const file of files) {
    const source = await fs.readFile(path.join(process.cwd(), file), 'utf8');
    assert.equal(source.includes('corendon-homepage-actions'), false, file);
    assert.equal(source.includes('Kaching'), false, file);
    assert.equal(source.includes('€600'), false, file);
    assert.equal(source.includes('€200'), false, file);
    assert.equal(source.includes('src="/i'), false, file);
    assert.equal(source.includes('ti.tradetracker.net/'), false, file);
    assert.equal(source.includes('prefetch'), false, file);
    assert.equal(source.includes('<iframe'), false, file);
  }
  const experience = await fs.readFile(
    path.join(process.cwd(), 'components/promotions/aanbiedingen-experience.tsx'),
    'utf8',
  );
  assert.equal(experience.includes('/aanbiedingen/creative-images/'), true);
  const header = await fs.readFile(path.join(process.cwd(), 'components/home/home-header.tsx'), 'utf8');
  const footer = await fs.readFile(path.join(process.cwd(), 'components/home/home-footer.tsx'), 'utf8');
  assert.equal(header.includes("label: 'Aanbiedingen', href: '/aanbiedingen'"), true);
  assert.equal(footer.includes("label: 'Aanbiedingen', href: '/aanbiedingen'"), true);
  assert.equal(header.includes('Aanbod'), false);
  assert.equal(footer.includes('Aanbod'), false);
});
