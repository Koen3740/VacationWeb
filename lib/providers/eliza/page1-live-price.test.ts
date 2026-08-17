import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import { PRIJSVRIJ_PROVIDER_NAME } from '../prijsvrij/constants';
import {
  markPrijsvrijLivePriceUnavailable,
  priceLiveRequiredMatchset,
  pricePage1WithPrijsvrijReceipts,
  resolveResultsPageSlice,
  startPage1ReceiptStream,
  clearLivePriceInflightForTests,
} from '../prijsvrij/page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from '../prijsvrij/receipt-auth';
import { clearResultsLivePriceCache } from '../../search/results-live-price-cache';
import { hasValidPresentablePrice } from '../../search/presentable-price';

const ELIZA_LANDING =
  'https://www.elizawashere.be/spanje/andalusie/ronda/casita-paradise-island' +
  '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
  '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-11-19' +
  '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30';

const ELIZA_PRODUCT_URL =
  'https://www.elizawashere.be/reizen?tt=1327_2084000_511747_&r=' +
  encodeURIComponent(ELIZA_LANDING);

const ELIZA_LANDING_HTML =
  '{"template":"AccommodationPage","contextItemId":"29c6d01a-70c6-4297-9422-1c3dab8c94ad"}' +
  '"PDP.promotedPriceId":"C6E4E13C-D74A-4A4D-BC6B-C151B6FF1E42"';

function okPromotedBody(overrides: {
  averagePrice?: number;
  accommodationId?: number;
  departureDate?: string;
} = {}): string {
  return JSON.stringify({
    accommodationId: overrides.accommodationId ?? 6270665,
    duration: 8,
    price: {
      totalPrice: 1304,
      averagePrice: overrides.averagePrice ?? 652,
      value: overrides.averagePrice ?? 652,
      legend: 'Vanafprijs p.p.',
    },
    departureDate: { raw: overrides.departureDate ?? '2026-11-19' },
    acmInformation: { mealplanCode: 'LG' },
  });
}

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  return {
    hotelName: 'Casita Paradise Island',
    destinationCountry: 'Spanje',
    departureDate: '2026-11-19',
    nights: 7,
    flightIncluded: 'true',
    price: 599,
    pricePerDay: 86,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: ELIZA_PRODUCT_URL,
    ...overrides,
  };
}

function okReceiptBody(total = 800): string {
  return JSON.stringify({
    Receipt: {
      Package: {
        PriceInfo: { TotalInclLocal: { Value: total } },
        PaxDetails: { Adults: 2, Children: 0 },
      },
    },
  });
}

function makeLiveFetch(options: {
  priceStatus?: number;
  priceBody?: string | null;
  landingStatus?: number;
  onPromoted?: (url: string) => void;
  onLanding?: (url: string) => void;
}): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      options.onPromoted?.(url);
      const status = options.priceStatus ?? 200;
      if (status === 204) {
        return new Response(null, { status: 204 });
      }
      return new Response(options.priceBody ?? okPromotedBody(), { status });
    }
    if (url.includes('elizawashere.be') && !url.includes('/api/')) {
      options.onLanding?.(url);
      return new Response(ELIZA_LANDING_HTML, { status: options.landingStatus ?? 200 });
    }
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 't'.repeat(40) }), { status: 200 });
    }
    return new Response(okReceiptBody(), { status: 200 });
  };
}

beforeEach(() => {
  clearPrijsvrijReceiptTokenCache();
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
});

test('page1: Eliza success is proven getPromotedPrice, not feed price', async () => {
  let promotedCalls = 0;
  let landingCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({ id: 'eliza-6270665', provider: 'Eliza was here', price: 599 }),
      makeOffer({ id: 'sunweb-a', provider: 'Sunweb', price: 350, deepLink: 'https://example.com' }),
    ],
    { adults: 2 },
    {
      fetchImpl: makeLiveFetch({
        onPromoted: () => {
          promotedCalls += 1;
        },
        onLanding: () => {
          landingCalls += 1;
        },
      }),
    },
  );

  const eliza = page.find((offer) => offer.provider === 'Eliza was here');
  assert.ok(eliza);
  assert.equal(landingCalls, 1);
  assert.equal(promotedCalls, 1);
  assert.equal(eliza.livePriceStatus, 'proven');
  assert.equal(eliza.livePriceSource, 'getPromotedPrice');
  assert.equal(eliza.price, 652);
  assert.notEqual(eliza.price, 599);
  assert.ok(hasValidPresentablePrice(eliza));
});

test('page1: Eliza 204 does not present the offer and does not use feed as live', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'eliza-6270665', provider: 'Eliza was here', price: 599 })],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({ priceStatus: 204 }) },
  );
  assert.equal(page.length, 0);
  assert.ok(!page.some((offer) => offer.id === 'eliza-6270665'));
});

test('page1: Eliza API failure does not fall back to feed', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'eliza-6270665', provider: 'Eliza was here', price: 599 })],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({ priceStatus: 500 }) },
  );
  assert.equal(page.length, 0);
});

test('page1: mismatch does not present Eliza', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'eliza-6270665', provider: 'Eliza was here', price: 599 })],
    { adults: 2 },
    {
      fetchImpl: makeLiveFetch({
        priceBody: okPromotedBody({ accommodationId: 1, departureDate: '2027-01-01' }),
      }),
    },
  );
  assert.equal(page.length, 0);
});

test('stream: valid Eliza is pending; invalid Eliza is immediate unavailable', async () => {
  const stream = startPage1ReceiptStream(
    [
      makeOffer({ id: 'eliza-6270665', provider: 'Eliza was here' }),
      makeOffer({
        id: 'eliza-1',
        provider: 'Eliza was here',
        deepLink: 'https://example.com',
      }),
      makeOffer({ id: 'sunweb-a', provider: 'Sunweb', deepLink: 'https://example.com' }),
    ],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({}) },
  );

  const pending = stream.slots.filter((slot) => slot.kind === 'pending');
  const immediate = stream.slots.filter((slot) => slot.kind === 'immediate');
  assert.equal(pending.length, 1);
  assert.equal(immediate.length, 2);
  assert.equal(immediate[0].kind, 'immediate');
  if (immediate[0].kind === 'immediate') {
    assert.equal(immediate[0].offer.id, 'eliza-1');
    assert.equal(immediate[0].offer.livePriceStatus, 'unavailable');
  }
  assert.equal(immediate[1].kind, 'immediate');
  if (immediate[1].kind === 'immediate') {
    assert.equal(immediate[1].offer.provider, 'Sunweb');
    assert.equal(immediate[1].offer.livePriceSource, 'feed');
  }

  const priced = await pending[0].offer;
  assert.ok(priced);
  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.livePriceSource, 'getPromotedPrice');
});

test('Package-1: Eliza live failure is reserved/compacted; PV cap unchanged', async () => {
  clearPrijsvrijReceiptTokenCache();
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({ id: 'eliza-6270665', provider: 'Eliza was here', price: 599 }),
      makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 999 }),
      makeOffer({ id: 'sunweb-a', provider: 'Sunweb', price: 350, deepLink: 'https://example.com' }),
    ],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({ priceStatus: 204 }) },
  );
  assert.ok(!page.some((offer) => offer.id === 'eliza-6270665'));
  assert.ok(page.some((offer) => offer.id === 'prijsvrij-100-x' && offer.livePriceSource === 'receipt'));
  assert.ok(page.some((offer) => offer.id === 'sunweb-a'));
  assert.ok(page.filter((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME).length <= 3);
  assert.ok(page.every(hasValidPresentablePrice));
});

test('page2+: remaining Eliza is live-priced on the matchset, then cached', async () => {
  clearPrijsvrijReceiptTokenCache();
  clearResultsLivePriceCache();
  const offers = [
    ...Array.from({ length: 10 }, (_, i) =>
      makeOffer({
        id: `sunweb-${i}`,
        provider: 'Sunweb',
        deepLink: 'https://example.com',
      }),
    ),
    makeOffer({ id: 'eliza-6270665', provider: 'Eliza was here', price: 599 }),
  ];

  let promotedCalls = 0;
  const page1 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1 },
    {
      fetchImpl: makeLiveFetch({
        onPromoted: () => {
          promotedCalls += 1;
        },
      }),
    },
  );
  assert.equal(promotedCalls, 0);

  await priceLiveRequiredMatchset(offers, { adults: 2 }, {
    fetchImpl: makeLiveFetch({
      onPromoted: () => {
        promotedCalls += 1;
      },
    }),
  });
  assert.ok(promotedCalls >= 1);

  promotedCalls = 0;
  const slice = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 2, page1Ids: page1.page1Ids },
    {
      fetchImpl: makeLiveFetch({
        onPromoted: () => {
          promotedCalls += 1;
        },
      }),
    },
  );
  assert.equal(promotedCalls, 0);
  const marked = markPrijsvrijLivePriceUnavailable([
    makeOffer({ id: 'eliza-6270665', provider: 'Eliza was here', price: 599 }),
  ]);
  assert.equal(marked[0].livePriceStatus, 'unavailable');
  assert.equal(marked[0].livePriceSource, undefined);
  const eliza = slice.visibleOffers.find((offer) => offer.provider === 'Eliza was here');
  assert.ok(eliza);
  assert.equal(eliza.livePriceSource, 'getPromotedPrice');
});

test('landing URL used for bootstrap is the unwrapped productURL', async () => {
  let landingUrl = '';
  await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'eliza-6270665', provider: 'Eliza was here' })],
    { adults: 2 },
    {
      fetchImpl: makeLiveFetch({
        onLanding: (url) => {
          landingUrl = url;
        },
      }),
    },
  );
  assert.equal(landingUrl, ELIZA_LANDING);
});
