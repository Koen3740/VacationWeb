import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractCampaigns,
  isMalformedSoapEnvelope,
  normalizeAffiliateSite,
  normalizeCampaign,
  normalizeCampaignNewsItem,
  normalizeIncentiveItem,
} from './normalize';

const AS_OF = Date.UTC(2026, 8, 7, 12, 0, 0);
const SITE = { siteId: '512226', name: 'VacationWeb' };

test('normalizeCampaign keeps TradeTracker identity and category metadata', () => {
  const campaign = normalizeCampaign(
    {
      ID: 1488,
      name: 'Corendon BE',
      URL: 'https://www.corendon.be/',
      info: {
        campaignDescription: 'Official campaign info',
        category: { ID: 12, name: 'Travel' },
        assignmentStatus: 'accepted',
        trackingURL: 'https://tc.tradetracker.net/c?c=1488',
        startDate: '2020-01-01',
        stopDate: null,
        timeZone: 'Europe/Amsterdam',
      },
    },
    SITE,
  );
  assert.ok(campaign);
  assert.equal(campaign.kind, 'campaign');
  assert.equal(campaign.campaignId, '1488');
  assert.equal(campaign.campaignName, 'Corendon BE');
  assert.equal(campaign.campaignUrl, 'https://www.corendon.be/');
  assert.equal(campaign.campaignInfo, 'Official campaign info');
  assert.equal(campaign.campaignCategoryName, 'Travel');
  assert.equal(campaign.affiliateSiteId, '512226');
  assert.equal(campaign.source, 'tradetracker-affiliate-webservice');
});

test('provider/campaign mapping stays source-driven (distinct IDs are not rewritten)', () => {
  const a = normalizeCampaign({ ID: '1488', name: 'Corendon' }, SITE);
  const b = normalizeCampaign({ ID: '1393', name: 'Sunweb' }, SITE);
  assert.ok(a && b);
  assert.notEqual(a.campaignId, b.campaignId);
  assert.equal(a.campaignName, 'Corendon');
  assert.equal(b.campaignName, 'Sunweb');
});

test('campaign news identity, newsType, and dates are preserved', () => {
  const news = normalizeCampaignNewsItem(
    {
      ID: 99,
      campaignNewsType: 'campaign_update_vouchercode',
      title: 'New voucher',
      content: 'Source text only',
      publishDate: '2026-09-01',
      expirationDate: '2026-09-30',
      campaign: { ID: 1393, name: 'Sunweb', URL: 'https://www.sunweb.be/' },
    },
    AS_OF,
  );
  assert.ok(news);
  assert.equal(news.newsItemId, '99');
  assert.equal(news.newsType, 'campaign_update_vouchercode');
  assert.equal(news.kind, 'campaign_update');
  assert.equal(news.publishDate, '2026-09-01');
  assert.equal(news.expirationDate, '2026-09-30');
  assert.equal(news.campaignId, '1393');
  assert.equal(news.validity.isActive, true);
});

test('campaign_update_consumer is labeled consumer_promotion but is not a deal ranking', () => {
  const news = normalizeCampaignNewsItem(
    {
      ID: 1,
      campaignNewsType: 'campaign_update_consumer',
      title: 'Consumer note',
      content: 'Not a ranked deal',
      publishDate: '2026-09-01',
      expirationDate: null,
      campaign: { ID: 1327, name: 'Eliza' },
    },
    AS_OF,
  );
  assert.ok(news);
  assert.equal(news.kind, 'consumer_promotion');
  assert.equal(news.newsType, 'campaign_update_consumer');
});

test('optional news fields may be absent', () => {
  const news = normalizeCampaignNewsItem(
    {
      ID: '7',
      campaignNewsType: 'campaign_start',
      title: 'Started',
      content: '',
      campaign: {},
    },
    AS_OF,
  );
  assert.ok(news);
  assert.equal(news.expirationDate, null);
  assert.equal(news.campaignId, null);
  assert.equal(news.validity.status, 'undated');
});

test('incentive offer and voucher remain distinct kinds', () => {
  const offer = normalizeIncentiveItem(
    {
      ID: 10,
      name: 'Free transfer',
      description: 'Airport transfer',
      validFromDate: '2026-09-01',
      validToDate: null,
      campaign: { ID: 1488, name: 'Corendon' },
    },
    'incentive_offer',
    SITE,
    AS_OF,
  );
  const voucher = normalizeIncentiveItem(
    {
      ID: 11,
      name: 'Code item',
      voucherCode: 'SRC-ONLY',
      discountVariable: '10',
      validFromDate: '2026-09-01',
      validToDate: '2026-09-15',
      campaign: { ID: 1488, name: 'Corendon' },
    },
    'voucher',
    SITE,
    AS_OF,
  );
  assert.ok(offer && voucher);
  assert.equal(offer.kind, 'incentive_offer');
  assert.equal(voucher.kind, 'voucher');
  assert.equal(voucher.voucherCode, 'SRC-ONLY');
  assert.notEqual(offer.kind, voucher.kind);
});

test('malformed envelopes and campaign lists are detected', () => {
  assert.equal(isMalformedSoapEnvelope(null), true);
  assert.equal(isMalformedSoapEnvelope('oops'), true);
  assert.equal(isMalformedSoapEnvelope({ campaigns: { campaign: { ID: 1, name: 'A' } } }), false);
  assert.deepEqual(
    extractCampaigns({ campaigns: { campaign: { ID: 1, name: 'A' } } }).map((item) => (item as { ID: number }).ID),
    [1],
  );
});

test('normalize drops campaign records without identity', () => {
  assert.equal(normalizeCampaign({ name: 'Missing ID' }, SITE), null);
  assert.equal(normalizeAffiliateSite({ ID: 1 }), null);
});
