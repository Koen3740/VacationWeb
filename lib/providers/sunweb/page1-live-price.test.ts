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
import { hasValidPresentablePrice, isResultsVisibleOffer, resultsPricePresentation } from '../../search/presentable-price';
import { priceOfferForDetail } from '../../search/price-offer-for-detail';
import { SUNWEB_PRODUCT_URL } from './offer-context.test';
import {
  echoGroupedPricesFromUrl,
  okGroupedPricesBody,
  okPromotedBody,
  SUNWEB_LANDING_HTML,
} from './promoted-price-client.test';

const FOUR_PAX_TWO_ROOMS = {
  adults: 2,
  children: 2,
  rooms: 2,
  party: [
    { dateOfBirth: '1990-01-15', roomIndex: 0 },
    { dateOfBirth: '1988-03-03', roomIndex: 0 },
    { dateOfBirth: '2014-06-14', roomIndex: 1 },
    { dateOfBirth: '2018-01-22', roomIndex: 1 },
  ],
};

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  return {
    hotelName: 'Appartementen Bristol Seaview',
    destinationCountry: 'Griekenland',
    departureDate: '2026-09-26',
    nights: 7,
    flightIncluded: 'true',
    price: 427,
    pricePerDay: 61,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: SUNWEB_PRODUCT_URL,
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
  groupedBody?: string | ((url: string) => string);
  groupedStatus?: number;
  onPromoted?: (url: string) => void;
  onLanding?: (url: string) => void;
  onGrouped?: (url: string) => void;
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
    if (url.includes('GetPricesGroupedByDurationApi')) {
      options.onGrouped?.(url);
      const status = options.groupedStatus ?? 200;
      const body =
        typeof options.groupedBody === 'function'
          ? options.groupedBody(url)
          : (options.groupedBody ?? echoGroupedPricesFromUrl(url));
      return new Response(body, { status });
    }
    if (url.includes('sunweb.be') && !url.includes('/api/')) {
      options.onLanding?.(url);
      return new Response(SUNWEB_LANDING_HTML, { status: options.landingStatus ?? 200 });
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

test('page1: 4 pax / 2 rooms uses proven GetPromotedPrice, not feed €', async () => {
  let promotedCalls = 0;
  let landingCalls = 0;
  let promotedUrl = '';
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 }),
      makeOffer({
        id: 'eliza-6270665',
        provider: 'Eliza was here',
        price: 599,
        deepLink: 'https://example.com',
      }),
    ],
    FOUR_PAX_TWO_ROOMS,
    {
      fetchImpl: makeLiveFetch({
        onPromoted: (url) => {
          promotedCalls += 1;
          promotedUrl = url;
        },
        onLanding: () => {
          landingCalls += 1;
        },
      }),
    },
  );

  const sun = page.find((offer) => offer.provider === 'Sunweb');
  assert.ok(sun);
  assert.equal(landingCalls, 1);
  assert.equal(promotedCalls, 1);
  const promoted = new URL(promotedUrl);
  assert.equal(promoted.searchParams.get('Participants[0][0]'), '1990-01-15');
  assert.equal(promoted.searchParams.get('Participants[1][1]'), '2018-01-22');
  assert.ok(!promotedUrl.includes('1996-07-30'));
  assert.equal(sun.livePriceStatus, 'proven');
  assert.equal(sun.livePriceSource, 'getPromotedPrice');
  assert.equal(sun.price, 558);
  assert.notEqual(sun.price, 427);
  assert.ok(hasValidPresentablePrice(sun));
  assert.ok(!page.some((offer) => offer.provider === 'Eliza was here'));
});

test('page1: 2A does not call GetPromotedPrice and is not shown without a proven live €', async () => {
  let promotedCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 })],
    { adults: 2 },
    {
      fetchImpl: makeLiveFetch({
        onPromoted: () => {
          promotedCalls += 1;
        },
      }),
    },
  );
  assert.equal(promotedCalls, 0);
  assert.equal(page.length, 0);
});

test('page1: 4 pax / 2 rooms without party DOBs is not shown', async () => {
  let promotedCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 })],
    { adults: 2, children: 2, rooms: 2 },
    {
      fetchImpl: makeLiveFetch({
        onPromoted: () => {
          promotedCalls += 1;
        },
      }),
    },
  );
  assert.equal(promotedCalls, 0);
  assert.equal(page.length, 0);
});

test('page1: Sunweb 204 does not present the offer and does not use feed as live', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 })],
    FOUR_PAX_TWO_ROOMS,
    { fetchImpl: makeLiveFetch({ priceStatus: 204 }) },
  );
  assert.equal(page.length, 0);
  assert.ok(!page.some((offer) => offer.id === 'sunweb-84012'));
});

test('page1: mismatch does not present Sunweb', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 })],
    FOUR_PAX_TWO_ROOMS,
    {
      fetchImpl: makeLiveFetch({
        priceBody: okPromotedBody({ accommodationId: 1, departureDate: '2027-01-01' }),
      }),
    },
  );
  assert.equal(page.length, 0);
});

test('stream: valid Sunweb 4p/2r is pending; 2A Sunweb is immediate catalog', async () => {
  const stream = startPage1ReceiptStream(
    [
      makeOffer({ id: 'sunweb-84012', provider: 'Sunweb' }),
      makeOffer({
        id: 'sunweb-1',
        provider: 'Sunweb',
        deepLink: 'https://example.com',
      }),
    ],
    FOUR_PAX_TWO_ROOMS,
    { fetchImpl: makeLiveFetch({}) },
  );

  const pending = stream.slots.filter((slot) => slot.kind === 'pending');
  const immediate = stream.slots.filter((slot) => slot.kind === 'immediate');
  assert.equal(pending.length, 1);
  assert.equal(immediate.length, 1);
  assert.equal(immediate[0].kind, 'immediate');
  if (immediate[0].kind === 'immediate') {
    assert.equal(immediate[0].offer.id, 'sunweb-1');
    assert.equal(immediate[0].offer.livePriceStatus, 'unavailable');
  }

  const priced = await pending[0].offer;
  assert.ok(priced);
  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.livePriceSource, 'getPromotedPrice');
});

test('page1 splices crowded Sunweb 4p/2r live; later pages use cache without extra HTTP', async () => {
  const offers = [
    ...Array.from({ length: 10 }, (_, i) =>
      makeOffer({
        id: `eliza-${i}`,
        provider: 'Eliza was here',
        deepLink: 'https://example.com',
      }),
    ),
    makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 }),
  ];

  let promotedCalls = 0;
  const page1 = await resolveResultsPageSlice(offers, FOUR_PAX_TWO_ROOMS, {
    fetchImpl: makeLiveFetch({
      onPromoted: () => {
        promotedCalls += 1;
      },
    }),
  });
  const page1Sun = page1.visibleOffers.find((offer) => offer.provider === 'Sunweb');
  assert.ok(page1Sun);
  assert.equal(page1Sun.livePriceSource, 'getPromotedPrice');
  assert.equal(page1Sun.price, 558);
  assert.ok(promotedCalls >= 1);
  assert.ok(page1.page1Ids?.includes('sunweb-84012'));

  promotedCalls = 0;
  const slice = await resolveResultsPageSlice(
    offers,
    { ...FOUR_PAX_TWO_ROOMS, page: 2, page1Ids: page1.page1Ids },
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
    makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 }),
  ]);
  assert.notEqual(marked[0].livePriceStatus, 'unavailable');
  assert.equal(
    slice.visibleOffers.some((offer) => offer.id === 'sunweb-84012'),
    false,
  );
});

test('landing URL used for bootstrap carries occupancy Participants, not feed 2A', async () => {
  let landingUrl = '';
  await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'sunweb-84012', provider: 'Sunweb' })],
    FOUR_PAX_TWO_ROOMS,
    {
      fetchImpl: makeLiveFetch({
        onLanding: (url) => {
          landingUrl = url;
        },
      }),
    },
  );
  const landing = new URL(landingUrl);
  assert.equal(landing.hostname, 'www.sunweb.be');
  assert.equal(landing.searchParams.get('Participants[0][0]'), '1990-01-15');
  assert.equal(landing.searchParams.get('Participants[1][1]'), '2018-01-22');
  assert.ok(!landingUrl.includes('1996-07-30'));
});

test('Detail: 4 pax / 2 rooms uses GetPromotedPrice; 2A catalog is not shown as live €', async () => {
  const live = await priceOfferForDetail(
    makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 }),
    FOUR_PAX_TWO_ROOMS,
    { fetchImpl: makeLiveFetch({}) },
  );
  assert.equal(live.livePriceSource, 'getPromotedPrice');
  assert.equal(live.price, 558);

  const catalog = await priceOfferForDetail(
    makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 }),
    { adults: 2 },
  );
  assert.equal(catalog.price, 427);
  assert.equal(hasValidPresentablePrice(catalog), false);
  assert.notEqual(resultsPricePresentation(catalog), 'amount');
});

test('page1: 4p/2r Sunweb outside the 150-cap rank still gets a GetPromotedPrice card', async () => {
  const corendonUrl = 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
  let promotedCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      ...Array.from({ length: 150 }, (_, i) =>
        makeOffer({
          id: `corendon-cap-${i}`,
          provider: 'Corendon',
          deepLink: corendonUrl,
        }),
      ),
      makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 }),
    ],
    FOUR_PAX_TWO_ROOMS,
    {
      fetchImpl: makeLiveFetch({
        onPromoted: () => {
          promotedCalls += 1;
        },
      }),
    },
  );

  const sun = page.find((offer) => offer.provider === 'Sunweb');
  assert.ok(sun);
  assert.equal(sun.id, 'sunweb-84012');
  assert.equal(sun.livePriceSource, 'getPromotedPrice');
  assert.equal(sun.price, 558);
  assert.notEqual(sun.price, 427);
  assert.ok(promotedCalls >= 1);
});

test('page1: 4p/2r Sunweb is not crowded out of Results by 10 other live-required offers', async () => {
  const corendonUrl = 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
  let promotedCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      ...Array.from({ length: 10 }, (_, i) =>
        makeOffer({
          id: `corendon-${i}`,
          provider: 'Corendon',
          deepLink: corendonUrl,
        }),
      ),
      makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 }),
    ],
    FOUR_PAX_TWO_ROOMS,
    {
      fetchImpl: makeLiveFetch({
        onPromoted: () => {
          promotedCalls += 1;
        },
      }),
    },
  );

  const sun = page.find((offer) => offer.provider === 'Sunweb');
  assert.ok(sun);
  assert.equal(sun.id, 'sunweb-84012');
  assert.equal(sun.livePriceStatus, 'proven');
  assert.equal(sun.livePriceSource, 'getPromotedPrice');
  assert.equal(sun.price, 558);
  assert.notEqual(sun.price, 427);
  assert.ok(promotedCalls >= 1);
  assert.ok(hasValidPresentablePrice(sun));
});

test('page1: 2A Sunweb stays catalog when 10 other offers fill page-1 rank', async () => {
  const corendonUrl = 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
  let promotedCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      ...Array.from({ length: 10 }, (_, i) =>
        makeOffer({
          id: `corendon-${i}`,
          provider: 'Corendon',
          deepLink: corendonUrl,
        }),
      ),
      makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 }),
    ],
    { adults: 2 },
    {
      fetchImpl: makeLiveFetch({
        onPromoted: () => {
          promotedCalls += 1;
        },
      }),
    },
  );

  assert.equal(promotedCalls, 0);
  assert.equal(page.some((offer) => offer.id === 'sunweb-84012'), false);
});

test('stream: crowded 4p/2r page-1 still pending-prices live-capable Sunweb', async () => {
  const corendonUrl = 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
  const stream = startPage1ReceiptStream(
    [
      ...Array.from({ length: 10 }, (_, i) =>
        makeOffer({
          id: `corendon-${i}`,
          provider: 'Corendon',
          deepLink: corendonUrl,
        }),
      ),
      makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 }),
    ],
    FOUR_PAX_TWO_ROOMS,
    { fetchImpl: makeLiveFetch({}) },
  );

  const pendingSunweb = stream.slots.filter(
    (slot) => slot.kind === 'pending',
  );
  assert.ok(pendingSunweb.length >= 1);

  const presented = await stream.presented;
  const sun = presented.page1.find((offer) => offer.provider === 'Sunweb');
  assert.ok(sun);
  assert.equal(sun.livePriceSource, 'getPromotedPrice');
  assert.equal(sun.price, 558);
});

test('page1: Prijsvrij cap unchanged when Sunweb 4p/2r live-prices', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 }),
      makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 999 }),
    ],
    FOUR_PAX_TWO_ROOMS,
    { fetchImpl: makeLiveFetch({}) },
  );
  assert.ok(page.some((offer) => offer.id === 'sunweb-84012' && offer.livePriceSource === 'getPromotedPrice'));
  assert.ok(page.filter((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME).length <= 3);
});

function sunwebOfferUrl(opts: {
  date: string;
  airport: string;
  meal: string;
  duration?: string;
}): string {
  const duration = opts.duration ?? '8';
  const landing =
    'https://www.sunweb.be/nl/vakantie/spanje/costa-brava/hotel' +
    `?Duration[0]=${duration}&TransportType[0]=Flight&Mealplan[0]=${opts.meal}` +
    `&DepartureAirport[0]=${opts.airport}&DepartureDate[0]=${opts.date}` +
    '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30';
  return (
    'https://www.sunweb.be/nl/vakantie/reizen?tt=1393_1754875_511747_&r=' +
    encodeURIComponent(landing)
  );
}

test('page1: Alba 2026-10-21 CRL 8 LO unavailable → no GPP and no Results card', async () => {
  let promotedCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({
        id: 'sunweb-6143876-2026-10-21-8-CRL-Logiesontbijt',
        provider: 'Sunweb',
        hotelName: 'Hotel Alba Seleqtta',
        departureDate: '2026-10-21',
        price: 387,
        deepLink: sunwebOfferUrl({ date: '2026-10-21', airport: 'CRL', meal: 'LO' }),
      }),
    ],
    FOUR_PAX_TWO_ROOMS,
    {
      fetchImpl: makeLiveFetch({
        groupedBody: okGroupedPricesBody([]),
        priceBody: okPromotedBody({
          accommodationId: 6143876,
          departureDate: '2026-10-22',
          mealplan: 'LO',
          averagePrice: 388,
        }),
        onPromoted: () => {
          promotedCalls += 1;
        },
      }),
    },
  );
  assert.equal(promotedCalls, 0);
  assert.equal(page.length, 0);
});

test('page1: The Breeze 2026-09-08 CRL 8 AI unavailable → no GPP and no Results card', async () => {
  let promotedCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({
        id: 'sunweb-6254500-2026-09-08-8-CRL-AllInclusive',
        provider: 'Sunweb',
        hotelName: 'The Breeze',
        departureDate: '2026-09-08',
        price: 490,
        deepLink: sunwebOfferUrl({ date: '2026-09-08', airport: 'CRL', meal: 'AI' }),
      }),
    ],
    FOUR_PAX_TWO_ROOMS,
    {
      fetchImpl: makeLiveFetch({
        groupedBody: okGroupedPricesBody([
          { departureDate: '2026-09-30', duration: 8, mealplan: 'AI' },
        ]),
        priceBody: okPromotedBody({
          accommodationId: 6254500,
          departureDate: '2026-09-30',
          mealplan: 'AI',
          averagePrice: 490,
        }),
        onPromoted: () => {
          promotedCalls += 1;
        },
      }),
    },
  );
  assert.equal(promotedCalls, 0);
  assert.equal(page.length, 0);
});

test('page1: Alba 2026-10-22 CRL 8 LO available → Results card with proven €388', async () => {
  let promotedCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({
        id: 'sunweb-6143876-2026-10-22-8-CRL-Logiesontbijt',
        provider: 'Sunweb',
        hotelName: 'Hotel Alba Seleqtta',
        departureDate: '2026-10-22',
        price: 350,
        deepLink: sunwebOfferUrl({ date: '2026-10-22', airport: 'CRL', meal: 'LO' }),
      }),
    ],
    FOUR_PAX_TWO_ROOMS,
    {
      fetchImpl: makeLiveFetch({
        groupedBody: okGroupedPricesBody([
          { departureDate: '2026-10-22', duration: 8, mealplan: 'LO' },
        ]),
        priceBody: okPromotedBody({
          accommodationId: 6143876,
          departureDate: '2026-10-22',
          mealplan: 'LO',
          averagePrice: 388,
          totalPrice: 776,
        }),
        onPromoted: () => {
          promotedCalls += 1;
        },
      }),
    },
  );
  assert.equal(promotedCalls, 1);
  assert.equal(page.length, 1);
  assert.equal(page[0].livePriceStatus, 'proven');
  assert.equal(page[0].livePriceSource, 'getPromotedPrice');
  assert.equal(page[0].price, 388);
  assert.notEqual(page[0].price, 350);
  assert.ok(hasValidPresentablePrice(page[0]));
});

test('page1: Aquamarina 2026-10-06 NRN 8 HP available → Results card with proven €398', async () => {
  let promotedCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({
        id: 'sunweb-39064-2026-10-06-8-NRN-Halfpension',
        provider: 'Sunweb',
        hotelName: 'Aquamarina',
        departureDate: '2026-10-06',
        price: 300,
        deepLink: sunwebOfferUrl({ date: '2026-10-06', airport: 'NRN', meal: 'HP' }),
      }),
    ],
    FOUR_PAX_TWO_ROOMS,
    {
      fetchImpl: makeLiveFetch({
        groupedBody: okGroupedPricesBody([
          { departureDate: '2026-10-06', duration: 8, mealplan: 'HP' },
        ]),
        priceBody: okPromotedBody({
          accommodationId: 39064,
          departureDate: '2026-10-06',
          mealplan: 'HP',
          averagePrice: 398,
        }),
        onPromoted: () => {
          promotedCalls += 1;
        },
      }),
    },
  );
  assert.equal(promotedCalls, 1);
  assert.equal(page.length, 1);
  assert.equal(page[0].price, 398);
  assert.equal(page[0].livePriceSource, 'getPromotedPrice');
});

test('page1: 2A Sunweb still does not call grouped or GPP', async () => {
  let groupedCalls = 0;
  let promotedCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'sunweb-84012', provider: 'Sunweb', price: 427 })],
    { adults: 2 },
    {
      fetchImpl: makeLiveFetch({
        onGrouped: () => {
          groupedCalls += 1;
        },
        onPromoted: () => {
          promotedCalls += 1;
        },
      }),
    },
  );
  assert.equal(groupedCalls, 0);
  assert.equal(promotedCalls, 0);
  assert.equal(page.length, 0);
});
