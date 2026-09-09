import assert from 'node:assert/strict';
import test from 'node:test';
import { clearFeedRegistryCache } from '../../feeds/feed-registry';
import {
  getConnectedTradeTrackerCampaignIds,
  resolveConnectedProvider,
} from './connected-providers';
import { selectDisplayablePromotions } from './select-displayable';
import type { TradeTrackerPromotionSnapshot } from './types';

const AS_OF = '2026-09-09T12:00:00.000Z';

function baseSnapshot(
  overrides: Partial<TradeTrackerPromotionSnapshot> = {},
): TradeTrackerPromotionSnapshot {
  return {
    source: 'tradetracker-affiliate-webservice',
    ingestedAt: AS_OF,
    wsdlUrl: 'https://ws.tradetracker.com/soap-literal-wsi/affiliate?wsdl',
    scopedAffiliateSiteId: '512226',
    affiliateSites: [],
    campaigns: [],
    newsItems: [],
    incentiveOffers: [],
    vouchers: [],
    methodErrors: [],
    ...overrides,
  };
}

function activeValidity(start: string, end: string | null = null) {
  return {
    status: 'active' as const,
    isActive: true,
    asOfUtcDate: '2026-09-09',
    startDate: start,
    endDate: end,
    timezoneAssumption: 'utc-calendar-date' as const,
  };
}

function expiredValidity() {
  return {
    status: 'expired' as const,
    isActive: false,
    asOfUtcDate: '2026-09-09',
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    timezoneAssumption: 'utc-calendar-date' as const,
  };
}

test('connected campaign IDs come from enabled feed-manifest providers', () => {
  clearFeedRegistryCache();
  const ids = getConnectedTradeTrackerCampaignIds();
  assert.equal(ids.has('38108'), true);
  assert.equal(ids.has('38103'), true);
  assert.equal(ids.has('1393'), true);
  assert.equal(ids.has('1327'), true);
  // Prijsvrij is disabled / parked — not an active Results provider campaign set.
  assert.equal(ids.has('25331'), false);
});

test('resolveConnectedProvider accepts Corendon/Sunweb/Eliza and rejects Alsa/Journaway', () => {
  clearFeedRegistryCache();
  assert.equal(
    resolveConnectedProvider({ campaignId: '38108', campaignName: 'Corendon NL' }),
    'Corendon',
  );
  assert.equal(
    resolveConnectedProvider({ campaignId: null, campaignName: 'Sunweb Zomer' }),
    'Sunweb',
  );
  assert.equal(
    resolveConnectedProvider({ campaignId: '1327', campaignName: 'Eliza was here' }),
    'Eliza was here',
  );
  assert.equal(
    resolveConnectedProvider({ campaignId: null, campaignName: 'alsa-nature.nl' }),
    null,
  );
  assert.equal(
    resolveConnectedProvider({ campaignId: null, campaignName: 'Journaway.com/nl' }),
    null,
  );
});

test('keeps active Corendon consumer promo and drops Alsa-Nature / Journaway / ops news', () => {
  clearFeedRegistryCache();
  const selected = selectDisplayablePromotions(
    baseSnapshot({
      newsItems: [
        {
          source: 'tradetracker-affiliate-webservice',
          kind: 'consumer_promotion',
          newsItemId: '1',
          newsType: 'campaign_update_consumer',
          title: 'Corendon NL - Nazomer Deals',
          content: 'Boek nu je nazomervakantie met Corendon.',
          publishDate: '2026-09-01',
          expirationDate: '2026-09-30',
          campaignId: '38108',
          campaignName: 'Corendon NL',
          campaignUrl: 'https://www.corendon.nl/',
          validity: activeValidity('2026-09-01', '2026-09-30'),
          sourceMetadata: {},
        },
        {
          source: 'tradetracker-affiliate-webservice',
          kind: 'consumer_promotion',
          newsItemId: '2',
          newsType: 'campaign_update_consumer',
          title: 'Nieuwe kortingscodes',
          content: 'Alsa-nature.nl actie',
          publishDate: '2026-09-01',
          expirationDate: null,
          campaignId: '999',
          campaignName: 'alsa-nature.nl',
          campaignUrl: 'https://www.alsa-nature.nl/',
          validity: activeValidity('2026-09-01'),
          sourceMetadata: {},
        },
        {
          source: 'tradetracker-affiliate-webservice',
          kind: 'consumer_promotion',
          newsItemId: '3',
          newsType: 'campaign_update_consumer',
          title: '2for1 America Deals',
          content: 'Journaway bundelt acties',
          publishDate: '2026-09-01',
          expirationDate: null,
          campaignId: '888',
          campaignName: 'Journaway.com/nl',
          campaignUrl: 'https://journaway.com/',
          validity: activeValidity('2026-09-01'),
          sourceMetadata: {},
        },
        {
          source: 'tradetracker-affiliate-webservice',
          kind: 'campaign_update',
          newsItemId: '4',
          newsType: 'campaign_update_general',
          title: 'Feed update',
          content: 'Niet tonen',
          publishDate: '2026-09-01',
          expirationDate: null,
          campaignId: '38108',
          campaignName: 'Corendon NL',
          campaignUrl: null,
          validity: activeValidity('2026-09-01'),
          sourceMetadata: {},
        },
      ],
    }),
    'nl',
  );
  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.providerName, 'Corendon');
  assert.equal(selected[0]?.title, 'Nazomer Deals');
  assert.match(selected[0]?.summary ?? '', /nazomer/i);
  assert.equal('affiliateSiteId' in (selected[0] as object), false);
});

test('excludes expired promotions even for connected providers', () => {
  clearFeedRegistryCache();
  const selected = selectDisplayablePromotions(
    baseSnapshot({
      newsItems: [
        {
          source: 'tradetracker-affiliate-webservice',
          kind: 'consumer_promotion',
          newsItemId: '10',
          newsType: 'campaign_update_consumer',
          title: 'Verlopen',
          content: 'x',
          publishDate: '2026-01-01',
          expirationDate: '2026-01-31',
          campaignId: '38108',
          campaignName: 'Corendon NL',
          campaignUrl: null,
          validity: expiredValidity(),
          sourceMetadata: {},
        },
      ],
    }),
    'nl',
  );
  assert.equal(selected.length, 0);
});

test('H10 Hotels voucher is excluded because provider is not connected', () => {
  clearFeedRegistryCache();
  const selected = selectDisplayablePromotions(
    baseSnapshot({
      scopedAffiliateSiteId: '512055',
      vouchers: [
        {
          source: 'tradetracker-affiliate-webservice',
          kind: 'voucher',
          materialItemId: '99',
          name: 'Get up to 25% off on stays - H10 Hotels',
          description: 'Travel this autumn',
          conditions: null,
          validFromDate: '2026-09-01',
          validToDate: '2026-09-30',
          discountFixed: null,
          discountVariable: null,
          voucherCode: 'SAVE',
          campaignId: '8339',
          campaignName: 'H10 Hotels',
          campaignUrl: 'https://example.com',
          affiliateSiteId: '512055',
          affiliateSiteName: 'VacationWeb.be',
          validity: activeValidity('2026-09-01', '2026-09-30'),
          sourceMetadata: {},
        },
      ],
    }),
    'be',
  );
  assert.equal(selected.length, 0);
});
