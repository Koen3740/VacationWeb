import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import {
  clearLivePriceInflightForTests,
  priceLiveRequiredMatchset,
  pricePage1WithPrijsvrijReceipts,
} from '../providers/prijsvrij/page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from '../providers/prijsvrij/receipt-auth';
import { SUNWEB_PRODUCT_URL } from '../providers/sunweb/offer-context.test';
import {
  echoGroupedPricesFromUrl,
  okPromotedBody,
  SUNWEB_LANDING_HTML,
} from '../providers/sunweb/promoted-price-client.test';
import { priceOfferForDetail } from './price-offer-for-detail';
import {
  ELIZA_PROVIDER_NAME,
  excludeParkedResultsProviders,
  filterToPresentableOffers,
  hasProvenLiveDisplayPrice,
  hasProvenLiveTotalPrice,
  hasValidPresentablePrice,
  isParkedResultsProvider,
  isResultsVisibleOffer,
  PRIJSVRIJ_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
} from './presentable-price';
import { clearResultsLivePriceCache } from './results-live-price-cache';

const CORENDON_FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
const CORENDON_TRIP = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU';

const TWO_ADULTS_ONE_CHILD = {
  adults: 2,
  children: 1,
  rooms: 1,
  party: [
    { dateOfBirth: '1986-01-01', roomIndex: 0 },
    { dateOfBirth: '1986-01-01', roomIndex: 0 },
    { dateOfBirth: '2016-01-01', roomIndex: 0 },
  ],
};

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

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    departureDate: '2026-08-27',
    nights: 7,
    flightIncluded: 'true',
    price: 458,
    pricePerDay: 65,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: `https://www.corendon.be/vakantie#${CORENDON_FRAGMENT}`,
    ...overrides,
  };
}

function okLowestBody(price = 710): string {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: '2026-08-27T00:00:00',
        trip: {
          price,
          tripCode: CORENDON_TRIP,
          tripUrlHash: `[filters]BEL/BRU.*.*.*.0|||${CORENDON_TRIP}|||true`,
          priceTableDate: '20260827',
          durationInDays: 5,
        },
      },
    },
  });
}

function okUpsalesBody(totalPrice: number, tablePp: number): string {
  return JSON.stringify({
    result: {
      extendedTripCode: CORENDON_TRIP,
      prices: {
        totalPrice,
        priceTableCalculatedPricePerPerson: tablePp,
      },
      selectedTripCudl: {
        selectedTrip: {
          system: { request: { departureDate: '2026-08-27' } },
        },
      },
    },
  });
}

function elizaPromotedBody(totalPrice: number, averagePrice: number): string {
  return JSON.stringify({
    accommodationId: 133863,
    duration: 8,
    price: { totalPrice, averagePrice, value: averagePrice, legend: 'Vanafprijs p.p.' },
    departureDate: { raw: '2026-11-19' },
    acmInformation: { mealplanCode: 'LG' },
  });
}

beforeEach(() => {
  clearPrijsvrijReceiptTokenCache();
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
});

test('A. proven live total is a presentable Result', () => {
  const offer = makeOffer({
    id: 'eliza-ok',
    provider: ELIZA_PROVIDER_NAME,
    price: 950,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 1901,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
  assert.equal(hasProvenLiveTotalPrice(offer), true);
  assert.equal(hasValidPresentablePrice(offer), true);
  assert.equal(isResultsVisibleOffer(offer), true);
  assert.deepEqual(filterToPresentableOffers([offer]).map((item) => item.id), ['eliza-ok']);
});

test('B. proven live p.p. without a proven live total is not a presentable Result', () => {
  const offer = makeOffer({
    id: 'eliza-pp-only',
    provider: ELIZA_PROVIDER_NAME,
    price: 950,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
  });
  assert.equal(hasProvenLiveDisplayPrice(offer), true);
  assert.equal(hasProvenLiveTotalPrice(offer), false);
  assert.equal(hasValidPresentablePrice(offer), false);
  assert.equal(isResultsVisibleOffer(offer), false);
});

test('C. feed price without a live total is not presentable', () => {
  const offer = makeOffer({
    id: 'sun-feed',
    provider: SUNWEB_PROVIDER_NAME,
    price: 400,
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    liveTotalPrice: 2000,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
  assert.equal(hasValidPresentablePrice(offer), false);
  assert.equal(isResultsVisibleOffer(offer), false);
});

test('D. search price without a live total is not presentable', () => {
  const offer = makeOffer({
    id: 'pv-search',
    provider: PRIJSVRIJ_PROVIDER_NAME,
    price: 477,
    livePriceStatus: 'proven',
    livePriceSource: 'search',
    liveTotalPrice: 954,
    liveTotalPriceField: 'receipt.TotalInclLocal',
  });
  assert.equal(hasValidPresentablePrice(offer), false);
  assert.equal(isResultsVisibleOffer(offer), false);
});

test('E. matrix-style leftover without a proven live total is not presentable', () => {
  const offer = makeOffer({
    id: 'pv-matrix',
    provider: PRIJSVRIJ_PROVIDER_NAME,
    price: 477,
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
  });
  assert.equal(hasProvenLiveTotalPrice(offer), false);
  assert.equal(hasValidPresentablePrice(offer), false);
});

test('F. lowest price without a proven live total is not presentable', () => {
  const offer = makeOffer({
    id: 'corendon-lowest',
    provider: 'Corendon',
    price: 876,
    livePriceStatus: 'proven',
    livePriceSource: 'lowestpricesacco',
  });
  assert.equal(hasProvenLiveDisplayPrice(offer), true);
  assert.equal(hasProvenLiveTotalPrice(offer), false);
  assert.equal(hasValidPresentablePrice(offer), false);
  assert.equal(isResultsVisibleOffer(offer), false);
});

test('G. Prijsvrij stays PARKED even with a Receipt total', () => {
  const offer = makeOffer({
    id: 'prijsvrij-receipt',
    provider: PRIJSVRIJ_PROVIDER_NAME,
    price: 477,
    livePriceStatus: 'proven',
    livePriceSource: 'receipt',
    liveTotalPrice: 952.99,
    liveTotalPriceField: 'receipt.TotalInclLocal',
  });
  assert.equal(isParkedResultsProvider(offer.provider), true);
  assert.deepEqual(excludeParkedResultsProviders([offer]), []);
});

test('H. Corendon upsales total can reach Results', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 })],
    TWO_ADULTS_ONE_CHILD,
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('lowestpricesacco')) {
          return new Response(okLowestBody(), { status: 200 });
        }
        if (url.includes('/upsales')) {
          return new Response(okUpsalesBody(1893, 626), { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );
  assert.equal(page.length, 1);
  assert.equal(page[0].livePriceSource, 'upsales');
  assert.equal(page[0].liveTotalPrice, 1893);
  assert.equal(hasValidPresentablePrice(page[0]), true);
});

test('H. Eliza and Sunweb proven totals can reach Results when the occupancy is live-priced', async () => {
  const eliza = makeOffer({
    id: 'eliza-133863',
    provider: ELIZA_PROVIDER_NAME,
    price: 599,
    departureDate: '2026-11-19',
    deepLink: ELIZA_PRODUCT_URL,
  });
  const sunweb = makeOffer({
    id: 'sunweb-84012',
    provider: SUNWEB_PROVIDER_NAME,
    price: 427,
    departureDate: '2026-09-26',
    deepLink: SUNWEB_PRODUCT_URL,
  });

  const [pricedEliza] = await priceLiveRequiredMatchset([eliza], { adults: 2 }, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('GetPromotedPriceApi')) {
        return new Response(elizaPromotedBody(1901, 950), { status: 200 });
      }
      if (url.includes('elizawashere.be')) {
        return new Response(ELIZA_LANDING_HTML, { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    },
  });
  assert.equal(pricedEliza.liveTotalPrice, 1901);
  assert.equal(hasValidPresentablePrice(pricedEliza), true);

  const [pricedSunweb] = await priceLiveRequiredMatchset([sunweb], FOUR_PAX_TWO_ROOMS, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('GetPromotedPriceApi')) {
        return new Response(okPromotedBody({ averagePrice: 418.5, totalPrice: 1674 }), { status: 200 });
      }
      if (url.includes('GetPricesGroupedByDurationApi')) {
        return new Response(echoGroupedPricesFromUrl(url), { status: 200 });
      }
      if (url.includes('sunweb.be')) {
        return new Response(SUNWEB_LANDING_HTML, { status: 200 });
      }
      throw new Error(`unexpected fetch ${url}`);
    },
  });
  assert.equal(pricedSunweb.liveTotalPrice, 1674);
  assert.equal(hasValidPresentablePrice(pricedSunweb), true);
});

test('I. the Results total gate does not add provider calls; Sunweb 2A stays off PromotedPrice', async () => {
  let promotedCalls = 0;
  let lowestCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({
        id: 'sunweb-84012',
        provider: SUNWEB_PROVIDER_NAME,
        deepLink: SUNWEB_PRODUCT_URL,
      }),
      makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
    ],
    { adults: 2 },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('GetPromotedPriceApi')) {
          promotedCalls += 1;
          throw new Error('Results 2A must not call Sunweb PromotedPrice');
        }
        if (url.includes('lowestpricesacco')) {
          lowestCalls += 1;
          return new Response(okLowestBody(), { status: 200 });
        }
        if (url.includes('/upsales')) {
          return new Response(okUpsalesBody(1424, 710), { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );

  assert.equal(promotedCalls, 0);
  assert.equal(lowestCalls, 1);
  assert.equal(page.some((offer) => offer.provider === SUNWEB_PROVIDER_NAME), false);
  assert.equal(page.some((offer) => offer.livePriceSource === 'lowestpricesacco'), false);
  const cor = page.find((offer) => offer.provider === 'Corendon');
  assert.ok(cor);
  assert.equal(cor.livePriceSource, 'upsales');
  assert.equal(hasValidPresentablePrice(cor), true);
});

test('Results → Detail keeps the same proven live total for a gated Result', async () => {
  const offer = makeOffer({
    id: 'eliza-133863',
    provider: ELIZA_PROVIDER_NAME,
    price: 599,
    departureDate: '2026-11-19',
    deepLink: ELIZA_PRODUCT_URL,
  });
  const params = { adults: 2 as const };
  let promotedCalls = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      promotedCalls += 1;
      return new Response(elizaPromotedBody(1901, 950), { status: 200 });
    }
    if (url.includes('elizawashere.be')) {
      return new Response(ELIZA_LANDING_HTML, { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const page = await pricePage1WithPrijsvrijReceipts([offer], params, { fetchImpl });
  assert.equal(page.length, 1);
  assert.equal(hasValidPresentablePrice(page[0]), true);
  assert.equal(page[0].liveTotalPrice, 1901);

  const detail = await priceOfferForDetail(offer, params, { fetchImpl });
  assert.equal(hasProvenLiveTotalPrice(detail), true);
  assert.equal(detail.liveTotalPrice, page[0].liveTotalPrice);
  assert.equal(detail.liveTotalPriceField, page[0].liveTotalPriceField);
  assert.equal(detail.price, page[0].price);
  assert.equal(promotedCalls, 1);
});
