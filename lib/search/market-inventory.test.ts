/**
 * SUB 33D — Results market isolation.
 * [REAL]: real catalog click-outs (fixture from data/offers.json, import 2026-10-01, 8433 offers;
 *         full-catalog matchset tests run only when data/offers.json or VACATIONWEB_OFFERS_FILE exists).
 * [CONSTRUCTED]: synthetic offers for cases the catalog does not contain.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import type { ProviderListing, StoredOffer } from '../feeds/types/stored-offer';
import { normalizeOffer } from '../feeds/canonical/normalize-offer';
import { affiliateHref } from '../offers/offer-detail-view';
import type { SearchParams, TravelOffer } from '../../types/travel';
import {
  clickoutSiteMarket,
  isClickoutAllowedForSiteMarket,
  offerForSiteMarket,
  offerSiteMarkets,
  siteMarketUniverse,
  tradeTrackerAffiliateSiteId,
} from './market-inventory';
import { rankCatalogOffers } from './prepare-results-offers';
import {
  applyResultsLivePriceOverlay,
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from './results-live-price-cache';
import { setLivePriceL2EnabledForTests } from './live-price-l2-store';
import { attachSiteMarket, resolveSiteMarketFromHost } from './site-market';

// Never touch the L2 store (R2) from these tests.
setLivePriceL2EnabledForTests(false);
afterEach(() => clearResultsLivePriceCache());

type FixtureOffer = Pick<
  TravelOffer,
  'provider' | 'deepLink' | 'providerListings' | 'listingHost' | 'feedSourceId' | 'affiliateCampaignId'
> & { externalId: string };

const FIXTURE = path.join(process.cwd(), 'lib/search/__fixtures__/sub33d-real-catalog-markets-2026-10-01.json.gz');
const real: TravelOffer[] = (
  JSON.parse(gunzipSync(fs.readFileSync(FIXTURE)).toString('utf8')) as { offers: FixtureOffer[] }
).offers.map((offer) => ({ ...offer, id: offer.externalId }) as unknown as TravelOffer);

const BE_SITES = new Set(['511873', '511747']);
const NL_SITES = new Set(['512226', '512055']);

/** Test-only classification by TT campaign (listing campaignId, else first part of tt=). */
function campaigns(offer: Pick<TravelOffer, 'providerListings' | 'deepLink'>): string[] {
  if (offer.providerListings?.length) {
    return [...new Set(offer.providerListings.map((listing) => listing.campaignId ?? ''))].sort();
  }
  const tt = new URL(offer.deepLink).searchParams.get('tt') ?? '';
  return [tt.split('_')[0] ?? ''];
}

function sameCampaigns(offer: TravelOffer, expected: string[]): boolean {
  return campaigns(offer).join(',') === expected.join(',');
}

function ids(offers: readonly TravelOffer[]): Set<string> {
  return new Set(offers.map((offer) => offer.id));
}

function assertMarketOnly(offers: readonly TravelOffer[], market: 'be' | 'nl'): void {
  const sites = market === 'be' ? BE_SITES : NL_SITES;
  for (const offer of offers) {
    assert.ok(sites.has(tradeTrackerAffiliateSiteId(offer.deepLink) ?? ''), `${offer.id} deepLink market`);
    for (const listing of offer.providerListings ?? []) {
      assert.ok(sites.has(tradeTrackerAffiliateSiteId(listing.deepLink) ?? ''), `${offer.id} listing market`);
    }
  }
}

const beUniverse = siteMarketUniverse(real, 'be');
const nlUniverse = siteMarketUniverse(real, 'nl');
const beIds = ids(beUniverse);
const nlIds = ids(nlUniverse);

test('[REAL] catalog: every offer has a determinable TT market; universes BE 6349 / NL 2716 of 8433', () => {
  assert.equal(real.length, 8433);
  assert.equal(real.filter((offer) => offerSiteMarkets(offer).length === 0).length, 0);
  assert.equal(beUniverse.length, 6349);
  assert.equal(nlUniverse.length, 2716);
  assert.equal(new Set([...beIds, ...nlIds]).size, 8433, 'no catalog record lost');
  assert.equal(siteMarketUniverse(real, undefined), real, 'no market: full catalog, same array');
});

test('[REAL] 1+5. Sunweb BE 1393 (BE-only) is in BE Results and never in NL Results', () => {
  const sunweb = real.filter((offer) => offer.provider === 'Sunweb');
  assert.equal(sunweb.length, 2935);
  assert.ok(sunweb.every((offer) => sameCampaigns(offer, ['1393'])));
  assert.equal(sunweb.filter((offer) => beIds.has(offer.id)).length, 2935);
  assert.equal(sunweb.filter((offer) => nlIds.has(offer.id)).length, 0);
  for (const offer of sunweb.slice(0, 50)) {
    assert.equal(offerForSiteMarket(offer, 'be'), offer, 'BE: unchanged object');
    assert.equal(offerForSiteMarket(offer, 'nl'), undefined);
  }
});

test('[REAL] 2. Corendon NL 38108-only is in NL Results and never in BE Results', () => {
  const nlOnly = real.filter((offer) => offer.provider === 'Corendon' && sameCampaigns(offer, ['38108']));
  assert.equal(nlOnly.length, 2084);
  assert.equal(nlOnly.filter((offer) => nlIds.has(offer.id)).length, 2084);
  assert.equal(nlOnly.filter((offer) => beIds.has(offer.id)).length, 0);
});

test('[REAL] 3. Corendon (BE and NL inventory) shows each market its own inventory', () => {
  const beCorendon = beUniverse.filter((offer) => offer.provider === 'Corendon');
  const nlCorendon = nlUniverse.filter((offer) => offer.provider === 'Corendon');
  assert.equal(beCorendon.length, 2073 + 632);
  assert.equal(nlCorendon.length, 2084 + 632);
  assert.ok(beCorendon.every((offer) => sameCampaigns(offer, ['38103'])));
  assert.ok(nlCorendon.every((offer) => sameCampaigns(offer, ['38108'])));
  assertMarketOnly(beCorendon, 'be');
  assertMarketOnly(nlCorendon, 'nl');
  const beOnly = real.filter((offer) => offer.provider === 'Corendon' && sameCampaigns(offer, ['38103']));
  assert.equal(beOnly.length, 2073);
  assert.equal(beOnly.filter((offer) => nlIds.has(offer.id)).length, 0, 'Corendon BE 38103-only never on NL');
});

test('[REAL] 4. Corendon dual listings (632): BE listing on .be, NL listing on .nl, per domain', () => {
  const dual = real.filter((offer) => sameCampaigns(offer, ['38103', '38108']));
  assert.equal(dual.length, 632);
  let reboundOnBe = 0;
  let reboundOnNl = 0;
  for (const offer of dual) {
    const be = offerForSiteMarket(offer, resolveSiteMarketFromHost('www.vacationweb.be'));
    const nl = offerForSiteMarket(offer, resolveSiteMarketFromHost('vacationweb.nl'));
    assert.ok(be && nl);
    assert.equal(be.id, offer.id);
    assert.equal(nl.id, offer.id);
    assert.ok(be.providerListings!.every((listing) => listing.campaignId === '38103'));
    assert.ok(nl.providerListings!.every((listing) => listing.campaignId === '38108'));
    assert.equal(clickoutSiteMarket(be.deepLink), 'be');
    assert.equal(clickoutSiteMarket(nl.deepLink), 'nl');
    assert.equal(be.affiliateCampaignId, '38103');
    assert.equal(nl.affiliateCampaignId, '38108');
    assert.ok(be.listingHost?.endsWith('corendon.be'));
    assert.equal(nl.listingHost, 'www.corendon.nl');
    if (be.deepLink !== offer.deepLink) reboundOnBe += 1;
    if (nl.deepLink !== offer.deepLink) reboundOnNl += 1;
  }
  assert.equal(reboundOnBe, 3, 'catalog bound the NL listing on 3 dual offers');
  assert.equal(reboundOnNl, 629, 'catalog bound the BE listing on 629 dual offers');
  // The catalog record itself is not modified.
  assert.ok(dual.every((offer) => offer.providerListings!.length >= 2));
});

test('[REAL] 6. Eliza BE 1327 (deepLink only, no listings) is BE-only', () => {
  const eliza = real.filter((offer) => offer.provider === 'Eliza was here');
  assert.equal(eliza.length, 709);
  assert.ok(eliza.every((offer) => !offer.providerListings?.length && sameCampaigns(offer, ['1327'])));
  assert.equal(eliza.filter((offer) => beIds.has(offer.id)).length, 709);
  assert.equal(eliza.filter((offer) => nlIds.has(offer.id)).length, 0);
});

test('[REAL]+[CONSTRUCTED] 7. De Jong Intra 439 is not in the catalog; an NL-only offer like it never reaches BE', () => {
  assert.equal(real.filter((offer) => /jong/i.test(offer.provider)).length, 0);
  assert.equal(real.filter((offer) => campaigns(offer).includes('439')).length, 0);
  const djiLike = {
    id: 'constructed-439',
    provider: 'De Jong Intra',
    deepLink: 'https://www.dejongintra.nl/reis?tt=439_12_512226_&r=',
  } as TravelOffer;
  assert.equal(offerForSiteMarket(djiLike, 'nl'), djiLike);
  assert.equal(offerForSiteMarket(djiLike, 'be'), undefined);
});

test('[REAL] 8. a market mismatch is never part of that market universe', () => {
  for (const offer of beUniverse) assert.ok(offerSiteMarkets(offer).includes('be'));
  for (const offer of nlUniverse) assert.ok(offerSiteMarkets(offer).includes('nl'));
  assertMarketOnly(beUniverse, 'be');
  assertMarketOnly(nlUniverse, 'nl');
  const both = [...beIds].filter((id) => nlIds.has(id));
  assert.equal(both.length, 632, 'only dual-listing offers exist in both universes');
});

test('[CONSTRUCTED] 8b. fail-closed: no TT click-out or an unknown site is not eligible on a market host', () => {
  const unknownSite = { id: 'x1', provider: 'Future', deepLink: 'https://future.example/?tt=1_2_999999_' } as TravelOffer;
  const noTt = { id: 'x2', provider: 'Future', deepLink: 'https://future.example/trip' } as TravelOffer;
  for (const offer of [unknownSite, noTt]) {
    assert.equal(offerForSiteMarket(offer, 'be'), undefined);
    assert.equal(offerForSiteMarket(offer, 'nl'), undefined);
    assert.equal(offerForSiteMarket(offer, undefined), offer);
  }
  // Future provider on a known BE site: eligible automatically, no provider rule.
  const future = { id: 'x3', provider: 'Future', deepLink: 'https://future.be/p?tt=40001_7_511873_x&r=' } as TravelOffer;
  assert.equal(offerForSiteMarket(future, 'be'), future);
  assert.equal(offerForSiteMarket(future, 'nl'), undefined);
  // Redirect format c/m/a.
  assert.equal(tradeTrackerAffiliateSiteId('https://tc.tradetracker.net/?c=1&m=2&a=512055&r=&u='), '512055');
  assert.equal(clickoutSiteMarket('https://tc.tradetracker.net/?c=1&m=2&a=512055&r=&u='), 'nl');
});

test('[CONSTRUCTED] domain: www/apex .be and .nl pick the market; localhost/preview keep the full catalog', () => {
  const offers = real.slice(0, 20);
  assert.equal(attachSiteMarket({}, 'www.vacationweb.be').siteMarket, 'be');
  assert.equal(attachSiteMarket({}, 'vacationweb.be').siteMarket, 'be');
  assert.equal(attachSiteMarket({}, 'www.vacationweb.nl').siteMarket, 'nl');
  assert.equal(attachSiteMarket({}, 'vacationweb.nl:443').siteMarket, 'nl');
  assert.equal(attachSiteMarket({}, 'localhost:3000').siteMarket, undefined);
  assert.equal(attachSiteMarket({}, 'vacation-web-delta.vercel.app').siteMarket, undefined);
  assert.equal(siteMarketUniverse(offers, attachSiteMarket({}, 'localhost:3000').siteMarket), offers);
  // Memoized per catalog array: stable universe and stable dual-offer copies.
  assert.equal(siteMarketUniverse(real, 'nl'), nlUniverse);
});

test('[REAL] 9. click-outs: .be uses the BE TT site, .nl the NL TT site', () => {
  const dual = real.find((offer) => sameCampaigns(offer, ['38103', '38108']))!;
  const be = offerForSiteMarket(dual, 'be')!;
  const nl = offerForSiteMarket(dual, 'nl')!;
  assert.equal(tradeTrackerAffiliateSiteId(affiliateHref(be, { siteMarket: 'be' })), '511747');
  assert.equal(tradeTrackerAffiliateSiteId(affiliateHref(nl, { siteMarket: 'nl' })), '512226');
  const sunweb = real.find((offer) => offer.provider === 'Sunweb')!;
  assert.equal(clickoutSiteMarket(affiliateHref(sunweb, { siteMarket: 'be' })), 'be');
  const eliza = real.find((offer) => offer.provider === 'Eliza was here')!;
  assert.equal(clickoutSiteMarket(affiliateHref(eliza, { siteMarket: 'be' })), 'be');

  // A stale foreign binding (e.g. an overlay from the other market) never leaves via the wrong site.
  const nlListing = nl.providerListings![0] as ProviderListing;
  const stale = { ...be, deepLink: nlListing.deepLink, listingHost: 'unknown.example' };
  assert.equal(clickoutSiteMarket(affiliateHref(stale, { siteMarket: 'be' })), 'be');
  assert.equal(isClickoutAllowedForSiteMarket(nlListing.deepLink, 'be'), false);
  assert.equal(isClickoutAllowedForSiteMarket(nlListing.deepLink, undefined), true);
});

test('[REAL] 9b. live-price overlay from the other market cannot rebind the click-out', () => {
  const dual = real.find((offer) => sameCampaigns(offer, ['38103', '38108']))!;
  const be = offerForSiteMarket(dual, 'be')!;
  const nl = offerForSiteMarket(dual, 'nl')!;
  const params: SearchParams = { adults: 2, siteMarket: 'be' };
  // Bare (not listing-scoped) unpriced record written by an NL request.
  setResultsLivePriceOverlay(dual.id, { adults: 2, siteMarket: 'nl' }, {
    price: 0,
    pricePerDay: 0,
    livePriceStatus: 'unpriced',
    livePriceSource: undefined,
    deepLink: nl.deepLink,
    listingHost: nl.listingHost,
    feedSourceId: nl.feedSourceId,
    affiliateCampaignId: nl.affiliateCampaignId,
  } as never);
  const appliedBe = applyResultsLivePriceOverlay(be, params);
  assert.equal(appliedBe.livePriceStatus, 'unpriced');
  assert.equal(appliedBe.deepLink, be.deepLink);
  assert.equal(appliedBe.affiliateCampaignId, '38103');
  const appliedNl = applyResultsLivePriceOverlay(nl, { adults: 2, siteMarket: 'nl' });
  assert.equal(appliedNl.deepLink, nl.deepLink);
  // Foreign proven price on a bare key is ignored entirely.
  const sunweb = real.find((offer) => offer.provider === 'Sunweb')!;
  setResultsLivePriceOverlay(sunweb.id, { adults: 2 }, {
    price: 999,
    pricePerDay: 99,
    livePriceStatus: 'proven',
    livePriceSource: 'promoted-price',
    deepLink: nl.deepLink,
  } as never);
  assert.equal(applyResultsLivePriceOverlay(sunweb, { adults: 2, siteMarket: 'be' }).price, sunweb.price);
  assert.equal(applyResultsLivePriceOverlay(sunweb, { adults: 2 }).price, 999, 'no market: unchanged behavior');
});

test('[REAL] detail: a .nl request for a BE-only offer is not eligible (page calls notFound)', () => {
  const sunweb = real.find((offer) => offer.provider === 'Sunweb')!;
  const nlOnly = real.find((offer) => offer.provider === 'Corendon' && sameCampaigns(offer, ['38108']))!;
  assert.equal(offerForSiteMarket(sunweb, attachSiteMarket({}, 'www.vacationweb.nl').siteMarket), undefined);
  assert.equal(offerForSiteMarket(nlOnly, attachSiteMarket({}, 'www.vacationweb.be').siteMarket), undefined);
  const page = fs.readFileSync(path.join(process.cwd(), 'app', 'offers', '[id]', 'page.tsx'), 'utf8');
  assert.match(page, /const marketOffer = offerForSiteMarket\(catalogOffer, resultsParams\.siteMarket\);\s*if \(!marketOffer\) \{\s*notFound\(\);/);
  assert.match(page, /priceOfferForDetail\(marketOffer, resultsParams\)/);
});

test('[CONSTRUCTED] 10. wiring: universe is cut before prepare/matchset, prefetch and filter options', () => {
  const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
  assert.match(
    read('lib/search/prepared-results-request.ts'),
    /excludeParkedResultsProviders\(\s*siteMarketUniverse\(await loadOffers\(\), params\.siteMarket\),\s*\);[\s\S]*prepareResultsOffers\(offers, params\)/,
  );
  assert.match(read('lib/search/home-live-price-prefetch.ts'), /siteMarketUniverse\(await loadOffers\(\), params\.siteMarket\)/);
  assert.match(read('app/results/page.tsx'), /loadPresentedFilterOptions\(params\.siteMarket\)/);
});

test('[REAL] 10. unified matchset of one market request never mixes BE and NL (fixture universe)', () => {
  for (const market of ['be', 'nl'] as const) {
    const universe = siteMarketUniverse(real, market);
    const markets = new Set(universe.flatMap((offer) => offerSiteMarkets(offer)));
    assert.deepEqual([...markets], [market]);
  }
});

const OFFERS_FILE = process.env.VACATIONWEB_OFFERS_FILE?.trim() || path.join(process.cwd(), 'data', 'offers.json');
const catalogTest = fs.existsSync(OFFERS_FILE) ? test : test.skip;

catalogTest('[REAL] 10b. full catalog: catalog-ranked matchset per market stays in its market', () => {
  const stored = JSON.parse(fs.readFileSync(OFFERS_FILE, 'utf8')) as StoredOffer[];
  const catalog = stored.map(normalizeOffer);
  for (const market of ['be', 'nl'] as const) {
    for (const params of [{}, { departureAirport: 'AMS' }, { departureAirport: 'BRU' }] as SearchParams[]) {
      const matchset = rankCatalogOffers(siteMarketUniverse(catalog, market), { ...params, siteMarket: market });
      // Real: NL has no BRU departures after isolation (0); the default request is never empty.
      if (!params.departureAirport) assert.ok(matchset.length > 0, `${market} default not empty`);
      assertMarketOnly(matchset, market);
      if (market === 'nl') {
        assert.equal(matchset.filter((offer) => offer.provider !== 'Corendon').length, 0);
      }
    }
  }
});
