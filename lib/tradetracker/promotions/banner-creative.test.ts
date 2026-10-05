import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MKDIGITALMEDIA_BE_AFFILIATE_SITE_ID,
  MKDIGITALMEDIA_NL_AFFILIATE_SITE_ID,
  TRADETRACKER_CREATIVE_CAMPAIGNS_V1,
  TRADETRACKER_CREATIVE_CANONICAL_SITE,
  VACATIONWEB_BE_AFFILIATE_SITE_ID,
  VACATIONWEB_NL_AFFILIATE_SITE_ID,
} from './constants';
import { creativeIngestTargets } from './ingest-creatives';
import { normalizeBannerCreativeItem, parseBannerEmbedCode } from './normalize';

const AS_OF = Date.UTC(2026, 9, 5, 12, 0, 0);
const FETCHED_AT = '2026-10-05T12:00:00.000Z';

const NL_EMBED =
  '<a href="https://referral.corendon.nl/c?c=38108&amp;m=2315769&amp;a=512226&amp;r=&amp;u=" target="_blank" rel="nofollow">' +
  '<img src="https://ti.tradetracker.net/i?c=38108&amp;m=2315769&amp;a=512226&amp;r=" width="300" height="250" alt="" />' +
  '</a>';

test('canonical creative sites are NL 512226 and BE 511873', () => {
  assert.equal(VACATIONWEB_NL_AFFILIATE_SITE_ID, '512226');
  assert.equal(VACATIONWEB_BE_AFFILIATE_SITE_ID, '511873');
  assert.equal(MKDIGITALMEDIA_NL_AFFILIATE_SITE_ID, '512055');
  assert.equal(MKDIGITALMEDIA_BE_AFFILIATE_SITE_ID, '511747');
  assert.notEqual(VACATIONWEB_BE_AFFILIATE_SITE_ID, MKDIGITALMEDIA_NL_AFFILIATE_SITE_ID);
  assert.deepEqual(
    creativeIngestTargets(false).map((target) => ({
      market: target.market,
      affiliateSiteId: target.affiliateSiteId,
      campaignIds: [...target.campaignIds],
    })),
    [
      { market: 'nl', affiliateSiteId: '512226', campaignIds: ['38108'] },
      { market: 'be', affiliateSiteId: '511873', campaignIds: ['38103'] },
    ],
  );
  assert.equal(TRADETRACKER_CREATIVE_CANONICAL_SITE.be, '511873');
  assert.deepEqual(
    creativeIngestTargets(true).map((target) => target.affiliateSiteId),
    ['512226', '512055', '511873', '511747'],
  );
  assert.equal(TRADETRACKER_CREATIVE_CAMPAIGNS_V1.nl[0]?.label, 'Corendon NL');
  assert.equal(TRADETRACKER_CREATIVE_CAMPAIGNS_V1.be[0]?.label, 'Corendon BE');
});

test('parseBannerEmbedCode extracts click and impression templates without treating /i as a static image', () => {
  const parsed = parseBannerEmbedCode(NL_EMBED);
  assert.equal(
    parsed.trackingClickUrlTemplate,
    'https://referral.corendon.nl/c?c=38108&m=2315769&a=512226&r=&u=',
  );
  assert.equal(
    parsed.impressionUrlTemplate,
    'https://ti.tradetracker.net/i?c=38108&m=2315769&a=512226&r=',
  );
  assert.equal(parsed.staticImageUrlHint, null);
  assert.deepEqual(parsed.hosts.sort(), ['referral.corendon.nl', 'ti.tradetracker.net']);
});

test('parseBannerEmbedCode keeps a static.tradetracker.net image reference and a BE click template', () => {
  const code =
    '<a href="https://referral.corendon.be/c?c=38103&m=99&a=511873&r=&u=">' +
    '<img src="https://static.tradetracker.net/nl/campaign/38103/banner.png" />' +
    '</a>';
  const parsed = parseBannerEmbedCode(code);
  assert.equal(parsed.trackingClickUrlTemplate, 'https://referral.corendon.be/c?c=38103&m=99&a=511873&r=&u=');
  assert.equal(parsed.impressionUrlTemplate, null);
  assert.equal(parsed.staticImageUrlHint, 'https://static.tradetracker.net/nl/campaign/38103/banner.png');
});

test('normalizeBannerCreativeItem maps SOAP material fields and does not invent discounts', () => {
  const creative = normalizeBannerCreativeItem(
    {
      ID: 2315769,
      name: 'Banner5-lastminute',
      creationDate: '2024-03-01T08:15:00+01:00',
      modificationDate: null,
      materialBannerDimension: {
        ID: 8,
        width: 300,
        height: '250',
        isCommon: true,
        isMobile: 'false',
      },
      referenceSupported: true,
      description: null,
      conditions: null,
      validFromDate: null,
      validToDate: null,
      discountFixed: null,
      discountVariable: null,
      voucherCode: null,
      code: NL_EMBED,
      campaign: { ID: 38108, name: 'Corendon NL', URL: 'https://www.corendon.nl/' },
    },
    {
      market: 'nl',
      affiliateSiteId: '512226',
      fetchedAt: FETCHED_AT,
      asOfMs: AS_OF,
    },
  );

  assert.ok(creative);
  assert.equal(creative.source, 'tradetracker-affiliate-webservice');
  assert.equal(creative.kind, 'banner_image');
  assert.equal(creative.materialItemId, '2315769');
  assert.equal(creative.name, 'Banner5-lastminute');
  assert.equal(creative.campaignId, '38108');
  assert.equal(creative.campaignName, 'Corendon NL');
  assert.equal(creative.market, 'nl');
  assert.equal(creative.affiliateSiteId, '512226');
  assert.equal(creative.width, 300);
  assert.equal(creative.height, 250);
  assert.equal(creative.dimensionId, '8');
  assert.equal(creative.isCommon, true);
  assert.equal(creative.isMobile, false);
  assert.equal(creative.referenceSupported, true);
  assert.equal(creative.discountFixed, null);
  assert.equal(creative.discountVariable, null);
  assert.equal(creative.voucherCode, null);
  assert.equal(creative.status, null);
  assert.equal(creative.validFromDate, null);
  assert.equal(creative.validity.status, 'undated');
  assert.equal(creative.creationDate, '2024-03-01T08:15:00+01:00');
  assert.equal(creative.modificationDate, null);
  assert.equal(creative.fetchedAt, FETCHED_AT);
  assert.match(creative.embedCode ?? '', /\/c\?/);
  assert.match(creative.trackingClickUrlTemplate ?? '', /\/c\?c=38108&m=2315769&a=512226/);
  assert.equal(creative.staticImageUrlHint, null);
});

test('normalizeBannerCreativeItem drops rows without an id or name', () => {
  const context = {
    market: 'be' as const,
    affiliateSiteId: '511873',
    fetchedAt: FETCHED_AT,
    asOfMs: AS_OF,
  };
  assert.equal(normalizeBannerCreativeItem({ name: 'Missing ID' }, context), null);
  assert.equal(normalizeBannerCreativeItem({ ID: 1 }, context), null);
});
