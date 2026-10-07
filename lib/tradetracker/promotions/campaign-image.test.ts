import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { clearFeedRegistryCache } from '../../feeds/feed-registry';
import { normalizeCampaign } from './normalize';
import { officialCampaignImageUrl, toPromotionCards } from './present-promotions';
import { dedupeDisplayablePromotions, selectDisplayablePromotions } from './select-displayable';
import type { TradeTrackerCampaignRecord, TradeTrackerPromotionSnapshot } from './types';

// All data in this file is TESTFIXTURE data. It never ships in the UI or in production code.
const AS_OF_MS = Date.parse('2026-10-04T12:00:00.000Z');
const IMAGE = 'https://cdn.tradetracker.net/nl/campaign_image_square/38108.png';

test('K: campaign image comes from info.imageURL (campaign records have no logoURL)', () => {
  const campaign = normalizeCampaign(
    {
      ID: '38108',
      name: 'Corendon NL',
      URL: 'https://www.corendon.nl/',
      info: { imageURL: IMAGE, trackingURL: 'https://referral.example.test/c?c=38108&m=0&a=1&r=&u=' },
    },
    { siteId: '512226', name: 'TESTFIXTURE site' },
  );
  assert.equal(campaign?.logoUrl, IMAGE);
});

test('K: a campaign without image stays null (no invented logo)', () => {
  const campaign = normalizeCampaign(
    { ID: '1', name: 'X', URL: 'https://x.test/', info: {} },
    { siteId: '512226', name: null },
  );
  assert.equal(campaign?.logoUrl, null);
});

test('K: only the official TradeTracker campaign image shape is accepted as provider logo', () => {
  assert.equal(officialCampaignImageUrl(IMAGE), IMAGE);
  assert.equal(officialCampaignImageUrl('https://cdn.tradetracker.net/be/campaign_image_square/1.jpg'), 'https://cdn.tradetracker.net/be/campaign_image_square/1.jpg');
  for (const bad of [
    null,
    undefined,
    '',
    'http://cdn.tradetracker.net/nl/campaign_image_square/1.png',
    'https://cdn.tradetracker.net/nl/campaign_image_square/1.png?x=1',
    'https://cdn.tradetracker.net/nl/support_merchant/EmailGuidelinesNL.pdf',
    'https://evil.example.test/nl/campaign_image_square/1.png',
    'https://cdn.tradetracker.net.evil.test/nl/campaign_image_square/1.png',
    'https://user:pw@cdn.tradetracker.net/nl/campaign_image_square/1.png',
    'https://static.tradetracker.net/nl/material_image/2b/a16af0.jpg',
    'not a url',
  ]) {
    assert.equal(officialCampaignImageUrl(bad as string | null | undefined), null, String(bad));
  }
});

function campaign(logoUrl: string | null): TradeTrackerCampaignRecord {
  return {
    source: 'tradetracker-affiliate-webservice',
    kind: 'campaign',
    campaignId: '38108',
    campaignName: 'Corendon NL',
    campaignUrl: 'https://www.corendon.nl/',
    campaignInfo: null,
    campaignCategoryId: null,
    campaignCategoryName: null,
    assignmentStatus: 'accepted',
    logoUrl,
    trackingUrl: null,
    campaignStartDate: null,
    campaignStopDate: null,
    campaignTimeZone: null,
    affiliateSiteId: '512226',
    affiliateSiteName: null,
  } as TradeTrackerCampaignRecord;
}

function snapshotWith(logoUrl: string | null): TradeTrackerPromotionSnapshot {
  return {
    source: 'tradetracker-affiliate-webservice',
    ingestedAt: '2026-10-04T12:00:00.000Z',
    wsdlUrl: 'https://ws.tradetracker.com/soap-literal-wsi/affiliate?wsdl',
    scopedAffiliateSiteId: '512226',
    affiliateSites: [],
    campaigns: [campaign(logoUrl)],
    newsItems: [
      {
        source: 'tradetracker-affiliate-webservice',
        kind: 'consumer_promotion',
        newsItemId: '1',
        newsType: 'campaign_update_consumer',
        title: 'TESTFIXTURE Actie',
        content: 'Actie: TESTFIXTURE korting',
        publishDate: '2026-09-15',
        expirationDate: '2026-11-02',
        campaignId: '38108',
        campaignName: 'Corendon NL',
        campaignUrl: 'https://www.corendon.nl/',
        validity: {
          status: 'active',
          isActive: true,
          asOfUtcDate: '2026-10-04',
          startDate: '2026-09-15',
          endDate: '2026-11-02',
          timezoneAssumption: 'utc-calendar-date',
        },
        sourceMetadata: {},
      },
    ],
    incentiveOffers: [],
    vouchers: [],
    methodErrors: [],
  } as TradeTrackerPromotionSnapshot;
}

test('K: the provider logo is joined on campaignId and ends up on the card; href is untouched', () => {
  clearFeedRegistryCache();
  const promotions = dedupeDisplayablePromotions(selectDisplayablePromotions(snapshotWith(IMAGE)));
  assert.equal(promotions.length, 1);
  assert.equal(promotions[0]!.providerLogoUrl, IMAGE);
  const cards = toPromotionCards(promotions, AS_OF_MS);
  assert.equal(cards[0]!.providerLogo, IMAGE);
  assert.equal(cards[0]!.links[0]!.href, 'https://www.corendon.nl/');
});

test('K: without a campaign image the card has no logo (text-first monogram fallback)', () => {
  clearFeedRegistryCache();
  const promotions = dedupeDisplayablePromotions(selectDisplayablePromotions(snapshotWith(null)));
  const cards = toPromotionCards(promotions, AS_OF_MS);
  assert.equal(cards[0]!.providerLogo, null);
});

test('K: a non-official image URL in the data is dropped, never rendered', () => {
  clearFeedRegistryCache();
  const promotions = dedupeDisplayablePromotions(
    selectDisplayablePromotions(snapshotWith('https://evil.example.test/logo.png')),
  );
  const cards = toPromotionCards(promotions, AS_OF_MS);
  assert.equal(cards[0]!.providerLogo, null);
});

test('L: the displayable result survives the Next.js data cache (JSON round trip) and the loader caches only that', () => {
  clearFeedRegistryCache();
  const selected = selectDisplayablePromotions(snapshotWith(IMAGE), '512226');
  assert.deepEqual(JSON.parse(JSON.stringify(selected)), selected);
  // The raw snapshot of a real site is ~3.4 MB (> 2 MB data-cache item limit); the displayable subset is tiny.
  assert.ok(JSON.stringify(selected).length < 100_000);
  const source = readFileSync(
    `${process.cwd()}/lib/tradetracker/promotions/load-for-page.ts`,
    'utf8',
  );
  assert.match(source, /unstable_cache\(\s*async \(affiliateSiteId: string\) => displayableForSite\(affiliateSiteId\)/);
  assert.doesNotMatch(source, /unstable_cache\(\s*async \(affiliateSiteId: string\) => ingestSite/);
});
