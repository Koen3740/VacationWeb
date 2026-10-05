import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { TRADETRACKER_CREATIVE_CANONICAL_SITE, TRADETRACKER_SOURCE } from './constants';
import { composeAanbiedingenCards } from './compose-aanbiedingen';
import { loadAanbiedingenForMarket } from './load-aanbiedingen';
import {
  acceptSelectedCreativeForMarket,
  loadSelectedCreativesForMarket,
  selectedCreativeSnapshotPath,
} from './load-selected-creatives';
import type { DisplayablePromotion } from './select-displayable';
import type { LoadedMarketPromotions } from './load-for-page';
import type {
  SelectedTradeTrackerCreative,
  SelectedTradeTrackerCreativeSnapshot,
} from './types';
import { promotionalValidity } from './validity';

const AS_OF = Date.UTC(2026, 9, 5);
const NL_CLICK = 'https://referral.corendon.nl/c?c=38108&m=55&a=512226&r=&u=';
const NL_IMPRESSION = 'https://referral.corendon.nl/i?c=38108&m=55&a=512226&r=';

function creative(
  overrides: Partial<SelectedTradeTrackerCreative> = {},
): SelectedTradeTrackerCreative {
  const market = overrides.market ?? 'nl';
  const affiliateSiteId = overrides.affiliateSiteId ?? TRADETRACKER_CREATIVE_CANONICAL_SITE[market];
  const materialItemId = overrides.materialItemId ?? '55';
  return {
    id: `${market}|${affiliateSiteId}|${materialItemId}`,
    dedupeKey: `${market}|${affiliateSiteId}|${materialItemId}`,
    provider: 'Corendon',
    market,
    campaignId: market === 'be' ? '38103' : '38108',
    campaignName: market === 'be' ? 'Corendon.be' : 'Corendon NL',
    campaignUrl: market === 'be' ? 'https://www.corendon.be/' : 'https://www.corendon.nl/',
    affiliateSiteId,
    materialItemId,
    title: 'Banner5',
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
    embedCode: `<a href="${NL_CLICK}"><img src="${NL_IMPRESSION}" /></a>`,
    staticImageUrlHint: null,
    trackingClickUrlTemplate: NL_CLICK,
    impressionUrlTemplate: NL_IMPRESSION,
    referenceSupported: true,
    source: TRADETRACKER_SOURCE,
    sourceSnapshot: `snapshot-${market}-${affiliateSiteId}.json`,
    fetchedAt: '2026-10-05T14:56:35.195Z',
    displayable: true,
    ...overrides,
  };
}

function promotion(overrides: Partial<DisplayablePromotion> = {}): DisplayablePromotion {
  return {
    id: 'news:9',
    kind: 'consumer_promotion',
    market: 'nl',
    providerName: 'Corendon',
    title: 'Nazomeractie',
    summary: 'Alleen de brontekst',
    campaignUrl: 'https://www.corendon.nl/actie',
    publishDate: '2026-09-01',
    expirationDate: '2026-09-30',
    ...overrides,
  };
}

function secondaryResult(
  market: 'nl' | 'be',
  promotions: DisplayablePromotion[],
  error: string | null = null,
): LoadedMarketPromotions {
  return {
    market,
    affiliateSiteId: market === 'be' ? '512055' : '512226',
    promotions,
    ingestedAt: '2026-10-05T14:56:35.195Z',
    error,
  };
}

test('canonical creative files are NL 512226 and BE 511873', () => {
  assert.equal(TRADETRACKER_CREATIVE_CANONICAL_SITE.nl, '512226');
  assert.equal(TRADETRACKER_CREATIVE_CANONICAL_SITE.be, '511873');
  assert.match(selectedCreativeSnapshotPath('nl', '/app'), /selected-nl-512226\.json$/);
  assert.match(selectedCreativeSnapshotPath('be', '/app'), /selected-be-511873\.json$/);
  assert.equal(acceptSelectedCreativeForMarket('nl', creative()), true);
  assert.equal(acceptSelectedCreativeForMarket('be', creative({ market: 'be' })), true);
  assert.equal(acceptSelectedCreativeForMarket('nl', creative({ market: 'be' })), false);
  assert.equal(acceptSelectedCreativeForMarket('nl', creative({ affiliateSiteId: '512055' })), false);
  assert.equal(
    acceptSelectedCreativeForMarket('nl', creative({ provider: 'Sunweb', campaignName: 'Sunweb', campaignUrl: 'https://www.sunweb.nl/' })),
    true,
  );
});

test('primary creatives precede secondary promotions and the same material is not repeated', () => {
  const cards = composeAanbiedingenCards({
    market: 'nl',
    creatives: [creative({ materialItemId: '55', title: 'Banner5' })],
    secondary: [
      promotion({ id: 'voucher:55', kind: 'voucher', title: 'Zelfde materiaal' }),
      promotion({ id: 'incentive_offer:55', kind: 'incentive_offer', title: 'Nog eens' }),
      promotion({ id: 'news:9', title: 'Nazomeractie' }),
    ],
  });
  assert.deepEqual(
    cards.map((card) => card.source + ':' + card.title),
    ['creative:Banner5', 'promotion:Nazomeractie'],
  );
  assert.equal(cards[0]?.discountText, null);
  assert.equal(cards[0]?.imagePolicy, 'metadata-only');
  assert.equal(cards[0]?.campaignUrl, 'https://www.corendon.nl/');
  assert.equal(JSON.stringify(cards).includes('/c?'), false);
  assert.equal(JSON.stringify(cards).includes('/i?'), false);
});

test('secondary promotions remain when no primary creative exists', () => {
  const cards = composeAanbiedingenCards({
    market: 'nl',
    creatives: [],
    secondary: [promotion()],
  });
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.source, 'promotion');
  assert.equal(cards[0]?.title, 'Nazomeractie');
});

test('TUI, unknown providers, and the other market are excluded', () => {
  const cards = composeAanbiedingenCards({
    market: 'nl',
    creatives: [
      creative({ materialItemId: '1', title: 'TUI week', campaignName: 'TUI' }),
      creative({ materialItemId: '2', provider: 'Prijsvrij' as 'Corendon', campaignName: 'Prijsvrij' }),
      creative({ materialItemId: '3', market: 'be' }),
      creative({ materialItemId: '4', discountFixed: '25', voucherCode: null }),
    ],
    secondary: [promotion({ providerName: 'TUI', title: 'TUI deal' })],
  });
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.materialItemId, '4');
  assert.equal(cards[0]?.discountText, '25');
  assert.equal(cards[0]?.providerName, 'Corendon');
});

test('a tracking campaign URL is not used as a link', () => {
  const cards = composeAanbiedingenCards({
    market: 'nl',
    creatives: [creative({ campaignUrl: NL_CLICK })],
    secondary: [],
  });
  assert.equal(cards[0]?.campaignUrl, null);
  assert.equal(JSON.stringify(cards).includes(NL_CLICK), false);
});

test('compose performs no HTTP', () => {
  const originalFetch = globalThis.fetch;
  const originalHttp = http.request;
  const originalHttps = https.request;
  http.request = () => {
    throw new Error('unexpected http');
  };
  https.request = () => {
    throw new Error('unexpected https');
  };
  globalThis.fetch = () => {
    throw new Error('unexpected fetch');
  };
  try {
    const cards = composeAanbiedingenCards({
      market: 'be',
      creatives: [creative({ market: 'be', materialItemId: '9' })],
      secondary: [],
    });
    assert.equal(cards[0]?.affiliateSiteId, '511873');
    assert.equal(cards[0]?.market, 'be');
  } finally {
    globalThis.fetch = originalFetch;
    http.request = originalHttp;
    https.request = originalHttps;
  }
});

test('page loader keeps primary cards when secondary SOAP fails', async () => {
  const section = await loadAanbiedingenForMarket('nl', {
    loadPrimary: async () => ({
      market: 'nl',
      affiliateSiteId: '512226',
      sourceFile: 'selected-nl-512226.json',
      creatives: [creative()],
      skipped: 0,
      status: 'ok',
      error: null,
    }),
    loadSecondary: async () => secondaryResult('nl', [], 'SOAP timeout'),
  });
  assert.equal(section.affiliateSiteId, '512226');
  assert.equal(section.primaryCount, 1);
  assert.equal(section.secondaryCount, 0);
  assert.equal(section.error, null);
});

test('page loader uses secondary promotions when the creative file is missing', async () => {
  const section = await loadAanbiedingenForMarket('be', {
    loadPrimary: async () => ({
      market: 'be',
      affiliateSiteId: '511873',
      sourceFile: 'selected-be-511873.json',
      creatives: [],
      skipped: 0,
      status: 'missing',
      error: null,
    }),
    loadSecondary: async () =>
      secondaryResult('be', [promotion({ market: 'be', title: 'BE nieuws' })]),
  });
  assert.equal(section.affiliateSiteId, '511873');
  assert.equal(section.primaryCount, 0);
  assert.equal(section.secondaryCount, 1);
  assert.equal(section.cards[0]?.title, 'BE nieuws');
  assert.equal(section.error, null);
});

test('selected snapshot reader keeps only the requested market', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vw-creatives-'));
  const nlDir = path.join(root, 'data', 'tradetracker-creatives');
  await fs.mkdir(nlDir, { recursive: true });
  const snapshot: SelectedTradeTrackerCreativeSnapshot = {
    source: TRADETRACKER_SOURCE,
    selectedAt: '2026-10-05T14:56:35.195Z',
    snapshotIngestedAt: '2026-10-05T14:56:35.195Z',
    wsdlUrl: 'https://ws.tradetracker.com/soap-literal-wsi/affiliate?wsdl',
    market: 'nl',
    scopedAffiliateSiteId: '512226',
    sourceSnapshot: 'snapshot-nl-512226.json',
    imageDelivery: 'metadata-and-embed-code',
    inputCount: 2,
    selectedCount: 2,
    excludedCount: 0,
    providers: { Corendon: 2 },
    dedupe: {
      key: 'market|affiliateSiteId|materialItemId',
      collapsed: 0,
      relations: { unique: 2, dimension_variant: 0, same_dimension_distinct_material: 0 },
    },
    exclusions: [],
    creatives: [creative({ materialItemId: '55' }), creative({ materialItemId: '56', market: 'be' })],
  };
  await fs.writeFile(
    path.join(nlDir, 'selected-nl-512226.json'),
    JSON.stringify(snapshot),
    'utf8',
  );

  const loaded = await loadSelectedCreativesForMarket('nl', { root });
  assert.equal(loaded.status, 'ok');
  assert.equal(loaded.affiliateSiteId, '512226');
  assert.deepEqual(loaded.creatives.map((item) => item.materialItemId), ['55']);
  assert.equal(loaded.skipped, 1);

  const missing = await loadSelectedCreativesForMarket('be', { root });
  assert.equal(missing.status, 'missing');
  assert.equal(missing.creatives.length, 0);
  assert.equal(missing.affiliateSiteId, '511873');
});

test('live selected snapshots become Corendon cards without tracking URLs', async (t) => {
  const nlPath = selectedCreativeSnapshotPath('nl');
  const bePath = selectedCreativeSnapshotPath('be');
  try {
    await fs.access(nlPath);
    await fs.access(bePath);
  } catch {
    t.skip('Selected creative snapshots are gitignored and are not in this checkout');
    return;
  }
  const nl = await loadSelectedCreativesForMarket('nl');
  const be = await loadSelectedCreativesForMarket('be');
  const nlCards = composeAanbiedingenCards({ market: 'nl', creatives: nl.creatives, secondary: [] });
  const beCards = composeAanbiedingenCards({ market: 'be', creatives: be.creatives, secondary: [] });
  assert.equal(nl.creatives.length, 98);
  assert.equal(be.creatives.length, 27);
  assert.equal(nlCards.length, 98);
  assert.equal(beCards.length, 27);
  assert.equal(nlCards.every((card) => card.providerName === 'Corendon' && card.affiliateSiteId === '512226' && card.market === 'nl'), true);
  assert.equal(beCards.every((card) => card.providerName === 'Corendon' && card.affiliateSiteId === '511873' && card.market === 'be'), true);
  assert.equal(nlCards.every((card) => card.discountText == null), true);
  assert.equal(JSON.stringify(nlCards).includes('/c?'), false);
  assert.equal(JSON.stringify(beCards).includes('/i?'), false);
});
