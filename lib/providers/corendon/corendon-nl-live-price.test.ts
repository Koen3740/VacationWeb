import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import { CORENDON_DEFAULT_2A_PARTY, CORENDON_FE_HOST_NL, CORENDON_FE_VERSION } from './constants';
import {
  buildCorendonLowestpricesaccoUrl,
  fetchCorendonLowestpricesaccoPrice,
} from './lowestpricesacco-client';
import {
  buildCorendonLiveContext,
  parseCorendonUrlFragment,
  resolveCorendonFeHost,
  unwrapCorendonProductUrl,
} from './offer-context';
import {
  pricePage1WithPrijsvrijReceipts,
  startPage1ReceiptStream,
} from '../prijsvrij/page1-receipt-pricing';
import { clearResultsLivePriceCache } from '../../search/results-live-price-cache';

beforeEach(() => {
  clearResultsLivePriceCache();
});

/** First product in Productfeeds/Corendon/Corendon.nl.xml (campaign 38108). */
const NL_FRAGMENT = '5007.MLELC.EINPMI.041027.3.DZI-U..';
const NL_DIRECT = `https://www.corendon.nl/spanje/balearen/mallorca/can-pastilla/thb-el-cid#${NL_FRAGMENT}`;
const NL_REFERRAL =
  'https://referral.corendon.nl/c?c=38108&m=2315769&a=512055&r=&u=' +
  encodeURIComponent(NL_DIRECT);

function makeNlOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return {
    id: 'corendon-5007',
    provider: 'Corendon',
    hotelName: 'THB El Cid',
    destinationCountry: 'Spanje',
    departureDate: '2027-10-04',
    nights: 4,
    price: 405,
    pricePerDay: 101,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: NL_REFERRAL,
    affiliateCampaignId: '38108',
    ...overrides,
  };
}

function okNlBody(overrides: {
  price?: number;
  tripCode?: string;
  departureDate?: string;
} = {}) {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: overrides.departureDate ?? '2027-10-04T00:00:00',
        trip: {
          price: overrides.price ?? 512,
          tripCode: overrides.tripCode ?? '5007.MLELC.EINPMI.041027.3-4-3.DZI-U..',
        },
      },
    },
  });
}

test('NL mapping: referral unwrap, host, fragment, acco, date, airportRoute', () => {
  assert.equal(unwrapCorendonProductUrl(NL_REFERRAL), NL_DIRECT);
  assert.equal(resolveCorendonFeHost(NL_REFERRAL), CORENDON_FE_HOST_NL);
  assert.equal(resolveCorendonFeHost(NL_DIRECT), CORENDON_FE_HOST_NL);
  assert.equal(resolveCorendonFeHost('https://www.corendon.com/hotel#5007.MLELC.EINPMI.041027.3.DZI-U'), null);

  const fragment = parseCorendonUrlFragment(NL_REFERRAL);
  assert.ok(fragment);
  assert.equal(fragment.hotelId, '5007');
  assert.equal(fragment.accommodationCode, 'MLELC');
  assert.equal(fragment.airportRoute, 'EINPMI');
  assert.equal(fragment.dateYymmdd, '041027');
  assert.equal(fragment.durationNights, '3');
  assert.equal(fragment.roomBoard, 'DZI-U');

  const ctx = buildCorendonLiveContext(makeNlOffer(), { adults: 2 });
  assert.ok(ctx);
  assert.equal(ctx.accommodationId, '5007');
  assert.equal(ctx.departureIso, '2027-10-04');
  assert.equal(ctx.fragment.airportRoute, 'EINPMI');
  assert.equal(ctx.feHost, CORENDON_FE_HOST_NL);
  assert.equal(
    Buffer.from(ctx.fragment.raw, 'utf8').toString('base64'),
    Buffer.from(NL_FRAGMENT, 'utf8').toString('base64'),
  );
});

test('NL occupancy: default 2A only', () => {
  assert.ok(buildCorendonLiveContext(makeNlOffer(), { adults: 2 }));
  assert.equal(buildCorendonLiveContext(makeNlOffer(), { adults: 2, children: 1 }), null);
  assert.equal(buildCorendonLiveContext(makeNlOffer(), { adults: 2, babies: 1 }), null);
  assert.equal(buildCorendonLiveContext(makeNlOffer(), { adults: 2, rooms: 2 }), null);
});

test('NL hash request uses www.corendon.nl host and same lowestpricesacco contract', () => {
  const ctx = buildCorendonLiveContext(makeNlOffer(), { adults: 2 });
  assert.ok(ctx);
  const url = new URL(buildCorendonLowestpricesaccoUrl(ctx));
  assert.equal(url.pathname, '/fe/api/prices/lowestpricesacco');
  assert.equal(url.searchParams.get('version'), CORENDON_FE_VERSION);
  assert.equal(url.searchParams.get('originalHost'), CORENDON_FE_HOST_NL);
  assert.equal(url.searchParams.get('browserHost'), CORENDON_FE_HOST_NL);
  assert.equal(url.searchParams.get('accommodationId'), '5007');
  assert.equal(url.searchParams.get('useFiltersFromHash'), 'true');
  assert.equal(
    url.searchParams.get('partyComposition'),
    JSON.stringify(CORENDON_DEFAULT_2A_PARTY),
  );
  assert.equal(
    url.searchParams.get('priceTableHash'),
    Buffer.from(NL_FRAGMENT, 'utf8').toString('base64'),
  );
});

test('NL success: proven + lowestpricesacco; feed price not used', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeNlOffer({ price: 405 })],
    { adults: 2 },
    {
      fetchImpl: async () => new Response(okNlBody({ price: 512 }), { status: 200 }),
    },
  );
  assert.equal(page.length, 1);
  assert.equal(page[0].livePriceStatus, 'proven');
  assert.equal(page[0].livePriceSource, 'lowestpricesacco');
  assert.equal(page[0].price, 512);
  assert.notEqual(page[0].price, 405);
});

test('NL tripCode match required: date / airport / acco mismatch is not live', async () => {
  const ctx = buildCorendonLiveContext(makeNlOffer(), { adults: 2 });
  assert.ok(ctx);

  const staleDate = await fetchCorendonLowestpricesaccoPrice(ctx, {
    fetchImpl: async () =>
      new Response(okNlBody({ departureDate: '2027-11-01T00:00:00' }), { status: 200 }),
  });
  assert.equal(staleDate.ok, false);
  if (!staleDate.ok) assert.equal(staleDate.reason, 'stale_context');

  const staleAirport = await fetchCorendonLowestpricesaccoPrice(ctx, {
    fetchImpl: async () =>
      new Response(okNlBody({ tripCode: '5007.MLELC.AMSPMI.041027.3.DZI-U..' }), { status: 200 }),
  });
  assert.equal(staleAirport.ok, false);
  if (!staleAirport.ok) assert.equal(staleAirport.reason, 'stale_context');

  const staleAcco = await fetchCorendonLowestpricesaccoPrice(ctx, {
    fetchImpl: async () =>
      new Response(okNlBody({ tripCode: '9999.XXXXX.EINPMI.041027.3.DZI-U..' }), { status: 200 }),
  });
  assert.equal(staleAcco.ok, false);
  if (!staleAcco.ok) assert.equal(staleAcco.reason, 'stale_context');
});

test('NL 204 / malformed / API failure: unavailable, no feed fallback', async () => {
  const empty = await pricePage1WithPrijsvrijReceipts(
    [makeNlOffer({ price: 405 })],
    { adults: 2 },
    { fetchImpl: async () => new Response(null, { status: 204 }) },
  );
  assert.equal(empty[0].livePriceStatus, 'unavailable');
  assert.equal(empty[0].livePriceSource, undefined);
  assert.equal(empty[0].price, 405);

  const malformed = await pricePage1WithPrijsvrijReceipts(
    [makeNlOffer({ price: 405 })],
    { adults: 2 },
    { fetchImpl: async () => new Response(JSON.stringify({ package: {} }), { status: 200 }) },
  );
  assert.equal(malformed[0].livePriceStatus, 'unavailable');
  assert.notEqual(malformed[0].livePriceSource, 'lowestpricesacco');

  const failed = await pricePage1WithPrijsvrijReceipts(
    [makeNlOffer({ price: 405 })],
    { adults: 2 },
    { fetchImpl: async () => new Response('err', { status: 500 }) },
  );
  assert.equal(failed[0].livePriceStatus, 'unavailable');
  assert.equal(failed[0].id, 'corendon-5007');
});

test('NL stream: valid offer is pending live slot; keeps card on failure', async () => {
  const stream = startPage1ReceiptStream(
    [makeNlOffer(), { ...makeNlOffer(), id: 'sunweb-a', provider: 'Sunweb', deepLink: 'https://example.com' }],
    { adults: 2 },
    { fetchImpl: async () => new Response(okNlBody(), { status: 200 }) },
  );
  const pending = stream.slots.filter((slot) => slot.kind === 'pending');
  assert.equal(pending.length, 1);
  const priced = await pending[0].offer;
  assert.ok(priced);
  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.livePriceSource, 'lowestpricesacco');

  clearResultsLivePriceCache();
  const failedStream = startPage1ReceiptStream(
    [makeNlOffer({ price: 405 })],
    { adults: 2 },
    { fetchImpl: async () => new Response(null, { status: 204 }) },
  );
  const failed = await failedStream.slots[0].offer;
  assert.ok(failed);
  assert.equal(failed.livePriceStatus, 'unavailable');
  assert.equal((await failedStream.presented).page1[0].id, 'corendon-5007');
});
