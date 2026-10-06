import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { TRADETRACKER_AFFILIATE_WSDL_URL, TRADETRACKER_SOURCE } from './constants';
import { composeAanbiedingenCards } from './compose-aanbiedingen';
import { creativeImageMaterialKey } from './creative-image-path';
import { ingestDisplayableCreativeImages } from './creative-images';
import { presentAanbiedingenOffers } from './present-aanbiedingen';
import { promotionClickHref } from './promotion-click';
import { selectTradeTrackerCreatives } from './select-creatives';
import type { TradeTrackerBannerCreativeRecord, TradeTrackerCreativeSnapshot } from './types';
import { promotionalValidity } from './validity';

const AS_OF = Date.UTC(2026, 9, 5, 14, 56, 35);
const FETCHED_AT = '2026-10-05T14:56:35.195Z';
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function clickFor(materialItemId: string): string {
  return `https://referral.corendon.nl/c?c=38108&m=${materialItemId}&a=512226&r=&u=`;
}

function impressionFor(materialItemId: string): string {
  return `https://referral.corendon.nl/i?c=38108&m=${materialItemId}&a=512226&r=`;
}

function creative(overrides: Partial<TradeTrackerBannerCreativeRecord> = {}): TradeTrackerBannerCreativeRecord {
  const materialItemId = overrides.materialItemId ?? '88';
  const click = overrides.trackingClickUrlTemplate ?? clickFor(materialItemId);
  const impression = overrides.impressionUrlTemplate ?? impressionFor(materialItemId);
  return {
    source: TRADETRACKER_SOURCE,
    kind: 'banner_image',
    materialItemId,
    name: 'Zomerdeal',
    campaignId: '38108',
    campaignName: 'Corendon NL',
    campaignUrl: 'https://www.corendon.nl/',
    affiliateSiteId: '512226',
    market: 'nl',
    width: 1,
    height: 1,
    dimensionId: '1',
    isMobile: false,
    isCommon: true,
    referenceSupported: true,
    description: 'Tot €50 extra korting',
    conditions: null,
    validFromDate: '2026-09-01',
    validToDate: null,
    discountFixed: '€50',
    discountVariable: null,
    voucherCode: null,
    creationDate: '2026-09-01T00:00:00+00:00',
    modificationDate: '2026-09-02T00:00:00+00:00',
    status: null,
    embedCode: `<a href="${click}"><img src="${impression}" alt="" /></a>`,
    trackingClickUrlTemplate: click,
    impressionUrlTemplate: impression,
    staticImageUrlHint: null,
    validity: promotionalValidity({ startDate: '2026-09-01', endDate: null, asOfMs: AS_OF }),
    fetchedAt: FETCHED_AT,
    sourceMetadata: {},
    ...overrides,
  };
}

function snapshot(
  creatives: TradeTrackerBannerCreativeRecord[],
  overrides: Partial<TradeTrackerCreativeSnapshot> = {},
): TradeTrackerCreativeSnapshot {
  return {
    source: TRADETRACKER_SOURCE,
    ingestedAt: FETCHED_AT,
    wsdlUrl: TRADETRACKER_AFFILIATE_WSDL_URL,
    market: 'nl',
    scopedAffiliateSiteId: '512226',
    credentialScope: 'nl',
    imageDelivery: 'metadata-and-embed-code',
    campaignIds: ['38108'],
    creatives,
    methodErrors: [],
    counts: {
      creatives: creatives.length,
      campaignsRequested: 1,
      methodErrors: 0,
      byCampaignId: { '38108': creatives.length },
    },
    ...overrides,
  };
}

test('1–7 and 17–18: selection and the page keep only a concrete same-market offer', () => {
  const offer = creative();
  const generic = creative({
    materialItemId: '71',
    name: 'Last Minute',
    description: 'Last Minute',
    discountFixed: null,
    trackingClickUrlTemplate: clickFor('71'),
    impressionUrlTemplate: impressionFor('71'),
    embedCode: `<a href="${clickFor('71')}"><img src="${impressionFor('71')}" /></a>`,
  });
  const expired = creative({
    materialItemId: '72',
    validToDate: '2026-01-01',
    validity: promotionalValidity({ startDate: '2025-01-01', endDate: '2026-01-01', asOfMs: AS_OF }),
    trackingClickUrlTemplate: clickFor('72'),
    impressionUrlTemplate: impressionFor('72'),
    embedCode: `<a href="${clickFor('72')}"><img src="${impressionFor('72')}" /></a>`,
  });
  const wrongSite = creative({
    materialItemId: '73',
    affiliateSiteId: '512055',
    trackingClickUrlTemplate: 'https://referral.corendon.nl/c?c=38108&m=73&a=512055&r=&u=',
  });
  const wrongProvider = creative({
    materialItemId: '74',
    campaignName: 'TUI NL',
    campaignUrl: 'https://www.tui.nl/',
    name: 'TUI deal',
    trackingClickUrlTemplate: clickFor('74'),
    impressionUrlTemplate: impressionFor('74'),
    embedCode: `<a href="${clickFor('74')}"><img src="${impressionFor('74')}" /></a>`,
  });
  const wrongMarket = creative({
    materialItemId: '75',
    market: 'be',
    affiliateSiteId: '511873',
    campaignId: '38103',
    campaignName: 'Corendon.be',
    campaignUrl: 'https://www.corendon.be/',
  });

  const selected = selectTradeTrackerCreatives(
    snapshot([offer, generic, expired, wrongSite, wrongProvider, wrongMarket]),
    { asOfMs: AS_OF },
  );
  assert.equal(selected.creatives.some((item) => item.materialItemId === '88'), true);
  const reasons = selected.exclusions.map((item) => item.reason);
  assert.equal(reasons.includes('expired'), true);
  assert.equal(reasons.includes('non_canonical_site'), true);
  assert.equal(reasons.includes('unknown_provider'), true);
  assert.equal(reasons.includes('market_mismatch'), true);

  const cards = composeAanbiedingenCards({ market: 'nl', creatives: selected.creatives, secondary: [] });
  assert.deepEqual(
    cards.map((card) => card.materialItemId),
    ['88'],
  );
  const shown = presentAanbiedingenOffers('nl', cards, AS_OF);
  assert.equal(shown.length, 1);
  assert.equal(shown[0]?.benefitAmount, '€50');
  assert.equal(shown[0]?.clickUrl, promotionClickHref(selected.creatives.find((item) => item.materialItemId === '88')!));
  assert.equal(JSON.stringify(shown).includes('Warme Winter'), false);
  assert.equal(JSON.stringify(shown).includes('/i?'), false);

  const removed = selectTradeTrackerCreatives(snapshot([generic]), { asOfMs: AS_OF });
  const afterRemoval = presentAanbiedingenOffers(
    'nl',
    composeAanbiedingenCards({ market: 'nl', creatives: removed.creatives, secondary: [] }),
    AS_OF,
  );
  assert.deepEqual(afterRemoval, []);

  const belgian = presentAanbiedingenOffers('be', cards, AS_OF);
  assert.deepEqual(belgian, []);
  assert.deepEqual(presentAanbiedingenOffers('nl', [], AS_OF), []);
});

test('8–16: an allowed image is stored once, updated when the creative changes, and stays off /i', async () => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'vw-chain-'));
  const selected = selectTradeTrackerCreatives(snapshot([creative()]), { asOfMs: AS_OF });
  const sourceSnapshot = path.join(root, 'data', 'tradetracker-creatives', 'snapshot-nl-512226.json');
  fs.mkdirSync(path.dirname(sourceSnapshot), { recursive: true });
  fs.writeFileSync(sourceSnapshot, JSON.stringify(snapshot([creative()])), 'utf8');

  const fetched: string[] = [];
  const first = await ingestDisplayableCreativeImages({
    root,
    generatedAt: FETCHED_AT,
    creatives: selected.creatives,
    fetchImpression: async (url) => {
      fetched.push(url);
      return { status: 200, location: null, contentType: 'image/png', body: PNG_1X1 };
    },
    putIsolatedBytes: async (key) => {
      assert.match(key, /^tradetracker-creatives\/images\/nl\/512226\/38108\//);
      assert.equal(key.includes('offers'), false);
      assert.equal(key.includes('current.json'), false);
      assert.equal(key.includes('live-price'), false);
      return 'unavailable';
    },
    publishDocument: async (key, body) => {
      assert.equal(key, 'tradetracker-creatives/creative-image-manifest.json');
      assert.equal(body.includes('/i?'), false);
      assert.equal(body.includes('/c?'), false);
      return 'unavailable';
    },
  });
  assert.equal(first.stored, 1);
  assert.equal(first.publicPaths[0]?.startsWith('/aanbiedingen/creative-images/nl/512226/38108/'), true);
  assert.equal(fs.existsSync(sourceSnapshot), true);

  const second = await ingestDisplayableCreativeImages({
    root,
    generatedAt: FETCHED_AT,
    creatives: selected.creatives,
    fetchImpression: async () => {
      throw new Error('must not refetch an unchanged creative');
    },
    putIsolatedBytes: async () => 'unavailable',
    publishDocument: async () => 'unavailable',
  });
  assert.equal(second.skipped, 1);
  assert.equal(second.stored, 0);

  const changed = creative({
    impressionUrlTemplate: 'https://referral.corendon.nl/i?c=38108&m=88&a=512226&r=changed',
    embedCode:
      '<a href="https://referral.corendon.nl/c?c=38108&m=88&a=512226&r=&u="><img src="https://referral.corendon.nl/i?c=38108&m=88&a=512226&r=changed" /></a>',
  });
  const changedSelected = selectTradeTrackerCreatives(snapshot([changed]), { asOfMs: AS_OF });
  let refetched = 0;
  const third = await ingestDisplayableCreativeImages({
    root,
    generatedAt: FETCHED_AT,
    creatives: changedSelected.creatives,
    fetchImpression: async () => {
      refetched += 1;
      return { status: 200, location: null, contentType: 'image/png', body: PNG_1X1 };
    },
    putIsolatedBytes: async () => 'unavailable',
    publishDocument: async () => 'unavailable',
  });
  assert.equal(refetched, 1);
  assert.equal(third.stored, 1);

  const publicPath = third.publicPaths[0] ?? '';
  const cards = composeAanbiedingenCards({
    market: 'nl',
    creatives: changedSelected.creatives,
    secondary: [],
    images: new Map([
      [
        creativeImageMaterialKey('nl', '512226', '88'),
        { publicPath, width: 1, height: 1 },
      ],
    ]),
  });
  const offers = presentAanbiedingenOffers('nl', cards, AS_OF);
  assert.equal(offers[0]?.imageUrl, publicPath);
  assert.equal(offers[0]?.imageUrl.includes('/i?'), false);
  assert.match(offers[0]?.clickUrl ?? '', /\/c\?/);
  assert.equal(fetched.some((url) => url.includes('/c?')), false);
});

test('the refresh entrypoint chains the existing creative modules and leaves the catalog alone', () => {
  const script = fs.readFileSync(path.join(process.cwd(), 'scripts/refresh-tradetracker-creatives.ts'), 'utf8');
  const source = fs.readFileSync(path.join(process.cwd(), 'lib/tradetracker/promotions/refresh-creatives.ts'), 'utf8');
  assert.equal(script.includes('refreshTradeTrackerCreatives'), true);
  assert.equal(script.includes('spawnSync'), false);
  const ingestAt = source.indexOf('ingestTradeTrackerCreatives({');
  const selectAt = source.indexOf('selectTradeTrackerCreatives(');
  const imagesAt = source.indexOf('deps.ingestImages(');
  assert.equal(ingestAt > 0 && ingestAt < selectAt && selectAt < imagesAt, true);
  assert.equal(source.includes('ingestDisplayableCreativeImages'), true);
  assert.equal(script.includes('corendon-homepage-actions'), false);
  assert.equal(source.includes('corendon-homepage-actions'), false);
  assert.equal(source.includes('import-all-feeds'), false);
  assert.equal(source.includes('upload-offers'), false);
  assert.equal(source.includes('publish-generation'), false);
  assert.equal(script.includes('import-all-feeds'), false);
  assert.equal(script.includes('upload-offers'), false);
  assert.equal(script.includes('publish-generation'), false);
  const page = fs.readFileSync(path.join(process.cwd(), 'app/aanbiedingen/page.tsx'), 'utf8');
  const presenter = fs.readFileSync(path.join(process.cwd(), 'lib/tradetracker/promotions/present-aanbiedingen.ts'), 'utf8');
  assert.equal(page.includes('corendon-homepage-actions'), false);
  assert.equal(presenter.includes('corendon-homepage-actions'), false);
  assert.equal(page.includes('prefetch'), false);
});
