import assert from 'node:assert/strict';
import test from 'node:test';
import { clearFeedRegistryCache } from '../../feeds/feed-registry';
import {
  activeAt,
  compareForDisplay,
  formatCalendarDateNl,
  joinProviderNames,
  providerFilterOptions,
  toPromotionCards,
} from './present-promotions';
import {
  dedupeDisplayablePromotions,
  selectDisplayablePromotions,
  type DisplayablePromotion,
} from './select-displayable';
import type {
  TradeTrackerCampaignNewsRecord,
  TradeTrackerIncentiveRecord,
  TradeTrackerPromotionSnapshot,
} from './types';

// All data in this file is TESTFIXTURE data. It never ships in the UI or in production code.
const AS_OF_MS = Date.parse('2026-10-04T12:00:00.000Z');
const BE = '512055';
const NL = '512226';

function snapshot(
  scopedAffiliateSiteId: string,
  overrides: Partial<TradeTrackerPromotionSnapshot> = {},
): TradeTrackerPromotionSnapshot {
  return {
    source: 'tradetracker-affiliate-webservice',
    ingestedAt: '2026-10-04T12:00:00.000Z',
    wsdlUrl: 'https://ws.tradetracker.com/soap-literal-wsi/affiliate?wsdl',
    scopedAffiliateSiteId,
    affiliateSites: [],
    campaigns: [],
    newsItems: [],
    incentiveOffers: [],
    vouchers: [],
    methodErrors: [],
    ...overrides,
  };
}

function validity(start: string | null, end: string | null) {
  const status = start ? ('active' as const) : ('undated' as const);
  return {
    status,
    isActive: status === 'active',
    asOfUtcDate: '2026-10-04',
    startDate: start,
    endDate: end,
    timezoneAssumption: 'utc-calendar-date' as const,
  };
}

function news(args: {
  id: string;
  title: string;
  content: string;
  publishDate?: string | null;
  expirationDate?: string | null;
  campaignId?: string;
  campaignName?: string;
  campaignUrl?: string | null;
}): TradeTrackerCampaignNewsRecord {
  const publishDate = args.publishDate === undefined ? '2026-09-15' : args.publishDate;
  const expirationDate = args.expirationDate === undefined ? '2026-11-02' : args.expirationDate;
  return {
    source: 'tradetracker-affiliate-webservice',
    kind: 'consumer_promotion',
    newsItemId: args.id,
    newsType: 'campaign_update_consumer',
    title: args.title,
    content: args.content,
    publishDate,
    expirationDate,
    campaignId: args.campaignId ?? '38108',
    campaignName: args.campaignName ?? 'Corendon NL',
    campaignUrl: args.campaignUrl === undefined ? 'https://www.corendon.nl/' : args.campaignUrl,
    validity: validity(publishDate, expirationDate),
    sourceMetadata: {},
  };
}

const KACHING = news({
  id: '322951',
  title: 'Corendon NL - Kaching: extra voordelige vakantiedeals',
  content:
    'Corendon NL heeft een nieuwe actie: <b>Kaching: extra voordelige vakantiedeals</b>.\n\nActie: <b>tot wel € 200,- extra korting</b>\nPeriode: september en oktober\nLandingspagina: <a href="https://www.corendon.nl/kaching">x</a>',
});
const CRUISE = news({
  id: '322932',
  title: 'Corendon NL - Kaching: extra voordelige cruisedeals',
  content:
    'Corendon NL heeft een nieuwe actie: <b>Kaching: extra voordelige cruisedeals</b>.\n\nActie: <b>tot wel € 200,- extra korting, ook tijdens de herfstvakantie</b>\nPeriode: september en oktober\nLandingspagina: <a href="https://www.corendon.nl/cruise-kaching-actie">x</a>',
  publishDate: '2026-09-14',
});

function pipeline(...perSite: [string, TradeTrackerPromotionSnapshot][]): DisplayablePromotion[] {
  clearFeedRegistryCache();
  return dedupeDisplayablePromotions(
    perSite.flatMap(([siteId, snap]) => selectDisplayablePromotions(snap, siteId)),
  );
}

const bothSites = () =>
  pipeline(
    [BE, snapshot(BE, { newsItems: [KACHING, CRUISE] })],
    [NL, snapshot(NL, { newsItems: [KACHING, CRUISE] })],
  );

// ---- A/E: filtering + dedupe on the real-shaped data -------------------------------------

test('E: the same Corendon actions on the BE and NL site collapse to two distinct cards', () => {
  const cards = toPromotionCards(bothSites(), AS_OF_MS);
  assert.equal(cards.length, 2);
  assert.deepEqual(
    cards.map((card) => card.title),
    ['Kaching: extra voordelige vakantiedeals', 'Kaching: extra voordelige cruisedeals'],
  );
  assert.equal(new Set(cards.map((card) => card.id)).size, 2);
});

test('E: two different actions of one provider stay side by side (no max-1-per-provider)', () => {
  const cards = toPromotionCards(bothSites(), AS_OF_MS);
  assert.equal(cards.filter((card) => card.providerName === 'Corendon').length, 2);
});

test('E: the same newsItemId from both sites merges even when one copy lacks a landing URL', () => {
  const noUrl = news({ ...{ id: '322951', title: KACHING.title, content: KACHING.content }, campaignUrl: null });
  const promotions = pipeline(
    [BE, snapshot(BE, { newsItems: [KACHING] })],
    [NL, snapshot(NL, { newsItems: [noUrl] })],
  );
  assert.equal(promotions.length, 1);
  assert.equal(promotions[0]!.affiliateContexts.length, 2);
});

test('E: distinct news IDs merge only when the complete content is identical', () => {
  const copy = news({ id: '999', title: KACHING.title, content: KACHING.content });
  assert.equal(
    pipeline([NL, snapshot(NL, { newsItems: [KACHING, copy] })]).length,
    1,
    'identical complete content + dates + landing path is the existing proven-duplicate rule',
  );
  const other = news({ id: '1000', title: KACHING.title, content: `${KACHING.content}\nVoorwaarden: x` });
  assert.equal(pipeline([NL, snapshot(NL, { newsItems: [KACHING, other] })]).length, 2);
});

// ---- A: semantics ------------------------------------------------------------------------

test('A: ops/marketing news and unconnected advertisers never become cards', () => {
  const general: TradeTrackerCampaignNewsRecord = {
    ...news({ id: '322954', title: 'Corendon NL - Ontdek Barut hotels', content: 'Over Barut.' }),
    newsType: 'campaign_update_general',
    kind: 'campaign_update',
  };
  const other = news({
    id: '1',
    title: 'Dormio.nl - Herfstvakantie deals',
    content: 'Actie: 10% korting',
    campaignId: '37140',
    campaignName: 'Dormio.nl',
  });
  assert.equal(pipeline([NL, snapshot(NL, { newsItems: [general, other] })]).length, 0);
});

// ---- B: dates ----------------------------------------------------------------------------

test('B: promotions that ended or have not started are not shown at render time', () => {
  const promotions = pipeline([NL, snapshot(NL, { newsItems: [KACHING] })]);
  assert.equal(toPromotionCards(promotions, Date.parse('2026-11-02T10:00:00Z')).length, 1, 'end date is inclusive');
  assert.equal(toPromotionCards(promotions, Date.parse('2026-11-03T00:00:00Z')).length, 0, 'expired');
  assert.equal(toPromotionCards(promotions, Date.parse('2026-09-14T23:00:00Z')).length, 0, 'not started');
  assert.equal(activeAt(promotions, AS_OF_MS).length, 1);
});

test('B: a card never states an end date for campaign news', () => {
  const card = toPromotionCards(bothSites(), AS_OF_MS)[0]!;
  assert.equal(card.validToLabel, null);
  assert.equal(card.publishedLabel, '15 september 2026');
  assert.equal(card.period, 'september en oktober');
});

test('B: incentive/voucher validity windows are the offer terms and are shown', () => {
  clearFeedRegistryCache();
  const voucher: TradeTrackerIncentiveRecord = {
    source: 'tradetracker-affiliate-webservice',
    kind: 'voucher',
    materialItemId: 'v1',
    name: 'Corendon - Zomerkorting',
    description: 'Voor alle zonvakanties.',
    conditions: 'Minimaal 7 nachten.',
    validFromDate: '2026-09-01',
    validToDate: '2026-10-31',
    discountFixed: null,
    discountVariable: null,
    voucherCode: 'ZOMER',
    campaignId: '38108',
    campaignName: 'Corendon NL',
    campaignUrl: 'https://www.corendon.nl/zomer',
    affiliateSiteId: NL,
    affiliateSiteName: null,
    validity: validity('2026-09-01', '2026-10-31'),
    sourceMetadata: {},
  };
  const cards = toPromotionCards(
    dedupeDisplayablePromotions(selectDisplayablePromotions(snapshot(NL, { vouchers: [voucher] }), NL)),
    AS_OF_MS,
  );
  assert.equal(cards.length, 1);
  assert.equal(cards[0]!.kindLabel, 'Kortingscode');
  assert.equal(cards[0]!.validToLabel, '31 oktober 2026');
  assert.equal(cards[0]!.voucherCode, 'ZOMER');
  assert.equal(cards[0]!.conditions, 'Minimaal 7 nachten.');
  assert.equal(cards[0]!.ctaLabel, 'Bekijk aanbieding');
});

// ---- C/K: provider mapping + TUI ---------------------------------------------------------

test('K: TUI.nl (campaign 433, not a connected Results provider) is excluded by the canonical gate', () => {
  const tui = news({
    id: '323400',
    title: 'TUI.nl - Winterzon campagne + TUIfly update',
    content: 'Actie: tot €400 korting per persoon op vakanties met vertrek in de winterperiode.',
    campaignId: '433',
    campaignName: 'TUI.nl',
    campaignUrl: 'https://www.tui.nl/',
    publishDate: '2026-10-01',
    expirationDate: '2026-11-01',
  });
  assert.equal(pipeline([NL, snapshot(NL, { newsItems: [tui, KACHING] })]).length, 1);
});

test('K: the presentation layer is provider-agnostic (a future provider needs no UI change)', () => {
  const base = bothSites()[0]!;
  const future: DisplayablePromotion = {
    ...base,
    id: 'x:news:7',
    providerName: 'TUI',
    sourceKey: 'news|7',
    nativeKey: 'x|news|7',
    contentKey: null,
    title: 'Winterzon',
    publishDate: '2026-10-03',
  };
  const cards = toPromotionCards([...bothSites(), future], AS_OF_MS);
  assert.deepEqual(
    providerFilterOptions(cards),
    [
      { name: 'Corendon', count: 2 },
      { name: 'TUI', count: 1 },
    ],
  );
});

test('C: filter options only list providers that have promotions', () => {
  assert.deepEqual(providerFilterOptions([]), []);
  assert.deepEqual(providerFilterOptions(toPromotionCards(bothSites(), AS_OF_MS)), [
    { name: 'Corendon', count: 2 },
  ]);
});

// ---- D: BE/NL ----------------------------------------------------------------------------

test('D: no affiliate site ID or internal key leaves the presentation layer', () => {
  const json = JSON.stringify(toPromotionCards(bothSites(), AS_OF_MS));
  assert.doesNotMatch(json, /512055|512226|511747/);
  assert.doesNotMatch(json, /nativeKey|contentKey|affiliateSiteId/);
});

test('D: identical click-out URLs of both contexts give one CTA; different domains give one per domain', () => {
  const same = toPromotionCards(bothSites(), AS_OF_MS)[0]!;
  assert.equal(same.links.length, 1);

  const be = news({ ...{ id: 'be-1', title: KACHING.title, content: KACHING.content }, campaignUrl: 'https://www.corendon.be/' });
  const nl = news({ ...{ id: 'nl-1', title: KACHING.title, content: KACHING.content }, campaignUrl: 'https://www.corendon.nl/' });
  const merged = pipeline([BE, snapshot(BE, { newsItems: [be] })], [NL, snapshot(NL, { newsItems: [nl] })]);
  const cards = toPromotionCards(merged, AS_OF_MS);
  assert.equal(cards.length, 1, 'identical complete content, dates and landing path: proven duplicate');
  assert.deepEqual(
    cards[0]!.links.map((link) => link.domain),
    ['corendon.be', 'corendon.nl'],
  );
});

// ---- J: deeplinks ------------------------------------------------------------------------

test('J: click-out URLs are passed through byte-for-byte', () => {
  const tracked =
    'https://referral.corendon.nl/c?c=38108&m=0&a=512226&r=&u=https%3A%2F%2Fwww.corendon.nl%2Fkaching%3Futm_x%3D1%26b%3D%C3%A9';
  const item = news({ id: '5', title: KACHING.title, content: KACHING.content, campaignUrl: tracked });
  const cards = toPromotionCards(pipeline([NL, snapshot(NL, { newsItems: [item] })]), AS_OF_MS);
  assert.equal(cards[0]!.links[0]!.href, tracked);
});

test('J: non-http(s) URLs are never rendered as click-outs', () => {
  const bad = news({ id: '6', title: KACHING.title, content: KACHING.content, campaignUrl: 'javascript:alert(1)' });
  const cards = toPromotionCards(pipeline([NL, snapshot(NL, { newsItems: [bad] })]), AS_OF_MS);
  assert.equal(cards.length, 1);
  assert.deepEqual(cards[0]!.links, []);
});

// ---- H/I: missing image + missing discount ----------------------------------------------

test('H: the card model carries no image field (TradeTracker supplies none) and nothing breaks', () => {
  const card = toPromotionCards(bothSites(), AS_OF_MS)[0]!;
  assert.equal('image' in card, false);
  assert.equal('imageUrl' in card, false);
});

test('I: a promotion without an explicit discount text gets none invented', () => {
  const plain = news({
    id: '8',
    title: 'Corendon NL - Nieuwe hotels',
    content: 'Corendon NL heeft een nieuwe update over de hotels in Turkije.',
  });
  const card = toPromotionCards(pipeline([NL, snapshot(NL, { newsItems: [plain] })]), AS_OF_MS)[0]!;
  assert.equal(card.highlight, null);
  assert.equal(card.period, null);
  assert.doesNotMatch(JSON.stringify(card), /korting|€|%/i);
});

test('I: description that only restates the title is dropped; real description is kept', () => {
  const restating = toPromotionCards(
    pipeline([NL, snapshot(NL, { newsItems: [news({ id: '9', title: 'Corendon NL - Nazomer Deals', content: 'Corendon NL heeft een nieuwe actie: Nazomer Deals .' })] })]),
    AS_OF_MS,
  )[0]!;
  assert.equal(restating.description, null);
  const real = toPromotionCards(
    pipeline([NL, snapshot(NL, { newsItems: [news({ id: '10', title: 'Corendon NL - Nazomer Deals', content: 'Boek nu je nazomervakantie naar Turkije met extra bagage.' })] })]),
    AS_OF_MS,
  )[0]!;
  assert.equal(real.description, 'Boek nu je nazomervakantie naar Turkije met extra bagage.');
});

// ---- F: sorting --------------------------------------------------------------------------

function stub(overrides: Partial<DisplayablePromotion>): DisplayablePromotion {
  const base = bothSites()[0]!;
  return { ...base, ...overrides };
}

test('F: explicit validity first, then newest start, then earlier end, then provider/title/id', () => {
  const noPeriod = { highlight: null, periodLabel: null, period: null, conditions: null };
  const period = { highlight: null, periodLabel: 'Periode', period: 'oktober', conditions: null };
  const a = stub({ id: 'a', title: 'A', publishDate: '2026-09-01', expirationDate: '2026-12-01', facts: noPeriod });
  const b = stub({ id: 'b', title: 'B', publishDate: '2026-09-20', expirationDate: '2026-12-01', facts: noPeriod });
  const c = stub({ id: 'c', title: 'C', publishDate: '2026-08-01', expirationDate: '2026-12-01', facts: period });
  const d = stub({ id: 'd', title: 'D', publishDate: '2026-09-20', expirationDate: '2026-11-01', facts: noPeriod });
  const e = stub({ id: 'e', title: 'E', providerName: 'Aaa', publishDate: '2026-09-20', expirationDate: '2026-11-01', facts: noPeriod });
  const sorted = [a, b, c, d, e].sort(compareForDisplay).map((p) => p.id);
  assert.deepEqual(sorted, ['c', 'e', 'd', 'b', 'a']);
});

test('F: ordering is deterministic regardless of input order', () => {
  const list = bothSites();
  const forward = toPromotionCards(list, AS_OF_MS).map((card) => card.title);
  const backward = toPromotionCards([...list].reverse(), AS_OF_MS).map((card) => card.title);
  assert.deepEqual(forward, backward);
});

// ---- G: empty ----------------------------------------------------------------------------

test('G: no promotions yields an empty card list and no provider options', () => {
  const cards = toPromotionCards([], AS_OF_MS);
  assert.deepEqual(cards, []);
  assert.deepEqual(providerFilterOptions(cards), []);
});

// ---- helpers -----------------------------------------------------------------------------

test('formatCalendarDateNl / joinProviderNames', () => {
  assert.equal(formatCalendarDateNl('2026-03-01'), '1 maart 2026');
  assert.equal(formatCalendarDateNl('2026-12-31T00:00:00Z'), '31 december 2026');
  assert.equal(formatCalendarDateNl(null), null);
  assert.equal(formatCalendarDateNl('niet een datum'), null);
  assert.equal(joinProviderNames([]), '');
  assert.equal(joinProviderNames(['A']), 'A');
  assert.equal(joinProviderNames(['A', 'B']), 'A en B');
  assert.equal(joinProviderNames(['A', 'B', 'C']), 'A, B en C');
});
