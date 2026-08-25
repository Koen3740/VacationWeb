import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import {
  clearLivePriceInflightForTests,
  priceLiveRequiredMatchset,
} from '../providers/prijsvrij/page1-receipt-pricing';
import { computePrijsvrijReceiptPricePerPerson } from '../providers/prijsvrij/receipt-price';
import { clearPrijsvrijReceiptTokenCache } from '../providers/prijsvrij/receipt-auth';
import { SUNWEB_PRODUCT_URL } from '../providers/sunweb/offer-context.test';
import {
  echoGroupedPricesFromUrl,
  okPromotedBody,
  SUNWEB_LANDING_HTML,
} from '../providers/sunweb/promoted-price-client.test';
import {
  hasProvenLiveDisplayPrice,
  hasProvenLiveTotalPrice,
  hasValidPresentablePrice,
} from './presentable-price';
import { priceOfferForDetail } from './price-offer-for-detail';
import {
  clearResultsLivePriceCache,
  setResultsLivePriceOverlay,
} from './results-live-price-cache';

const CORENDON_FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
const CORENDON_TRIP = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU';

const TWO_ADULTS = {
  adults: 2,
  rooms: 1,
  party: [
    { dateOfBirth: '1980-03-12', roomIndex: 0 },
    { dateOfBirth: '1982-08-07', roomIndex: 0 },
  ],
};

const TWO_ADULTS_NO_DOB = {
  adults: 2,
  rooms: 1,
  party: [
    { dateOfBirth: null, roomIndex: 0 },
    { dateOfBirth: null, roomIndex: 0 },
  ],
};

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

beforeEach(() => {
  clearPrijsvrijReceiptTokenCache();
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
});

test('G. feed / search / lowest never count as a proven live total', () => {
  const feed = makeOffer({
    id: 'sunweb-feed',
    provider: 'Sunweb',
    price: 500,
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    liveTotalPrice: 2000,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
  assert.equal(hasProvenLiveTotalPrice(feed), false);

  const search = makeOffer({
    id: 'prijsvrij-search',
    provider: 'Prijsvrij',
    price: 485,
    livePriceStatus: 'proven',
    livePriceSource: 'search',
    liveTotalPrice: 970,
    liveTotalPriceField: 'receipt.TotalInclLocal',
  });
  assert.equal(hasProvenLiveTotalPrice(search), false);

  const lowest = makeOffer({
    id: 'corendon-lowest',
    provider: 'Corendon',
    price: 710,
    livePriceStatus: 'proven',
    livePriceSource: 'lowestpricesacco',
    liveTotalPrice: 1420,
    liveTotalPriceField: 'upsales.totalPrice',
  });
  assert.equal(hasProvenLiveDisplayPrice(lowest), true);
  assert.equal(hasProvenLiveTotalPrice(lowest), false);

  const derived = makeOffer({
    id: 'eliza-derived',
    provider: 'Eliza was here',
    price: 950,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 950 * 3,
    liveTotalPriceField: undefined,
  });
  assert.equal(hasProvenLiveTotalPrice(derived), false);
});

test('F. Prijsvrij TotalInclLocal is kept and is not ceil(pp) × pax', () => {
  const receipt = computePrijsvrijReceiptPricePerPerson({
    PriceInfo: { TotalInclLocal: { Value: 952.99 } },
    PaxDetails: { Adults: 2, Children: 0, Infants: 0 },
  });
  assert.ok(receipt);
  assert.equal(receipt.totalInclLocal, 952.99);
  assert.equal(receipt.pricePerPerson, 477);
  assert.notEqual(receipt.totalInclLocal, receipt.pricePerPerson * 2);

  const offer = makeOffer({
    id: 'prijsvrij-cached-total',
    provider: 'Prijsvrij',
    price: 400,
    deepLink: 'https://www.prijsvrij.be/hotel',
  });
  setResultsLivePriceOverlay(offer.id, { adults: 2 }, {
    price: 477,
    pricePerDay: 68,
    livePriceStatus: 'proven',
    livePriceSource: 'receipt',
    liveTotalPrice: 952.99,
    liveTotalPriceField: 'receipt.TotalInclLocal',
  });
  return priceOfferForDetail(offer, { adults: 2 }).then((priced) => {
    assert.equal(priced.price, 477);
    assert.equal(priced.liveTotalPrice, 952.99);
    assert.equal(priced.liveTotalPriceField, 'receipt.TotalInclLocal');
    assert.equal(hasProvenLiveTotalPrice(priced), true);
    assert.notEqual(priced.liveTotalPrice, priced.price * 2);
  });
});

test('E. Corendon 2A+1C keeps upsales totalPrice 1893, not table-pp × 3', async () => {
  let upsalesCalls = 0;
  const priced = await priceOfferForDetail(
    makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 696 }),
    TWO_ADULTS_ONE_CHILD,
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('lowestpricesacco')) {
          return new Response(okLowestBody(710), { status: 200 });
        }
        if (url.includes('/upsales')) {
          upsalesCalls += 1;
          return new Response(okUpsalesBody(1893, 626), { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );

  assert.equal(upsalesCalls, 1);
  assert.equal(priced.livePriceSource, 'upsales');
  assert.equal(priced.price, Math.round(1893 / 3));
  assert.notEqual(priced.price, 626);
  assert.equal(priced.liveTotalPrice, 1893);
  assert.equal(priced.liveTotalPriceField, 'upsales.totalPrice');
  assert.equal(hasProvenLiveTotalPrice(priced), true);
  assert.notEqual(priced.liveTotalPrice, 626 * 3);
  assert.notEqual(priced.liveTotalPrice, 710 * 3);
});

test('H. Corendon 2A+1C without party DOBs stays unpriced and has no total', async () => {
  const priced = await priceOfferForDetail(
    makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 696 }),
    { adults: 2, children: 1 },
    {
      fetchImpl: async () => {
        throw new Error('live HTTP must not run for unproven occupancy');
      },
    },
  );
  assert.equal(priced.livePriceStatus, 'unpriced');
  assert.equal(priced.liveTotalPrice, undefined);
  assert.equal(hasProvenLiveTotalPrice(priced), false);
});

test('A. Corendon 2A with homepage DOBs keeps upsales totalPrice 1424, not 710 × 2', async () => {
  let lowestCalls = 0;
  let upsalesCalls = 0;
  const priced = await priceOfferForDetail(
    makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
    TWO_ADULTS,
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('lowestpricesacco')) {
          lowestCalls += 1;
          return new Response(okLowestBody(710), { status: 200 });
        }
        if (url.includes('/upsales')) {
          upsalesCalls += 1;
          return new Response(okUpsalesBody(1424, 710), { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );

  assert.equal(lowestCalls, 1);
  assert.equal(upsalesCalls, 1);
  assert.equal(priced.livePriceSource, 'upsales');
  assert.equal(priced.price, Math.round(1424 / 2));
  assert.notEqual(priced.price, 710);
  assert.equal(priced.liveTotalPrice, 1424);
  assert.equal(priced.liveTotalPriceField, 'upsales.totalPrice');
  assert.equal(hasProvenLiveDisplayPrice(priced), true);
  assert.equal(hasProvenLiveTotalPrice(priced), true);
  assert.notEqual(priced.liveTotalPrice, 710 * 2);
});

test('B. Corendon 2A without DOBs uses adult-reference upsales and a proven provider total', async () => {
  let lowestCalls = 0;
  let upsalesCalls = 0;
  const priced = await priceOfferForDetail(
    makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
    TWO_ADULTS_NO_DOB,
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('lowestpricesacco')) {
          lowestCalls += 1;
          return new Response(okLowestBody(710), { status: 200 });
        }
        if (url.includes('/upsales')) {
          upsalesCalls += 1;
          const decoded = JSON.parse(
            Buffer.from(new URL(url).searchParams.get('input') ?? '', 'base64').toString('utf8'),
          ) as { pax: Array<{ birthDate: string }> };
          assert.deepEqual(decoded.pax.map((traveller) => traveller.birthDate), [
            '1986-01-01',
            '1986-01-01',
          ]);
          return new Response(okUpsalesBody(1424, 710), { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );
  assert.equal(lowestCalls, 1);
  assert.equal(upsalesCalls, 1);
  assert.equal(priced.livePriceSource, 'upsales');
  assert.equal(priced.price, Math.round(1424 / 2));
  assert.notEqual(priced.price, 710);
  assert.equal(priced.liveTotalPrice, 1424);
  assert.equal(priced.liveTotalPriceField, 'upsales.totalPrice');
  assert.equal(hasProvenLiveDisplayPrice(priced), true);
  assert.equal(hasProvenLiveTotalPrice(priced), true);
  assert.notEqual(priced.liveTotalPrice, 710 * 2);
});

test('Alaaddin BRU 17-11-2026: 807 is display-ignored; 1491 stays proven total', async () => {
  const offer = makeOffer({
    id: 'corendon-11721-BRUAYT-171126-7-DZH',
    provider: 'Corendon',
    hotelName: 'Fly & Go Alaaddin Beach Alanya',
    destinationCountry: 'Turkije',
    departureDate: '2026-11-17',
    nights: 7,
    price: 744,
    deepLink: 'https://www.corendon.be/vakantie#11721.ALABEF.BRUAYT.171126.7-8-7.DZ-H',
  });
  const tripCode =
    '11721.ALABEF.BRUAYT.171126.7-8-7.DZ-H.BRUAYT2K.AYTBRU2K.!ANCAR_H32_AYT!';
  const priced = await priceOfferForDetail(offer, TWO_ADULTS, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('lowestpricesacco')) {
        return new Response(
          JSON.stringify({
            package: {
              lowestPriceTrip: {
                tripDepartureDate: '2026-11-17T00:00:00',
                trip: {
                  price: 744,
                  tripCode,
                  tripUrlHash: `[filters]BEL/BRU.*.*.*.0|||${tripCode}|||true`,
                  priceTableDate: '20261117',
                  durationInDays: 8,
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
              extendedTripCode: tripCode,
              displayedPricePerPerson: null,
              priceTableCalculatedPricePerPerson: 807,
              priceTableCalculatedPrice: 1614,
              prices: {
                totalPrice: 1491,
                realTimeBlankPrice: 1491,
                displayedPricePerPerson: null,
              },
              selectedTripCudl: {
                selectedTrip: {
                  system: { request: { departureDate: '2026-11-17' } },
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

  assert.equal(priced.livePriceSource, 'upsales');
  assert.notEqual(priced.price, 807);
  assert.equal(priced.price, Math.round(1491 / 2));
  assert.equal(priced.liveTotalPrice, 1491);
  assert.equal(priced.liveTotalPriceField, 'upsales.totalPrice');
  assert.notEqual(priced.liveTotalPrice, 1614);
  assert.notEqual(priced.liveTotalPrice, 807 * 2);
  assert.notEqual(priced.liveTotalPrice, priced.price * 2);
  assert.equal(hasProvenLiveDisplayPrice(priced), true);
  assert.equal(hasProvenLiveTotalPrice(priced), true);
  assert.equal(hasValidPresentablePrice(priced), true);
});

test('G. Corendon 2A upsales cache hit does not repeat lowest or upsales', async () => {
  let lowestCalls = 0;
  let upsalesCalls = 0;
  const fetchImpl = async (input: Parameters<typeof fetch>[0]) => {
    const url = String(input);
    if (url.includes('lowestpricesacco')) {
      lowestCalls += 1;
      return new Response(okLowestBody(710), { status: 200 });
    }
    if (url.includes('/upsales')) {
      upsalesCalls += 1;
      return new Response(okUpsalesBody(1424, 710), { status: 200 });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const offer = makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 });
  const first = await priceOfferForDetail(offer, TWO_ADULTS, { fetchImpl });
  const second = await priceOfferForDetail(offer, TWO_ADULTS, { fetchImpl });
  assert.equal(first.liveTotalPrice, 1424);
  assert.equal(second.liveTotalPrice, 1424);
  assert.equal(second.livePriceSource, 'upsales');
  assert.equal(lowestCalls, 1);
  assert.equal(upsalesCalls, 1);
});

test('Corendon 2-room lowest keeps pp and does not invent a total', async () => {
  const priced = await priceOfferForDetail(
    makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
    { adults: 2, rooms: 2 },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('lowestpricesacco')) {
          return new Response(okLowestBody(876), { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );
  assert.equal(priced.livePriceSource, 'lowestpricesacco');
  assert.equal(priced.price, 876);
  assert.equal(priced.liveTotalPrice, undefined);
  assert.equal(hasProvenLiveTotalPrice(priced), false);
});

test('C. Sunweb 2A keeps PromotedPrice total 1010, not avg × 2', async () => {
  const priced = await priceOfferForDetail(
    makeOffer({
      id: 'sunweb-84012',
      provider: 'Sunweb',
      price: 427,
      departureDate: '2026-09-26',
      deepLink: SUNWEB_PRODUCT_URL,
    }),
    { adults: 2 },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('GetPromotedPriceApi')) {
          return new Response(
            okPromotedBody({ averagePrice: 505, totalPrice: 1010 }),
            { status: 200 },
          );
        }
        if (url.includes('GetPricesGroupedByDurationApi')) {
          return new Response(echoGroupedPricesFromUrl(url), { status: 200 });
        }
        if (url.includes('sunweb.be')) {
          return new Response(SUNWEB_LANDING_HTML, { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );

  assert.equal(priced.livePriceSource, 'getPromotedPrice');
  assert.equal(priced.price, 505);
  assert.equal(priced.liveTotalPrice, 1010);
  assert.equal(priced.liveTotalPriceField, 'getPromotedPrice.totalPrice');
  assert.equal(hasProvenLiveTotalPrice(priced), true);
  assert.notEqual(priced.liveTotalPrice, 427 * 2);
});

test('C. Sunweb 2A+child keeps PromotedPrice total 1407, not 2A avg × 3', async () => {
  const priced = await priceOfferForDetail(
    makeOffer({
      id: 'sunweb-84012',
      provider: 'Sunweb',
      price: 427,
      departureDate: '2026-09-26',
      deepLink: SUNWEB_PRODUCT_URL,
    }),
    TWO_ADULTS_ONE_CHILD,
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('GetPromotedPriceApi')) {
          assert.equal(new URL(url).searchParams.get('Participants[0][2]'), '2016-01-01');
          return new Response(
            okPromotedBody({ averagePrice: 469, totalPrice: 1407 }),
            { status: 200 },
          );
        }
        if (url.includes('GetPricesGroupedByDurationApi')) {
          return new Response(echoGroupedPricesFromUrl(url), { status: 200 });
        }
        if (url.includes('sunweb.be')) {
          return new Response(SUNWEB_LANDING_HTML, { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );

  assert.equal(priced.price, 469);
  assert.equal(priced.liveTotalPrice, 1407);
  assert.notEqual(priced.liveTotalPrice, 505 * 3);
  assert.equal(hasProvenLiveTotalPrice(priced), true);
});

test('D. Eliza 2A keeps PromotedPrice total 1901', async () => {
  const priced = await priceOfferForDetail(
    makeOffer({
      id: 'eliza-133863',
      provider: 'Eliza was here',
      price: 599,
      departureDate: '2026-11-19',
      deepLink: ELIZA_PRODUCT_URL,
    }),
    { adults: 2 },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('GetPromotedPriceApi')) {
          return new Response(
            JSON.stringify({
              accommodationId: 133863,
              duration: 8,
              price: { totalPrice: 1901, averagePrice: 950, value: 950, legend: 'Vanafprijs p.p.' },
              departureDate: { raw: '2026-11-19' },
              acmInformation: { mealplanCode: 'LG' },
            }),
            { status: 200 },
          );
        }
        if (url.includes('elizawashere.be')) {
          return new Response(ELIZA_LANDING_HTML, { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );

  assert.equal(priced.price, 950);
  assert.equal(priced.liveTotalPrice, 1901);
  assert.equal(priced.liveTotalPriceField, 'getPromotedPrice.totalPrice');
  assert.notEqual(priced.liveTotalPrice, priced.price * 2);
  assert.equal(hasProvenLiveTotalPrice(priced), true);
});

test('D. Eliza 2A+child keeps PromotedPrice total 2498, not 2A pp × 3', async () => {
  const priced = await priceOfferForDetail(
    makeOffer({
      id: 'eliza-133863',
      provider: 'Eliza was here',
      price: 599,
      departureDate: '2026-11-19',
      deepLink: ELIZA_PRODUCT_URL,
    }),
    TWO_ADULTS_ONE_CHILD,
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('GetPromotedPriceApi')) {
          assert.equal(new URL(url).searchParams.get('Participants[0][2]'), '2016-01-01');
          return new Response(
            JSON.stringify({
              accommodationId: 133863,
              duration: 8,
              price: { totalPrice: 2498, averagePrice: 833, value: 833, legend: 'Vanafprijs p.p.' },
              departureDate: { raw: '2026-11-19' },
              acmInformation: { mealplanCode: 'LG' },
            }),
            { status: 200 },
          );
        }
        if (url.includes('elizawashere.be')) {
          return new Response(ELIZA_LANDING_HTML, { status: 200 });
        }
        throw new Error(`unexpected fetch ${url}`);
      },
    },
  );

  assert.equal(priced.price, 833);
  assert.equal(priced.liveTotalPrice, 2498);
  assert.notEqual(priced.liveTotalPrice, 950 * 3);
  assert.equal(hasProvenLiveTotalPrice(priced), true);
});

test('Results matchset does not live-price Sunweb 2A (performance gate)', async () => {
  let promotedCalls = 0;
  await priceLiveRequiredMatchset(
    [
      makeOffer({
        id: 'sunweb-84012',
        provider: 'Sunweb',
        deepLink: SUNWEB_PRODUCT_URL,
      }),
      makeOffer({
        id: 'sunweb-84013',
        provider: 'Sunweb',
        deepLink: SUNWEB_PRODUCT_URL,
      }),
    ],
    { adults: 2 },
    {
      fetchImpl: async (input) => {
        if (String(input).includes('GetPromotedPriceApi')) {
          promotedCalls += 1;
        }
        throw new Error(`Results 2A must not call Sunweb live ${String(input)}`);
      },
    },
  );
  assert.equal(promotedCalls, 0);
});

test('H. unproven occupancy stays unpriced (Sunweb 3 adults, Eliza 2A+2C/1R)', async () => {
  const sunweb = await priceOfferForDetail(
    makeOffer({
      id: 'sunweb-84012',
      provider: 'Sunweb',
      deepLink: SUNWEB_PRODUCT_URL,
    }),
    { adults: 3 },
    {
      fetchImpl: async () => {
        throw new Error('Sunweb 3A must not call PromotedPrice');
      },
    },
  );
  assert.notEqual(sunweb.livePriceStatus, 'proven');
  assert.equal(hasProvenLiveTotalPrice(sunweb), false);

  const eliza = await priceOfferForDetail(
    makeOffer({
      id: 'eliza-133863',
      provider: 'Eliza was here',
      deepLink: ELIZA_PRODUCT_URL,
    }),
    { adults: 2, children: 2, rooms: 1 },
    {
      fetchImpl: async () => {
        throw new Error('Eliza 2A+2C/1R must not call PromotedPrice');
      },
    },
  );
  assert.equal(eliza.livePriceStatus, 'unpriced');
  assert.equal(hasProvenLiveTotalPrice(eliza), false);
});
