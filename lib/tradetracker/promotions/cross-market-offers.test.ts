/**
 * SUB 33C — BE/NL as separate TradeTracker sources and exact cross-market dedupe.
 *
 * Data labels:
 * - [CONSTRUCTED] tests build TradeTracker banner records by hand to cover edge cases
 *   (identical / different amounts, texts, conditions). They prove the rule, not live data.
 * - [REAL] tests read `__fixtures__/sub33c-real-tradetracker-2026-10-06.json.gz`, captured
 *   from a read-only live run (getCampaigns accepted + getMaterialBannerImageItems) with
 *   each market's own access key on its own canonical site. No secrets in the fixture.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { gunzipSync } from 'node:zlib';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AanbiedingenEmptyState, AanbiedingenExperience } from '@/components/promotions/aanbiedingen-experience';
import { composeAanbiedingenCards } from './compose-aanbiedingen';
import { TRADETRACKER_AFFILIATE_WSDL_URL, TRADETRACKER_SOURCE, type TradeTrackerCredentialMarket } from './constants';
import {
  CROSS_MARKET_COMPARISON_FIELDS,
  crossMarketDifferences,
  crossMarketSections,
  dedupeCrossMarketOffers,
  offersForSiteMarket,
  type CrossMarketOffer,
} from './cross-market-offers';
import type { EditorialOffer } from './editorial-offers';
import { impressionUrlFromEmbed } from './creative-images';
import { acceptedCampaignsFromPayload, creativeIngestTargets } from './ingest-creatives';
import { presentAanbiedingenOffers } from './present-aanbiedingen';
import { promotionClickHref } from './promotion-click';
import { selectTradeTrackerCreatives } from './select-creatives';
import type {
  TradeTrackerAccessibleCampaign,
  TradeTrackerBannerCreativeRecord,
  TradeTrackerCreativeSnapshot,
} from './types';
import { promotionalValidity } from './validity';

const AS_OF = Date.UTC(2026, 9, 6, 12, 0, 0);
const FETCHED_AT = '2026-10-06T12:00:00.000Z';
const SITE: Record<TradeTrackerCredentialMarket, string> = { be: '511873', nl: '512226' };

// ---------------------------------------------------------------------------
// [CONSTRUCTED] helpers
// ---------------------------------------------------------------------------

type Market = TradeTrackerCredentialMarket;

const CAMPAIGN: Record<Market, { id: string; name: string; url: string; host: string }> = {
  be: { id: '38103', name: 'Corendon.be', url: 'https://www.corendon.be/', host: 'referral.corendon.be' },
  nl: { id: '38108', name: 'Corendon NL', url: 'https://www.corendon.nl/', host: 'referral.corendon.nl' },
};

function click(market: Market, materialItemId: string, campaignId = CAMPAIGN[market].id): string {
  return `https://${CAMPAIGN[market].host}/c?c=${campaignId}&m=${materialItemId}&a=${SITE[market]}&r=&u=`;
}

function banner(market: Market, materialItemId: string, overrides: Partial<TradeTrackerBannerCreativeRecord> = {}): TradeTrackerBannerCreativeRecord {
  const campaign = CAMPAIGN[market];
  const clickUrl = click(market, materialItemId, overrides.campaignId ?? campaign.id);
  const impression = clickUrl.replace('/c?', '/i?').replace('&u=', '');
  const validFromDate = overrides.validFromDate ?? '2026-10-01';
  const validToDate = overrides.validToDate ?? '2026-12-31';
  return {
    source: TRADETRACKER_SOURCE,
    kind: 'banner_image',
    materialItemId,
    name: 'Tot €300 vroegboekkorting',
    campaignId: campaign.id,
    campaignName: campaign.name,
    campaignUrl: campaign.url,
    affiliateSiteId: SITE[market],
    market,
    width: 728,
    height: 90,
    dimensionId: '13',
    isMobile: false,
    isCommon: true,
    referenceSupported: true,
    description: 'Boek je zomervakantie 2027 vroeg',
    conditions: 'Geldig op nieuwe boekingen vanaf 2 personen',
    validFromDate,
    validToDate,
    discountFixed: null,
    discountVariable: null,
    voucherCode: null,
    creationDate: '2026-10-01T00:00:00+00:00',
    modificationDate: '2026-10-01T00:00:00+00:00',
    status: null,
    embedCode: `<a href="${clickUrl}"><img src="${impression}" width="728" height="90" /></a>`,
    trackingClickUrlTemplate: clickUrl,
    impressionUrlTemplate: impression,
    staticImageUrlHint: null,
    validity: promotionalValidity({ startDate: validFromDate, endDate: validToDate, asOfMs: AS_OF }),
    fetchedAt: FETCHED_AT,
    sourceMetadata: {},
    ...overrides,
  };
}

function accepted(market: Market, extra: TradeTrackerAccessibleCampaign[] = []): TradeTrackerAccessibleCampaign[] {
  const campaign = CAMPAIGN[market];
  return [
    { campaignId: campaign.id, campaignName: campaign.name, campaignUrl: campaign.url, assignmentStatus: 'accepted', provider: 'Corendon' },
    ...extra,
  ];
}

function snapshotFor(
  market: Market,
  creatives: TradeTrackerBannerCreativeRecord[],
  acceptedCampaigns: TradeTrackerAccessibleCampaign[] = accepted(market),
): TradeTrackerCreativeSnapshot {
  return {
    source: TRADETRACKER_SOURCE,
    ingestedAt: FETCHED_AT,
    wsdlUrl: TRADETRACKER_AFFILIATE_WSDL_URL,
    market,
    scopedAffiliateSiteId: SITE[market],
    credentialScope: market,
    imageDelivery: 'metadata-and-embed-code',
    campaignIds: acceptedCampaigns.map((campaign) => campaign.campaignId),
    acceptedCampaigns,
    creatives,
    methodErrors: [],
    counts: { creatives: creatives.length, campaignsRequested: acceptedCampaigns.length, methodErrors: 0, byCampaignId: {} },
  };
}

/** The existing chain per market: select → compose (benefit filter) → present. */
function offersFor(snapshot: TradeTrackerCreativeSnapshot, asOfMs = AS_OF): EditorialOffer[] {
  const selected = selectTradeTrackerCreatives(snapshot, { asOfMs });
  const cards = composeAanbiedingenCards({ market: snapshot.market, creatives: selected.creatives, secondary: [] });
  return presentAanbiedingenOffers(snapshot.market, cards, asOfMs);
}

function merge(be: EditorialOffer[], nl: EditorialOffer[]): CrossMarketOffer[] {
  return dedupeCrossMarketOffers([
    { market: 'be', offers: be },
    { market: 'nl', offers: nl },
  ]);
}

function siteOf(url: string): string | null {
  const parsed = new URL(url);
  return parsed.searchParams.get('a') ?? /^\d+_\d+_(\d+)_/.exec(parsed.searchParams.get('tt') ?? '')?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// Required scenarios 1–10
// ---------------------------------------------------------------------------

test('1 [CONSTRUCTED] BE-only campaign gives exactly one BE offer with a BE clickout', () => {
  const offers = merge(offersFor(snapshotFor('be', [banner('be', '9001')])), []);
  assert.equal(offers.length, 1);
  assert.deepEqual(offers[0]?.markets, ['be']);
  assert.deepEqual(offers[0]?.clickouts.map((item) => item.market), ['be']);
  assert.equal(siteOf(offers[0]!.clickouts[0]!.url), '511873');
});

test('2 [CONSTRUCTED] NL-only campaign gives exactly one NL offer with an NL clickout', () => {
  const offers = merge([], offersFor(snapshotFor('nl', [banner('nl', '8001')])));
  assert.equal(offers.length, 1);
  assert.deepEqual(offers[0]?.markets, ['nl']);
  assert.equal(siteOf(offers[0]!.clickouts[0]!.url), '512226');
});

test('3 [CONSTRUCTED] identical customer-facing content in BE and NL gives one offer for BE+NL', () => {
  const be = offersFor(snapshotFor('be', [banner('be', '9001')]));
  const nl = offersFor(snapshotFor('nl', [banner('nl', '8001')]));
  assert.equal(be.length, 1);
  assert.equal(nl.length, 1);
  assert.deepEqual(crossMarketDifferences(be[0]!, nl[0]!), []);
  const offers = merge(be, nl);
  assert.equal(offers.length, 1);
  assert.deepEqual(offers[0]?.markets, ['be', 'nl']);
});

test('4 [CONSTRUCTED] same concept with a different amount stays two offers (€250 BE vs €300 NL)', () => {
  const be = offersFor(snapshotFor('be', [banner('be', '9001', { name: 'Tot €250 vroegboekkorting' })]));
  const nl = offersFor(snapshotFor('nl', [banner('nl', '8001', { name: 'Tot €300 vroegboekkorting' })]));
  const offers = merge(be, nl);
  assert.equal(offers.length, 2);
  assert.deepEqual(offers.map((offer) => offer.markets.join('+')).sort(), ['be', 'nl']);
  assert.ok(crossMarketDifferences(be[0]!, nl[0]!).includes('benefitAmount'));
});

test('5 [CONSTRUCTED] different customer text stays two offers', () => {
  const be = offersFor(snapshotFor('be', [banner('be', '9001', { name: 'Tot €300 vroegboekkorting' })]));
  const nl = offersFor(snapshotFor('nl', [banner('nl', '8001', { name: 'Tot €300 vroegboekkorting + gratis bagage' })]));
  const offers = merge(be, nl);
  assert.equal(offers.length, 2);
  assert.ok(crossMarketDifferences(be[0]!, nl[0]!).includes('title'));
  const summaryOnly = merge(
    be,
    offersFor(snapshotFor('nl', [banner('nl', '8002', { description: 'Boek je zomervakantie 2027 nu' })])),
  );
  assert.equal(summaryOnly.length, 2);
});

test('6 [CONSTRUCTED] different conditions or period stay two offers', () => {
  const be = offersFor(snapshotFor('be', [banner('be', '9001')]));
  const conditions = offersFor(snapshotFor('nl', [banner('nl', '8001', { conditions: 'Geldig op nieuwe boekingen vanaf 4 personen' })]));
  assert.equal(merge(be, conditions).length, 2);
  assert.deepEqual(crossMarketDifferences(be[0]!, conditions[0]!), ['conditions']);
  const period = offersFor(snapshotFor('nl', [banner('nl', '8002', { validToDate: '2026-11-30' })]));
  assert.equal(merge(be, period).length, 2);
  assert.deepEqual(crossMarketDifferences(be[0]!, period[0]!), ['validTo']);
});

test('7 [CONSTRUCTED] a campaign accepted only on BE never produces an NL offer', () => {
  // NL snapshot carries a creative of the BE campaign, but the NL accepted list does not contain it.
  const leaked = banner('nl', '7001', {
    campaignId: '38103',
    campaignName: 'Corendon.be',
    campaignUrl: 'https://www.corendon.be/',
    trackingClickUrlTemplate: 'https://referral.corendon.be/c?c=38103&m=7001&a=512226&r=&u=',
  });
  const nlSnapshot = snapshotFor('nl', [leaked]);
  const selected = selectTradeTrackerCreatives(nlSnapshot, { asOfMs: AS_OF });
  assert.equal(selected.selectedCount, 0);
  assert.deepEqual(selected.exclusions.map((item) => item.reason), ['campaign_not_accepted_in_market']);
  const offers = merge(offersFor(snapshotFor('be', [banner('be', '9001')])), offersFor(nlSnapshot));
  assert.deepEqual(offers.map((offer) => offer.markets), [['be']]);
  assert.equal(offersForSiteMarket(offers, 'nl').length, 0);
});

test('8 [CONSTRUCTED] a campaign accepted only on NL never produces a BE offer', () => {
  const leaked = banner('be', '7002', {
    campaignId: '38108',
    campaignName: 'Corendon NL',
    campaignUrl: 'https://www.corendon.nl/',
    trackingClickUrlTemplate: 'https://referral.corendon.nl/c?c=38108&m=7002&a=511873&r=&u=',
  });
  const beSnapshot = snapshotFor('be', [leaked]);
  assert.equal(selectTradeTrackerCreatives(beSnapshot, { asOfMs: AS_OF }).selectedCount, 0);
  const offers = merge(offersFor(beSnapshot), offersFor(snapshotFor('nl', [banner('nl', '8001')])));
  assert.deepEqual(offers.map((offer) => offer.markets), [['nl']]);
  assert.equal(offersForSiteMarket(offers, 'be').length, 0);
});

test('9 [CONSTRUCTED] an exact shared offer keeps both market clickouts; each site gets only its own', () => {
  const be = offersFor(snapshotFor('be', [banner('be', '9001')]));
  const nl = offersFor(snapshotFor('nl', [banner('nl', '8001')]));
  const [shared] = merge(be, nl);
  assert.ok(shared);
  assert.equal(shared.clickUrl, '');
  assert.deepEqual(
    shared.clickouts.map((item) => [item.market, siteOf(item.url), new URL(item.url).hostname]),
    [
      ['be', '511873', 'referral.corendon.be'],
      ['nl', '512226', 'referral.corendon.nl'],
    ],
  );
  const beSite = offersForSiteMarket([shared], 'be');
  const nlSite = offersForSiteMarket([shared], 'nl');
  assert.equal(beSite.length, 1);
  assert.equal(nlSite.length, 1);
  assert.equal(siteOf(beSite[0]!.clickUrl), '511873');
  assert.equal(siteOf(nlSite[0]!.clickUrl), '512226');
  assert.deepEqual(beSite[0]?.clickouts.map((item) => item.market), ['be']);
  assert.deepEqual(nlSite[0]?.clickouts.map((item) => item.market), ['nl']);
  assert.deepEqual(beSite[0]?.markets, ['be', 'nl']);

  // Host view: one card per site, the site's own click only.
  for (const market of ['be', 'nl'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(AanbiedingenExperience, {
        showMarketTitles: false,
        sections: crossMarketSections([shared], [market]),
      }),
    );
    assert.equal((html.match(/data-placement="offer"/g) ?? []).length, 1);
    assert.equal(html.includes(`a=${SITE[market]}`), true);
    assert.equal(html.includes(`a=${SITE[market === 'be' ? 'nl' : 'be']}`), false);
  }
  // Combined view (no market host): one shared card with two labelled clickouts.
  const combined = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, { showMarketTitles: true, sections: crossMarketSections([shared], ['nl', 'be']) }),
  );
  assert.equal((combined.match(/data-placement="offer"/g) ?? []).length, 1);
  assert.match(combined, /België en Nederland/);
  assert.match(combined, /data-market="be"/);
  assert.match(combined, /data-market="nl"/);
  assert.equal(combined.includes('/i?'), false);
});

test('10 [CONSTRUCTED] no publishable campaign keeps the existing empty state', () => {
  const generic = banner('be', '9001', { name: 'Banner1', description: null, conditions: null });
  const offers = merge(offersFor(snapshotFor('be', [generic])), offersFor(snapshotFor('nl', [], [])));
  assert.equal(offers.length, 0);
  const sections = crossMarketSections(offers, ['be']);
  assert.equal(sections.reduce((sum, section) => sum + section.offers.length, 0), 0);
  const html = renderToStaticMarkup(React.createElement(AanbiedingenEmptyState));
  assert.match(html, /Momenteel zijn er geen actuele aanbiedingen\./);
});

// ---------------------------------------------------------------------------
// Rule details
// ---------------------------------------------------------------------------

test('[CONSTRUCTED] offers of one market are never merged with each other', () => {
  const be = offersFor(snapshotFor('be', [banner('be', '9001'), banner('be', '9002')]));
  assert.equal(be.length, 2);
  assert.equal(merge(be, []).length, 2);
});

test('[CONSTRUCTED] pairing is one-to-one: two identical BE offers and one NL offer give one BE+NL and one BE', () => {
  const be = offersFor(snapshotFor('be', [banner('be', '9001'), banner('be', '9002')]));
  const nl = offersFor(snapshotFor('nl', [banner('nl', '8001')]));
  const offers = merge(be, nl);
  assert.deepEqual(offers.map((offer) => offer.markets.join('+')).sort(), ['be', 'be+nl']);
});

test('[CONSTRUCTED] a different creative (stored image bytes) stays two offers; an unknown image hash never merges', () => {
  const be = offersFor(snapshotFor('be', [banner('be', '9001')]));
  const nl = offersFor(snapshotFor('nl', [banner('nl', '8001')]));
  const img = '/aanbiedingen/creative-images/be/511873/38103/9001-728x90-0123456789abcdef.png';
  const withImage = (offer: EditorialOffer, hash: string | null): EditorialOffer => ({ ...offer, imageUrl: img, imageContentHash: hash });
  assert.equal(merge([withImage(be[0]!, 'a'.repeat(64))], [withImage(nl[0]!, 'b'.repeat(64))]).length, 2);
  assert.equal(merge([withImage(be[0]!, 'a'.repeat(64))], [withImage(nl[0]!, 'a'.repeat(64))]).length, 1);
  assert.equal(merge([withImage(be[0]!, null)], [withImage(nl[0]!, null)]).length, 2);
  assert.equal(merge([withImage(be[0]!, 'a'.repeat(64))], nl).length, 2);
});

test('[CONSTRUCTED] the provider or campaign name alone never merges; whitespace runs are the only normalisation', () => {
  const be = offersFor(snapshotFor('be', [banner('be', '9001')]));
  const nl = offersFor(snapshotFor('nl', [banner('nl', '8001')]));
  assert.equal(merge([{ ...be[0]!, title: 'tot €300 vroegboekkorting' }], nl).length, 2);
  assert.equal(merge([{ ...be[0]!, title: '  Tot  €300 vroegboekkorting ' }], nl).length, 1);
  assert.equal(merge([{ ...be[0]!, campaignId: null }], nl).length, 2);
  assert.deepEqual([...CROSS_MARKET_COMPARISON_FIELDS], [
    'providerName', 'title', 'benefitLead', 'benefitAmount', 'benefitTail', 'summary', 'conditions', 'discountText', 'validFrom', 'validTo', 'creative',
  ]);
});

test('[CONSTRUCTED] a section only keeps offers of its own market', () => {
  const nl = offersFor(snapshotFor('nl', [banner('nl', '8001')]));
  const offers = dedupeCrossMarketOffers([{ market: 'be', offers: nl }]);
  assert.equal(offers.length, 0);
});

test('[CONSTRUCTED] ingest targets carry no fixed campaign list; accepted campaigns come from getCampaigns per market', () => {
  for (const target of creativeIngestTargets(false)) {
    assert.equal(target.campaignIds, undefined);
  }
  const payload = {
    campaigns: {
      campaign: [
        { ID: 1393, name: 'Sunweb Zon', URL: 'https://www.sunweb.be/nl/vakantie', info: { assignmentStatus: 'accepted' } },
        { ID: 2830, name: 'Sunweb NL', URL: 'https://www.sunweb.nl', info: { assignmentStatus: 'notsignedup' } },
        { ID: 3060, name: 'Cheaptickets.be', URL: 'https://www.cheaptickets.be', info: { assignmentStatus: 'accepted' } },
      ],
    },
  };
  const list = acceptedCampaignsFromPayload(payload, { siteId: '511873', name: 'Vacationweb.nl' });
  assert.deepEqual(list.map((item) => [item.campaignId, item.provider]), [
    ['1393', 'Sunweb'],
    ['3060', 'unknown'],
  ]);
});

test('[CONSTRUCTED] TradeTracker direct-link clickouts are accepted only for their own market site and advertiser host', () => {
  const base = {
    market: 'be' as const,
    campaignId: '1393',
    affiliateSiteId: '511873',
    materialItemId: '2566798',
    campaignUrl: 'https://www.sunweb.be/nl/vakantie',
    trackingClickUrlTemplate: 'https://www.sunweb.be/nl/vakantie/reizen?tt=1393_2566798_511873_&r=',
  };
  assert.equal(promotionClickHref(base), base.trackingClickUrlTemplate);
  assert.equal(promotionClickHref({ ...base, market: 'nl' }), null);
  assert.equal(promotionClickHref({ ...base, affiliateSiteId: '512226' }), null);
  assert.equal(promotionClickHref({ ...base, campaignUrl: 'https://www.sunweb.nl/' }), null);
  assert.equal(promotionClickHref({ ...base, campaignUrl: null }), null);
  assert.equal(promotionClickHref({ ...base, materialItemId: '1' }), null);
  assert.equal(
    promotionClickHref({ ...base, trackingClickUrlTemplate: 'https://www.sunweb.be/nl/vakantie/reizen?tt=1393_2566798_511873_&r=&x=1' }),
    null,
  );
  assert.equal(promotionClickHref({ ...base, trackingClickUrlTemplate: 'https://ti.tradetracker.net/?c=1393&m=2566798&a=511873&r=&t=html' }), null);
  // Corendon.com redirect host follows the campaign URL.
  assert.equal(
    promotionClickHref({
      market: 'nl',
      campaignId: '37514',
      affiliateSiteId: '512226',
      materialItemId: '2299164',
      campaignUrl: 'https://corendon.com',
      trackingClickUrlTemplate: 'https://referral.corendon.com/c?c=37514&m=2299164&a=512226&r=&u=',
    }),
    'https://referral.corendon.com/c?c=37514&m=2299164&a=512226&r=&u=',
  );
  // A redirect host that is neither this market's Corendon host nor the campaign's own referral host fails.
  assert.equal(
    promotionClickHref({
      market: 'nl',
      campaignId: '37514',
      affiliateSiteId: '512226',
      materialItemId: '2299164',
      campaignUrl: 'https://corendon.com',
      trackingClickUrlTemplate: 'https://referral.example.com/c?c=37514&m=2299164&a=512226&r=&u=',
    }),
    null,
  );
  // The other market's Corendon host fails for this market.
  assert.equal(
    promotionClickHref({
      market: 'nl',
      campaignId: '38108',
      affiliateSiteId: '512226',
      materialItemId: '1',
      campaignUrl: 'https://www.corendon.nl/',
      trackingClickUrlTemplate: 'https://referral.corendon.be/c?c=38108&m=1&a=512226&r=&u=',
    }),
    null,
  );
});

// ---------------------------------------------------------------------------
// [REAL] captured TradeTracker data (read-only run, 2026-10-06)
// ---------------------------------------------------------------------------

type RealMarket = {
  market: Market;
  scopedAffiliateSiteId: string;
  ingestedAt: string;
  acceptedCampaigns: TradeTrackerAccessibleCampaign[];
  campaignIds: string[];
  creatives: TradeTrackerBannerCreativeRecord[];
};

const REAL_FIXTURE = path.join(process.cwd(), 'lib/tradetracker/promotions/__fixtures__/sub33c-real-tradetracker-2026-10-06.json.gz');

function realData(): { capturedAt: string; markets: Record<Market, RealMarket> } {
  return JSON.parse(gunzipSync(fs.readFileSync(REAL_FIXTURE)).toString('utf8'));
}

function realSnapshot(data: RealMarket): TradeTrackerCreativeSnapshot {
  return {
    source: TRADETRACKER_SOURCE,
    ingestedAt: data.ingestedAt,
    wsdlUrl: TRADETRACKER_AFFILIATE_WSDL_URL,
    market: data.market,
    scopedAffiliateSiteId: data.scopedAffiliateSiteId,
    credentialScope: data.market,
    imageDelivery: 'metadata-and-embed-code',
    campaignIds: data.campaignIds,
    acceptedCampaigns: data.acceptedCampaigns,
    creatives: data.creatives,
    methodErrors: [],
    counts: { creatives: data.creatives.length, campaignsRequested: data.campaignIds.length, methodErrors: 0, byCampaignId: {} },
  };
}

test('[REAL] BE and NL accepted sets are separate: market-specific campaign IDs, no shared ID', () => {
  const { markets } = realData();
  const be = new Set(markets.be.acceptedCampaigns.map((item) => item.campaignId));
  const nl = new Set(markets.nl.acceptedCampaigns.map((item) => item.campaignId));
  assert.ok(be.size > 0 && nl.size > 0);
  assert.deepEqual([...be].filter((id) => nl.has(id)), []);
  assert.equal(markets.be.scopedAffiliateSiteId, '511873');
  assert.equal(markets.nl.scopedAffiliateSiteId, '512226');
  for (const market of ['be', 'nl'] as const) {
    for (const creative of markets[market].creatives) {
      assert.equal(creative.market, market);
      assert.equal(creative.affiliateSiteId, SITE[market]);
    }
  }
});

test('[REAL] 7: Sunweb and Eliza was here are accepted only on BE and never reach NL', () => {
  const { markets } = realData();
  const providersOn = (market: Market) => new Set(markets[market].acceptedCampaigns.map((item) => item.provider));
  assert.equal(providersOn('be').has('Sunweb'), true);
  assert.equal(providersOn('be').has('Eliza was here'), true);
  assert.equal(providersOn('nl').has('Sunweb'), false);
  assert.equal(providersOn('nl').has('Eliza was here'), false);
  const nl = selectTradeTrackerCreatives(realSnapshot(markets.nl));
  assert.equal(nl.creatives.some((item) => item.provider === 'Sunweb' || item.provider === 'Eliza was here'), false);
  const be = selectTradeTrackerCreatives(realSnapshot(markets.be));
  assert.ok(be.creatives.some((item) => item.provider === 'Sunweb'));
  assert.ok(be.creatives.some((item) => item.provider === 'Eliza was here'));
});

test('[REAL] 8: Corendon.com (37514) and Corendon NL (38108) are accepted only on NL and never reach BE', () => {
  const { markets } = realData();
  const beIds = new Set(markets.be.acceptedCampaigns.map((item) => item.campaignId));
  assert.equal(beIds.has('37514'), false);
  assert.equal(beIds.has('38108'), false);
  const be = selectTradeTrackerCreatives(realSnapshot(markets.be));
  assert.equal(be.creatives.some((item) => item.campaignId === '37514' || item.campaignId === '38108'), false);
  const nl = selectTradeTrackerCreatives(realSnapshot(markets.nl));
  assert.ok(nl.creatives.some((item) => item.campaignId === '37514'));
});

test('[REAL] every selected creative keeps its own market clickout (BE 511873, NL 512226)', () => {
  const { markets } = realData();
  for (const market of ['be', 'nl'] as const) {
    const selected = selectTradeTrackerCreatives(realSnapshot(markets[market]));
    assert.ok(selected.selectedCount > 0);
    for (const creative of selected.creatives) {
      const href = promotionClickHref(creative);
      assert.ok(href, `${market} ${creative.materialItemId}`);
      assert.equal(siteOf(href), SITE[market]);
      assert.equal(href.includes('/i?'), false);
    }
  }
});

test('[REAL] 10: current real data yields no publishable offer, so the empty state stays', () => {
  const { markets } = realData();
  const asOf = Date.parse(markets.be.ingestedAt);
  const be = offersFor(realSnapshot(markets.be), asOf);
  const nl = offersFor(realSnapshot(markets.nl), asOf);
  const offers = merge(be, nl);
  assert.equal(be.length, 0);
  assert.equal(nl.length, 0);
  assert.equal(offers.length, 0);
  for (const market of ['be', 'nl'] as const) {
    assert.equal(crossMarketSections(offers, [market])[0]?.offers.length, 0);
  }
});

// ---------------------------------------------------------------------------
// Image rule (unchanged vs main): only an own stored image is shown; without it the offer is typographic.
// ---------------------------------------------------------------------------

test('[CONSTRUCTED] image rule unchanged: a Sunweb BE direct-link offer without a stored image stays typographic, never a foreign image', () => {
  const clickUrl = 'https://www.sunweb.be/nl/vakantie/reizen?tt=1393_2566798_511873_&r=';
  const tracker = 'https://ti.tradetracker.net/?c=1393&m=2566798&a=511873&r=&t=html';
  const creative = banner('be', '2566798', {
    campaignId: '1393',
    campaignName: 'Sunweb Zon',
    campaignUrl: 'https://www.sunweb.be/nl/vakantie',
    embedCode: `<a href="${clickUrl}" target="_blank" rel="sponsored nofollow"><img src="${tracker}" width="728" height="90" border="0" alt="" /></a>`,
    trackingClickUrlTemplate: clickUrl,
    impressionUrlTemplate: tracker,
  });
  const sunweb: TradeTrackerAccessibleCampaign = {
    campaignId: '1393',
    campaignName: 'Sunweb Zon',
    campaignUrl: 'https://www.sunweb.be/nl/vakantie',
    assignmentStatus: 'accepted',
    provider: 'Sunweb',
  };
  // The TradeTracker tracker pixel is not an `/i` image source: the server image ingest skips it.
  assert.equal(impressionUrlFromEmbed(creative.embedCode), null);
  const offers = offersFor(snapshotFor('be', [creative], [sunweb]));
  assert.equal(offers.length, 1);
  assert.equal(offers[0]?.providerName, 'Sunweb');
  assert.equal(offers[0]?.imageUrl, '');
  assert.equal(offers[0]?.clickUrl, clickUrl);
  const html = renderToStaticMarkup(
    React.createElement(AanbiedingenExperience, { showMarketTitles: false, sections: crossMarketSections(merge(offers, []), ['be']) }),
  );
  assert.match(html, /data-photo="none"/);
  assert.equal(html.includes('<img'), false);
  assert.equal(html.includes('ti.tradetracker'), false);
});

test('[REAL] Sunweb and Eliza BE banners have no /i image source; Corendon banners do', () => {
  const { markets } = realData();
  for (const market of ['be', 'nl'] as const) {
    for (const creative of markets[market].creatives) {
      const impression = impressionUrlFromEmbed(creative.embedCode);
      if (creative.campaignId === '1393' || creative.campaignId === '1327') {
        assert.equal(impression, null, `${market} ${creative.materialItemId}`);
      } else {
        assert.ok(impression, `${market} ${creative.materialItemId}`);
        assert.match(impression, /\/i\?/);
      }
    }
  }
});
