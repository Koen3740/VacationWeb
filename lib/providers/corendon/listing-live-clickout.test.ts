import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { ProviderListing } from '../../feeds/types/stored-offer';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import { affiliateHref } from '../../offers/offer-detail-view';
import { buildOfferDetailHref } from '../../search/pagination';
import { parseSearchParams } from '../../search/parse-search-params';
import { hasValidPresentablePrice } from '../../search/presentable-price';
import { priceOfferForDetail } from '../../search/price-offer-for-detail';
import {
  clearResultsLivePriceCache,
  livePriceCacheKey,
} from '../../search/results-live-price-cache';
import { resolveSiteMarketFromHost } from '../../search/site-market';
import {
  CORENDON_DEFAULT_2A_PARTY,
  CORENDON_FE_HOST,
  CORENDON_FE_HOST_BE_FR,
  CORENDON_FE_HOST_NL,
  CORENDON_TWO_ROOM_2A_PARTY,
} from './constants';
import {
  buildCorendonLowestpricesaccoUrl,
  fetchCorendonLowestpricesaccoPrice,
} from './lowestpricesacco-client';
import {
  CORENDON_FEED_BEFR,
  CORENDON_FEED_BENL,
  CORENDON_FEED_NL,
  rankCorendonListings,
  selectCorendonListing,
} from './listing-selection';
import { buildCorendonLiveContext } from './offer-context';
import { clearLivePriceInflightForTests } from '../prijsvrij/page1-receipt-pricing';

afterEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
});

const FRAGMENT_BRU = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
const FRAGMENT_AMS = '9514.COSPY.AMSCFU.270826.3-4-3.SZ-U';

function listing(options: {
  feedId: string;
  host: string;
  fragment: string;
  campaignId?: string;
}): ProviderListing {
  const path = options.host.includes('.nl') ? 'vakantie' : 'vakantie';
  return {
    provider: 'Corendon',
    feedId: options.feedId,
    campaignId: options.campaignId,
    host: options.host,
    deepLink: `https://${options.host}/${path}#${options.fragment}`,
    locale:
      options.feedId === CORENDON_FEED_BEFR
        ? 'fr-BE'
        : options.feedId === CORENDON_FEED_NL
          ? 'nl-NL'
          : 'nl-BE',
  };
}

const BE_NL = listing({
  feedId: CORENDON_FEED_BENL,
  host: CORENDON_FE_HOST,
  fragment: FRAGMENT_BRU,
  campaignId: '38103',
});
const BE_FR = listing({
  feedId: CORENDON_FEED_BEFR,
  host: CORENDON_FE_HOST_BE_FR,
  fragment: FRAGMENT_BRU,
  campaignId: '38103',
});
const NL = listing({
  feedId: CORENDON_FEED_NL,
  host: CORENDON_FE_HOST_NL,
  fragment: FRAGMENT_BRU,
  campaignId: '38108',
});
const NL_AMS = listing({
  feedId: CORENDON_FEED_NL,
  host: CORENDON_FE_HOST_NL,
  fragment: FRAGMENT_AMS,
  campaignId: '38108',
});
const BE_AMS = listing({
  feedId: CORENDON_FEED_BENL,
  host: CORENDON_FE_HOST,
  fragment: FRAGMENT_AMS,
  campaignId: '38103',
});

function makeOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'corendon-9514',
    provider: 'Corendon',
    hotelName: 'Spyridoula Apartments',
    destinationCountry: 'Griekenland',
    departureDate: '2026-08-27',
    nights: 4,
    price: 458,
    pricePerDay: 115,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: BE_NL.deepLink,
    listingHost: BE_NL.host,
    feedSourceId: BE_NL.feedId,
    affiliateCampaignId: '38103',
    providerListings: [BE_NL, BE_FR, NL],
    ...overrides,
  };
}

function okBody(price = 876, tripCode = `${FRAGMENT_BRU}.BRUCFU4C.CFU`) {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: '2026-08-27T00:00:00',
        trip: {
          price,
          tripCode,
          tripUrlHash: `[filters]BEL/BRU.*.*.*.0|||${tripCode}|||true`,
          priceTableDate: '20260827',
          durationInDays: 5,
        },
      },
    },
  });
}

function okUpsalesBody(pricePerPerson = 876, totalPrice = 1752, tripCode = `${FRAGMENT_BRU}.BRUCFU4C.CFU`) {
  return JSON.stringify({
    result: {
      extendedTripCode: tripCode,
      prices: {
        totalPrice,
        priceTableCalculatedPricePerPerson: pricePerPerson,
      },
      selectedTripCudl: {
        selectedTrip: {
          system: { request: { departureDate: '2026-08-27' } },
        },
      },
    },
  });
}

function listingBoundFetch(onLowestHost?: (host: string) => Response | void): typeof fetch {
  return async (input) => {
    const url = new URL(String(input));
    const host = url.searchParams.get('originalHost') ?? '';
    if (String(input).includes('lowestpricesacco')) {
      const override = onLowestHost?.(host);
      if (override) {
        return override;
      }
      return new Response(okBody(), { status: 200 });
    }
    if (String(input).includes('/upsales')) {
      return new Response(okUpsalesBody(), { status: 200 });
    }
    throw new Error(`unexpected fetch ${String(input)}`);
  };
}

test('BE-NL listing builds www.corendon.be live context', () => {
  const ctx = buildCorendonLiveContext(makeOffer(), { adults: 2 }, BE_NL);
  assert.ok(ctx);
  assert.equal(ctx.feHost, CORENDON_FE_HOST);
  assert.equal(ctx.listing?.feedId, CORENDON_FEED_BENL);
  const url = new URL(buildCorendonLowestpricesaccoUrl(ctx));
  assert.equal(url.searchParams.get('originalHost'), CORENDON_FE_HOST);
  assert.equal(url.searchParams.get('browserHost'), CORENDON_FE_HOST);
});

test('BE-FR listing builds fr.corendon.be live context', () => {
  const ctx = buildCorendonLiveContext(makeOffer({ deepLink: BE_FR.deepLink }), { adults: 2 }, BE_FR);
  assert.ok(ctx);
  assert.equal(ctx.feHost, CORENDON_FE_HOST_BE_FR);
  const url = new URL(buildCorendonLowestpricesaccoUrl(ctx));
  assert.equal(url.searchParams.get('originalHost'), CORENDON_FE_HOST_BE_FR);
});

test('NL listing builds www.corendon.nl live context', () => {
  const ctx = buildCorendonLiveContext(makeOffer({ deepLink: NL.deepLink }), { adults: 2 }, NL);
  assert.ok(ctx);
  assert.equal(ctx.feHost, CORENDON_FE_HOST_NL);
  const url = new URL(buildCorendonLowestpricesaccoUrl(ctx));
  assert.equal(url.searchParams.get('originalHost'), CORENDON_FE_HOST_NL);
});

test('live price is listing-bound: BE context does not use NL host', () => {
  const be = buildCorendonLiveContext(makeOffer(), { adults: 2 }, BE_NL);
  const nl = buildCorendonLiveContext(makeOffer(), { adults: 2 }, NL);
  assert.ok(be && nl);
  assert.notEqual(
    new URL(buildCorendonLowestpricesaccoUrl(be)).searchParams.get('originalHost'),
    new URL(buildCorendonLowestpricesaccoUrl(nl)).searchParams.get('originalHost'),
  );
  assert.equal(be.listing?.deepLink, BE_NL.deepLink);
  assert.equal(nl.listing?.deepLink, NL.deepLink);
});

test('click-out uses the same listing as the live-price source', async () => {
  const hosts: string[] = [];
  const priced = await priceOfferForDetail(makeOffer({ providerListings: [NL, BE_NL] }), {
    adults: 2,
    siteMarket: 'nl',
    departureAirport: 'BRU',
  }, {
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      if (String(input).includes('lowestpricesacco')) {
        hosts.push(url.searchParams.get('originalHost') ?? '');
      }
      return listingBoundFetch()(input);
    },
  });

  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.livePriceSource, 'upsales');
  assert.equal(priced.price, 876);
  assert.notEqual(priced.price, 458);
  assert.equal(hosts[0], priced.listingHost);
  assert.equal(affiliateHref(priced), priced.deepLink);
  assert.ok(affiliateHref(priced)?.includes(priced.listingHost ?? ''));
});

test('feed/catalog price is never used as live fallback', async () => {
  const priced = await priceOfferForDetail(makeOffer(), { adults: 2 }, {
    fetchImpl: async () => new Response(null, { status: 204 }),
  });
  assert.equal(priced.livePriceStatus, 'unavailable');
  assert.equal(hasValidPresentablePrice(priced), false);
});

test('DOB is part of the cache key and kept on Detail href', () => {
  const partyA = [
    { dateOfBirth: '1975-03-12', roomIndex: 0 },
    { dateOfBirth: '1978-06-04', roomIndex: 0 },
  ];
  const partyB = [
    { dateOfBirth: '1975-03-12', roomIndex: 0 },
    { dateOfBirth: '2010-04-01', roomIndex: 0 },
  ];
  assert.notEqual(
    livePriceCacheKey('corendon-9514', { adults: 2, party: partyA }),
    livePriceCacheKey('corendon-9514', { adults: 2, party: partyB }),
  );

  const href = buildOfferDetailHref('corendon-9514', {
    adults: 2,
    party: partyA,
    departureStart: '2026-08-20',
    departureAirport: 'BRU',
  });
  const params = parseSearchParams(Object.fromEntries(new URL(href, 'https://vacationmap.be').searchParams));
  assert.deepEqual(params.party, partyA);
  assert.equal(params.departureAirport, 'BRU');
});

test('room count uses proven nested partyComposition on lowestpricesacco', () => {
  const ctx = buildCorendonLiveContext(makeOffer(), {
    adults: 2,
    rooms: 2,
    party: [
      { dateOfBirth: '1975-03-12', roomIndex: 0 },
      { dateOfBirth: '1978-06-04', roomIndex: 1 },
    ],
  });
  assert.ok(ctx);
  assert.equal(ctx.pricingRoute, 'upsales');
  assert.deepEqual(ctx.upsalesPax, [
    { birthDate: '1975-03-12', roomNr: 1 },
    { birthDate: '1978-06-04', roomNr: 2 },
  ]);
  assert.deepEqual(ctx.partyComposition, CORENDON_TWO_ROOM_2A_PARTY);
  const url = new URL(buildCorendonLowestpricesaccoUrl(ctx));
  assert.equal(url.searchParams.get('partyComposition'), JSON.stringify(CORENDON_TWO_ROOM_2A_PARTY));
  assert.notEqual(url.searchParams.get('partyComposition'), JSON.stringify(CORENDON_DEFAULT_2A_PARTY));
});

test('room assignments stay in the cache key', () => {
  const sameRoom = [
    { dateOfBirth: '1975-03-12', roomIndex: 0 },
    { dateOfBirth: '1978-06-04', roomIndex: 0 },
  ];
  const splitRooms = [
    { dateOfBirth: '1975-03-12', roomIndex: 0 },
    { dateOfBirth: '1978-06-04', roomIndex: 1 },
  ];
  assert.notEqual(
    livePriceCacheKey('corendon-9514', { adults: 2, rooms: 2, party: sameRoom }),
    livePriceCacheKey('corendon-9514', { adults: 2, rooms: 2, party: splitRooms }),
  );
});

test('departure airport prefers matching Corendon environment', () => {
  const amsOffer = makeOffer({
    deepLink: BE_AMS.deepLink,
    providerListings: [BE_AMS, NL_AMS],
  });
  const bruOffer = makeOffer({ providerListings: [BE_NL, NL] });

  assert.equal(selectCorendonListing(amsOffer, { siteMarket: 'be' })?.host, CORENDON_FE_HOST_NL);
  assert.equal(selectCorendonListing(bruOffer, { siteMarket: 'nl' })?.host, CORENDON_FE_HOST);
});

test('Belgian user + Amsterdam uses NL listing', () => {
  const offer = makeOffer({
    deepLink: BE_AMS.deepLink,
    providerListings: [BE_AMS, NL_AMS],
  });
  const selected = selectCorendonListing(offer, { siteMarket: 'be', departureAirport: 'AMS' });
  assert.equal(selected?.host, CORENDON_FE_HOST_NL);
  assert.equal(selected?.feedId, CORENDON_FEED_NL);
});

test('Dutch user + Brussels uses BE listing', () => {
  const selected = selectCorendonListing(makeOffer(), { siteMarket: 'nl', departureAirport: 'BRU' });
  assert.equal(selected?.host, CORENDON_FE_HOST);
  assert.equal(selected?.feedId, CORENDON_FEED_BENL);
});

test('cache key blocks cross-listing and cross-occupancy reuse', () => {
  assert.notEqual(
    livePriceCacheKey('corendon-9514', { adults: 2, listingKey: 'www.corendon.be|corendon-benl' }),
    livePriceCacheKey('corendon-9514', { adults: 2, listingKey: 'www.corendon.nl|corendon-nl' }),
  );
  assert.notEqual(
    livePriceCacheKey('corendon-9514', { adults: 2, listingKey: 'www.corendon.be|corendon-benl' }),
    livePriceCacheKey('corendon-9514', {
      adults: 2,
      listingKey: 'www.corendon.be|corendon-benl',
      party: [{ dateOfBirth: '1975-03-12', roomIndex: 0 }, { dateOfBirth: '1978-06-04', roomIndex: 0 }],
    }),
  );
});

test('Detail click-out keeps Results occupancy and selected listing host', async () => {
  const href = buildOfferDetailHref('corendon-9514', {
    adults: 2,
    party: [
      { dateOfBirth: '1975-03-12', roomIndex: 0 },
      { dateOfBirth: '1978-06-04', roomIndex: 0 },
    ],
    departureAirport: 'BRU',
    departureStart: '2026-08-20',
  });
  const parsed = parseSearchParams(Object.fromEntries(new URL(href, 'https://vacationmap.be').searchParams));
  const priced = await priceOfferForDetail(makeOffer(), parsed, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(
          JSON.stringify({
            package: {
              lowestPriceTrip: {
                tripDepartureDate: '2026-08-27T00:00:00',
                trip: {
                  price: 876,
                  tripCode: `${FRAGMENT_BRU}.BRUCFU4C.CFU`,
                  tripUrlHash: `[filters]BEL/BRU.*.*.*.0|||${FRAGMENT_BRU}.BRUCFU4C.CFU|||true`,
                  priceTableDate: '20260827',
                  durationInDays: 5,
                },
              },
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes('/upsales')) {
        return new Response(
          JSON.stringify({
            result: {
              extendedTripCode: `${FRAGMENT_BRU}.BRUCFU4C.CFU`,
              prices: {
                totalPrice: 1424,
                priceTableCalculatedPricePerPerson: 710,
              },
              selectedTripCudl: {
                selectedTrip: {
                  system: { request: { departureDate: '2026-08-27' } },
                },
              },
            },
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch ${url}`);
    },
  });
  assert.equal(parsed.adults, 2);
  assert.equal(parsed.party?.length, 2);
  assert.equal(priced.listingHost, CORENDON_FE_HOST);
  assert.equal(affiliateHref(priced), priced.deepLink);
  assert.ok(affiliateHref(priced)?.includes('www.corendon.be'));
});

test('unique BE-FR-only offer keeps fr.corendon.be for live and click-out', async () => {
  const offer = makeOffer({
    deepLink: BE_FR.deepLink,
    listingHost: BE_FR.host,
    feedSourceId: BE_FR.feedId,
    providerListings: [BE_FR],
  });
  const priced = await priceOfferForDetail(offer, { adults: 2 }, {
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      assert.equal(url.searchParams.get('originalHost'), CORENDON_FE_HOST_BE_FR);
      return listingBoundFetch()(input);
    },
  });
  assert.equal(priced.listingHost, CORENDON_FE_HOST_BE_FR);
  assert.equal(affiliateHref(priced), BE_FR.deepLink);
});

test('live waterfall uses next listing when the preferred host is empty', async () => {
  const hosts: string[] = [];
  const priced = await priceOfferForDetail(makeOffer({ providerListings: [BE_NL, NL] }), {
    adults: 2,
    departureAirport: 'BRU',
  }, {
    fetchImpl: async (input) => {
      const host = new URL(String(input)).searchParams.get('originalHost') ?? '';
      if (String(input).includes('lowestpricesacco')) {
        hosts.push(host);
        if (host === CORENDON_FE_HOST) {
          return new Response(null, { status: 204 });
        }
        return new Response(okBody(), { status: 200 });
      }
      if (String(input).includes('/upsales')) {
        return new Response(okUpsalesBody(), { status: 200 });
      }
      throw new Error(`unexpected fetch ${String(input)}`);
    },
  });
  assert.deepEqual(hosts, [CORENDON_FE_HOST, CORENDON_FE_HOST_NL]);
  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.listingHost, CORENDON_FE_HOST_NL);
  assert.equal(affiliateHref(priced), NL.deepLink);
});

test('site market is derived from vacationmap host, not guessed on localhost', () => {
  assert.equal(resolveSiteMarketFromHost('vacationmap.be'), 'be');
  assert.equal(resolveSiteMarketFromHost('www.vacationmap.nl:443'), 'nl');
  assert.equal(resolveSiteMarketFromHost('localhost:3000'), undefined);
});

test('rank does not use catalog price', () => {
  const cheapNl = { ...NL, deepLink: `${NL.deepLink}&price=1` };
  const expensiveBe = BE_NL;
  const ranked = rankCorendonListings(
    makeOffer({
      price: 10,
      providerListings: [cheapNl, expensiveBe],
    }),
    { departureAirport: 'BRU' },
  );
  assert.equal(ranked[0].host, CORENDON_FE_HOST);
});

test('lowestpricesacco stale listing context is not a live price', async () => {
  const ctx = buildCorendonLiveContext(makeOffer(), { adults: 2 }, NL);
  assert.ok(ctx);
  const result = await fetchCorendonLowestpricesaccoPrice(ctx, {
    fetchImpl: async () =>
      new Response(okBody(512, '9514.COSPY.AMSCFU.270826.3-4-3.SZ-U'), { status: 200 }),
  });
  assert.equal(result.ok, false);
});
