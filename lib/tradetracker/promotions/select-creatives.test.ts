import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import test from 'node:test';
import { TRADETRACKER_AFFILIATE_WSDL_URL, TRADETRACKER_SOURCE } from './constants';
import {
  isCreativeDemonstrablyExpired,
  mapCreativeProvider,
  selectTradeTrackerCreatives,
} from './select-creatives';
import type { TradeTrackerBannerCreativeRecord, TradeTrackerCreativeSnapshot } from './types';
import { promotionalValidity } from './validity';

const AS_OF = Date.UTC(2026, 9, 5, 14, 56, 35);
const FETCHED_AT = '2026-10-05T14:56:35.195Z';

const NL_CLICK = 'https://referral.corendon.nl/c?c=38108&m=55&a=512226&r=&u=';
const NL_IMPRESSION = 'https://referral.corendon.nl/i?c=38108&m=55&a=512226&r=';
const NL_EMBED = `<a href="${NL_CLICK}"><img src="${NL_IMPRESSION}" alt="" /></a>`;

function validity(start: string | null, end: string | null) {
  return promotionalValidity({ startDate: start, endDate: end, asOfMs: AS_OF });
}

function creative(
  overrides: Partial<TradeTrackerBannerCreativeRecord> = {},
): TradeTrackerBannerCreativeRecord {
  return {
    source: TRADETRACKER_SOURCE,
    kind: 'banner_image',
    materialItemId: '55',
    name: 'Banner5',
    campaignId: '38108',
    campaignName: 'Corendon NL',
    campaignUrl: 'https://www.corendon.nl/',
    affiliateSiteId: '512226',
    market: 'nl',
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
    creationDate: '2024-02-29T14:13:53+01:00',
    modificationDate: null,
    status: null,
    embedCode: NL_EMBED,
    trackingClickUrlTemplate: NL_CLICK,
    impressionUrlTemplate: NL_IMPRESSION,
    staticImageUrlHint: null,
    validity: validity(null, null),
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

test('provider mapping uses campaign name and URL, not the banner title', () => {
  assert.equal(
    mapCreativeProvider({ campaignName: 'Corendon NL', campaignUrl: 'https://www.corendon.nl/' }),
    'Corendon',
  );
  assert.equal(
    mapCreativeProvider({ campaignName: 'Corendon.be', campaignUrl: 'https://www.corendon.be/' }),
    'Corendon',
  );
  assert.equal(
    mapCreativeProvider({ campaignName: 'Sunweb NL', campaignUrl: null }),
    'Sunweb',
  );
  assert.equal(
    mapCreativeProvider({ campaignName: null, campaignUrl: 'https://www.elizawashere.be/reizen' }),
    'Eliza was here',
  );
  assert.equal(
    mapCreativeProvider({ campaignName: 'Eliza was here', campaignUrl: null }),
    'Eliza was here',
  );
  assert.equal(mapCreativeProvider({ campaignName: 'Eliza', campaignUrl: null }), 'unknown');
  assert.equal(mapCreativeProvider({ campaignName: 'TUI', campaignUrl: 'https://www.tui.nl/' }), 'unknown');
  assert.equal(
    mapCreativeProvider({ campaignName: 'H10 Hotels', campaignUrl: 'https://www.h10hotels.com/' }),
    'unknown',
  );
});

test('undated creatives are not expired solely because isActive is false', () => {
  const undated = creative();
  assert.equal(undated.validity.status, 'undated');
  assert.equal(undated.validity.isActive, false);
  assert.equal(isCreativeDemonstrablyExpired(undated, AS_OF), false);

  const endOnly = creative({
    validToDate: '2020-01-01',
    validity: validity(null, '2020-01-01'),
  });
  assert.equal(endOnly.validity.status, 'undated');
  assert.equal(isCreativeDemonstrablyExpired(endOnly, AS_OF), true);
});

test('selection keeps a Corendon banner with no discount and preserves the click template', () => {
  const selected = selectTradeTrackerCreatives(snapshot([creative({ name: 'Sunweb super deal' })]));
  assert.equal(selected.selectedCount, 1);
  assert.equal(selected.creatives[0]?.provider, 'Corendon');
  assert.equal(selected.creatives[0]?.title, 'Sunweb super deal');
  assert.equal(selected.creatives[0]?.discountFixed, null);
  assert.equal(selected.creatives[0]?.discountVariable, null);
  assert.equal(selected.creatives[0]?.voucherCode, null);
  assert.equal(selected.creatives[0]?.trackingClickUrlTemplate, NL_CLICK);
  assert.equal(selected.creatives[0]?.displayable, true);
  assert.equal(JSON.stringify(selected).includes('tot €'), false);
});

test('supplied discount fields are copied and missing ones stay null', () => {
  const selected = selectTradeTrackerCreatives(
    snapshot([creative({ discountFixed: '25', discountVariable: null, voucherCode: 'KEEP' })]),
  );
  assert.equal(selected.creatives[0]?.discountFixed, '25');
  assert.equal(selected.creatives[0]?.discountVariable, null);
  assert.equal(selected.creatives[0]?.voucherCode, 'KEEP');
});

test('unknown provider, non-canonical site, foreign campaign, and expiry are fail-closed', () => {
  const selected = selectTradeTrackerCreatives(
    snapshot([
      creative({ materialItemId: '1', campaignName: 'TUI', campaignUrl: 'https://www.tui.nl/' }),
      creative({ materialItemId: '2', affiliateSiteId: '512055' }),
      creative({ materialItemId: '3', campaignId: '1393', campaignName: 'Sunweb', campaignUrl: 'https://www.sunweb.nl/' }),
      creative({
        materialItemId: '4',
        validToDate: '2020-01-01',
        validity: validity(null, '2020-01-01'),
      }),
      creative({ materialItemId: '5', market: 'be', affiliateSiteId: '511873', campaignId: '38103', campaignName: 'Corendon.be', campaignUrl: 'https://www.corendon.be/' }),
    ]),
  );
  assert.equal(selected.selectedCount, 0);
  assert.deepEqual(
    selected.exclusions.map((item) => item.reason),
    [
      'unknown_provider',
      'non_canonical_site',
      'unknown_campaign',
      'expired',
      'market_mismatch',
    ],
  );
});

test('NL and BE outputs stay isolated', () => {
  const beClick = 'https://referral.corendon.be/c?c=38103&m=9&a=511873&r=&u=';
  const nl = selectTradeTrackerCreatives(snapshot([creative({ materialItemId: '55' })]));
  const be = selectTradeTrackerCreatives(
    snapshot(
      [
        creative({
          materialItemId: '9',
          market: 'be',
          affiliateSiteId: '511873',
          campaignId: '38103',
          campaignName: 'Corendon.be',
          campaignUrl: 'https://www.corendon.be/',
          trackingClickUrlTemplate: beClick,
          embedCode: `<a href="${beClick}"><img src="https://referral.corendon.be/i?c=38103&m=9&a=511873&r=" /></a>`,
        }),
      ],
      {
        market: 'be',
        scopedAffiliateSiteId: '511873',
        credentialScope: 'be',
        campaignIds: ['38103'],
      },
    ),
  );
  assert.deepEqual(nl.creatives.map((item) => item.market), ['nl']);
  assert.deepEqual(be.creatives.map((item) => item.market), ['be']);
  assert.equal(nl.creatives.some((item) => item.materialItemId === '9'), false);
  assert.equal(be.creatives.some((item) => item.materialItemId === '55'), false);
  assert.equal(be.creatives[0]?.provider, 'Corendon');
  assert.equal(be.creatives[0]?.trackingClickUrlTemplate, beClick);
});

test('different material ids are kept, including same name and same dimensions', () => {
  const selected = selectTradeTrackerCreatives(
    snapshot([
      creative({ materialItemId: '10', name: 'Banner1', width: 320, height: 50, dimensionId: '230' }),
      creative({ materialItemId: '11', name: 'Banner1', width: 320, height: 50, dimensionId: '230' }),
      creative({ materialItemId: '12', name: 'Banner1', width: 728, height: 90, dimensionId: '13' }),
      creative({ materialItemId: '13', name: 'Banner9', width: 970, height: 250, dimensionId: '237' }),
    ]),
  );
  assert.equal(selected.selectedCount, 4);
  assert.equal(selected.dedupe.collapsed, 0);
  assert.equal(selected.creatives.find((item) => item.materialItemId === '10')?.relation, 'same_dimension_distinct_material');
  assert.equal(selected.creatives.find((item) => item.materialItemId === '11')?.relation, 'same_dimension_distinct_material');
  assert.equal(selected.creatives.find((item) => item.materialItemId === '12')?.relation, 'dimension_variant');
  assert.equal(selected.creatives.find((item) => item.materialItemId === '13')?.relation, 'unique');
});

test('an identical material id keeps the newer row and drops the older one', () => {
  const olderClick = 'https://referral.corendon.nl/c?c=38108&m=55&a=512226&r=&u=older';
  const newerClick = 'https://referral.corendon.nl/c?c=38108&m=55&a=512226&r=&u=newer';
  const selected = selectTradeTrackerCreatives(
    snapshot([
      creative({
        modificationDate: '2024-01-01T00:00:00Z',
        trackingClickUrlTemplate: olderClick,
        embedCode: `<a href="${olderClick}"><img src="${NL_IMPRESSION}" /></a>`,
      }),
      creative({
        modificationDate: '2025-06-01T00:00:00Z',
        trackingClickUrlTemplate: newerClick,
        embedCode: `<a href="${newerClick}"><img src="${NL_IMPRESSION}" /></a>`,
        name: 'Banner5-updated',
      }),
    ]),
  );
  assert.equal(selected.selectedCount, 1);
  assert.equal(selected.dedupe.collapsed, 1);
  assert.equal(selected.creatives[0]?.title, 'Banner5-updated');
  assert.equal(selected.creatives[0]?.trackingClickUrlTemplate, newerClick);
  assert.equal(selected.exclusions[0]?.reason, 'duplicate_material');
});

test('selection does not perform HTTP', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'lib/tradetracker/promotions/select-creatives.ts'), 'utf8');
  assert.equal(/from 'node:https?'|fetch\s*\(/.test(source), false);
  const originalFetch = globalThis.fetch;
  const originalHttp = http.request;
  const originalHttps = https.request;
  globalThis.fetch = () => {
    throw new Error('unexpected fetch');
  };
  http.request = () => {
    throw new Error('unexpected http');
  };
  https.request = () => {
    throw new Error('unexpected https');
  };
  try {
    const selected = selectTradeTrackerCreatives(snapshot([creative()]));
    assert.equal(selected.selectedCount, 1);
    assert.match(selected.creatives[0]?.trackingClickUrlTemplate ?? '', /\/c\?/);
    assert.match(selected.creatives[0]?.impressionUrlTemplate ?? '', /\/i\?/);
  } finally {
    globalThis.fetch = originalFetch;
    http.request = originalHttp;
    https.request = originalHttps;
  }
});

test('live Slice 1 snapshots select every canonical Corendon creative', (t) => {
  const dir = path.join(process.cwd(), 'data', 'tradetracker-creatives');
  const nlPath = path.join(dir, 'snapshot-nl-512226.json');
  const bePath = path.join(dir, 'snapshot-be-511873.json');
  if (!fs.existsSync(nlPath) || !fs.existsSync(bePath)) {
    t.skip('Slice 1 snapshots are gitignored and are not in this checkout');
    return;
  }
  const nlSnap = JSON.parse(fs.readFileSync(nlPath, 'utf8')) as TradeTrackerCreativeSnapshot;
  const beSnap = JSON.parse(fs.readFileSync(bePath, 'utf8')) as TradeTrackerCreativeSnapshot;
  const nl = selectTradeTrackerCreatives(nlSnap, { sourceSnapshot: 'snapshot-nl-512226.json' });
  const be = selectTradeTrackerCreatives(beSnap, { sourceSnapshot: 'snapshot-be-511873.json' });
  assert.equal(nl.inputCount, 98);
  assert.equal(nl.selectedCount, 98);
  assert.equal(nl.excludedCount, 0);
  assert.deepEqual(nl.providers, { Corendon: 98 });
  assert.equal(be.inputCount, 27);
  assert.equal(be.selectedCount, 27);
  assert.equal(be.excludedCount, 0);
  assert.deepEqual(be.providers, { Corendon: 27 });
  assert.equal(nl.dedupe.collapsed, 0);
  assert.equal(be.dedupe.collapsed, 0);
  assert.equal(nl.creatives.every((item) => item.market === 'nl' && item.affiliateSiteId === '512226'), true);
  assert.equal(be.creatives.every((item) => item.market === 'be' && item.affiliateSiteId === '511873'), true);
  assert.equal(nl.creatives.every((item) => item.discountFixed == null && item.voucherCode == null), true);
  assert.equal(be.creatives.every((item) => item.trackingClickUrlTemplate.startsWith('https://referral.corendon.be/c?')), true);
  assert.equal(nl.creatives.every((item) => item.trackingClickUrlTemplate.startsWith('https://referral.corendon.nl/c?')), true);
});
