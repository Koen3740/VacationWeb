import assert from 'node:assert/strict';
import test from 'node:test';
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

test('keeps active consumer/voucher/incentive news and drops ops news', () => {
  const selected = selectDisplayablePromotions(
    baseSnapshot({
      newsItems: [
        {
          source: 'tradetracker-affiliate-webservice',
          kind: 'consumer_promotion',
          newsItemId: '1',
          newsType: 'campaign_update_consumer',
          title: 'Zomeractie',
          content: 'Officiële consumentenpromotie',
          publishDate: '2026-09-01',
          expirationDate: '2026-09-30',
          campaignId: '1488',
          campaignName: 'Corendon',
          campaignUrl: 'https://www.corendon.be/',
          validity: activeValidity('2026-09-01', '2026-09-30'),
          sourceMetadata: {},
        },
        {
          source: 'tradetracker-affiliate-webservice',
          kind: 'campaign_update',
          newsItemId: '2',
          newsType: 'campaign_update_general',
          title: 'Feed update',
          content: 'Niet tonen als aanbieding',
          publishDate: '2026-09-01',
          expirationDate: null,
          campaignId: '1488',
          campaignName: 'Corendon',
          campaignUrl: null,
          validity: activeValidity('2026-09-01'),
          sourceMetadata: {},
        },
        {
          source: 'tradetracker-affiliate-webservice',
          kind: 'campaign_start',
          newsItemId: '3',
          newsType: 'campaign_start',
          title: 'Campagne gestart',
          content: 'Ops',
          publishDate: '2026-09-01',
          expirationDate: null,
          campaignId: '1488',
          campaignName: 'Corendon',
          campaignUrl: null,
          validity: activeValidity('2026-09-01'),
          sourceMetadata: {},
        },
      ],
    }),
    'nl',
  );
  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.kind, 'consumer_promotion');
  assert.equal(selected[0]?.campaignName, 'Corendon');
});

test('excludes expired and future promotions', () => {
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
          campaignId: '1',
          campaignName: 'A',
          campaignUrl: null,
          validity: expiredValidity(),
          sourceMetadata: {},
        },
      ],
      vouchers: [
        {
          source: 'tradetracker-affiliate-webservice',
          kind: 'voucher',
          materialItemId: '20',
          name: 'Future voucher',
          description: null,
          conditions: null,
          validFromDate: '2026-12-01',
          validToDate: null,
          discountFixed: null,
          discountVariable: null,
          voucherCode: 'X',
          campaignId: '1',
          campaignName: 'A',
          campaignUrl: null,
          affiliateSiteId: '512226',
          affiliateSiteName: 'Vacationweb.nl',
          validity: {
            status: 'scheduled',
            isActive: false,
            asOfUtcDate: '2026-09-09',
            startDate: '2026-12-01',
            endDate: null,
            timezoneAssumption: 'utc-calendar-date',
          },
          sourceMetadata: {},
        },
      ],
    }),
    'nl',
  );
  assert.equal(selected.length, 0);
});

test('includes active vouchers and keeps BE/NL market labels separate', () => {
  const selected = selectDisplayablePromotions(
    baseSnapshot({
      scopedAffiliateSiteId: '512055',
      vouchers: [
        {
          source: 'tradetracker-affiliate-webservice',
          kind: 'voucher',
          materialItemId: '99',
          name: 'Hotel korting',
          description: 'Officiële vouchertekst',
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
  assert.equal(selected.length, 1);
  assert.equal(selected[0]?.market, 'be');
  assert.equal(selected[0]?.affiliateSiteId, '512055');
  assert.equal(selected[0]?.kind, 'voucher');
  assert.match(selected[0]?.content ?? '', /SAVE/);
});
