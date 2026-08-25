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
  type Page1ReceiptPricingStats,
} from '../prijsvrij/page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from '../prijsvrij/receipt-auth';
import { clearResultsLivePriceCache } from '../../search/results-live-price-cache';
import { hasValidPresentablePrice } from '../../search/presentable-price';

const FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';
const DIRECT_URL = `https://www.corendon.be/vakantie#${FRAGMENT}`;

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    departureDate: '2026-08-27',
    nights: 4,
    flightIncluded: 'true',
    price: 458,
    pricePerDay: 115,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: DIRECT_URL,
    ...overrides,
  };
}

function okLowestBody(price = 876): string {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: '2026-08-27T00:00:00',
        trip: {
          price,
          tripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
          tripUrlHash:
            '[filters]BEL/BRU.*.*.*.0|||9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU|||true',
          priceTableDate: '20260827',
          durationInDays: 5,
        },
      },
    },
  });
}

function okUpsalesBody(pricePerPerson = 600): string {
  return JSON.stringify({
    result: {
      extendedTripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
      prices: {
        totalPrice: pricePerPerson * 4,
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
  lowestStatus?: number;
  lowestBody?: string | null;
  upsalesStatus?: number;
  upsalesBody?: string | null;
  onLowest?: (url: string) => void;
  onUpsales?: (url: string) => void;
  onReceipt?: () => void;
}): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('lowestpricesacco')) {
      options.onLowest?.(url);
      const status = options.lowestStatus ?? 200;
      if (status === 204) {
        return new Response(null, { status: 204 });
      }
      return new Response(options.lowestBody ?? okLowestBody(), { status });
    }
    if (url.includes('/upsales')) {
      options.onUpsales?.(url);
      const status = options.upsalesStatus ?? 200;
      if (status === 204) {
        return new Response(null, { status: 204 });
      }
      return new Response(options.upsalesBody ?? okUpsalesBody(), { status });
    }
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 't'.repeat(40) }), { status: 200 });
    }
    options.onReceipt?.();
    return new Response(okReceiptBody(), { status: 200 });
  };
}

beforeEach(() => {
  clearPrijsvrijReceiptTokenCache();
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
});

test('page1: Corendon 2A with party ISO DOBs is presentable via upsales total', async () => {
  let lowestCalls = 0;
  let upsalesCalls = 0;
  const twoAdults = {
    adults: 2,
    rooms: 1,
    party: [
      { dateOfBirth: '1980-03-12', roomIndex: 0 },
      { dateOfBirth: '1982-08-07', roomIndex: 0 },
    ],
  };
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
      makeOffer({ id: 'sunweb-a', provider: 'Sunweb', price: 350, deepLink: 'https://example.com' }),
    ],
    twoAdults,
    {
      fetchImpl: makeLiveFetch({
        onLowest: () => {
          lowestCalls += 1;
        },
        onUpsales: () => {
          upsalesCalls += 1;
        },
        upsalesBody: JSON.stringify({
          result: {
            extendedTripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
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
      }),
    },
  );

  const cor = page.find((offer) => offer.provider === 'Corendon');
  assert.ok(cor);
  assert.equal(cor.livePriceSource, 'upsales');
  assert.equal(cor.price, Math.round(1424 / 2));
  assert.notEqual(cor.price, 710);
  assert.equal(cor.liveTotalPrice, 1424);
  assert.equal(hasValidPresentablePrice(cor), true);
  assert.equal(lowestCalls, 1);
  assert.equal(upsalesCalls, 1);
});

test('page1: Corendon 2A without DOB is presentable via adult-reference upsales total', async () => {
  let lowestCalls = 0;
  let upsalesCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
      makeOffer({ id: 'sunweb-a', provider: 'Sunweb', price: 350, deepLink: 'https://example.com' }),
    ],
    { adults: 2 },
    {
      fetchImpl: makeLiveFetch({
        onLowest: () => {
          lowestCalls += 1;
        },
        onUpsales: () => {
          upsalesCalls += 1;
        },
        upsalesBody: JSON.stringify({
          result: {
            extendedTripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
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
      }),
    },
  );

  const cor = page.find((offer) => offer.provider === 'Corendon');
  assert.ok(cor);
  assert.equal(cor.livePriceSource, 'upsales');
  assert.equal(cor.price, Math.round(1424 / 2));
  assert.notEqual(cor.price, 710);
  assert.equal(cor.liveTotalPrice, 1424);
  assert.equal(hasValidPresentablePrice(cor), true);
  assert.equal(lowestCalls, 1);
  assert.equal(upsalesCalls, 1);
  assert.notEqual(cor.liveTotalPrice, 710 * 2);
});

test('page1: lowest-only 2-room occupancy stays proven p.p. but not presentable', async () => {
  let lowestCalls = 0;
  let upsalesCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 })],
    { adults: 2, rooms: 2 },
    {
      fetchImpl: makeLiveFetch({
        onLowest: () => {
          lowestCalls += 1;
        },
        onUpsales: () => {
          upsalesCalls += 1;
        },
      }),
    },
  );

  assert.equal(page.find((offer) => offer.provider === 'Corendon'), undefined);
  assert.equal(lowestCalls, 1);
  assert.equal(upsalesCalls, 0);
  const [priced] = await priceLiveRequiredMatchset(
    [makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 })],
    { adults: 2, rooms: 2 },
    { fetchImpl: makeLiveFetch({}) },
  );
  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.livePriceSource, 'lowestpricesacco');
  assert.equal(priced.price, 876);
  assert.equal(hasValidPresentablePrice(priced), false);
});

test('page1: Corendon 204 does not present the offer and does not use feed as live', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 })],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({ lowestStatus: 204 }) },
  );

  assert.equal(page.length, 0);
  assert.ok(!page.some((offer) => offer.id === 'corendon-9514'));
});

test('page1: invalid occupancy does not call lowestpricesacco and is not shown', async () => {
  let lowestCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 })],
    { adults: 2, children: 1 },
    {
      fetchImpl: makeLiveFetch({
        onLowest: () => {
          lowestCalls += 1;
        },
      }),
    },
  );

  assert.equal(lowestCalls, 0);
  assert.equal(page.length, 0);
});

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

test('page1: 4 pax / 2 rooms uses proven upsales, not feed or 2A lowest €', async () => {
  let lowestCalls = 0;
  let upsalesCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
      makeOffer({ id: 'sunweb-a', provider: 'Sunweb', price: 350, deepLink: 'https://example.com' }),
    ],
    FOUR_PAX_TWO_ROOMS,
    {
      fetchImpl: makeLiveFetch({
        onLowest: () => {
          lowestCalls += 1;
        },
        onUpsales: () => {
          upsalesCalls += 1;
        },
      }),
    },
  );

  assert.equal(lowestCalls, 1);
  assert.equal(upsalesCalls, 1);
  const cor = page.find((offer) => offer.provider === 'Corendon');
  const sun = page.find((offer) => offer.provider === 'Sunweb');
  assert.ok(cor);
  assert.equal(cor.livePriceStatus, 'proven');
  assert.equal(cor.livePriceSource, 'upsales');
  assert.equal(cor.price, 600);
  assert.notEqual(cor.price, 458);
  assert.notEqual(cor.price, 876);
  assert.equal(hasValidPresentablePrice(cor), true);
  assert.equal(sun, undefined);
});

test('page1: missing fragment does not invent a live price', async () => {
  let lowestCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({
        id: 'corendon-9514',
        provider: 'Corendon',
        price: 458,
        deepLink: 'https://www.corendon.be/vakantie',
      }),
    ],
    { adults: 2 },
    {
      fetchImpl: makeLiveFetch({
        onLowest: () => {
          lowestCalls += 1;
        },
      }),
    },
  );

  assert.equal(lowestCalls, 0);
  assert.equal(page.length, 0);
});

test('stream: occupancy outside live route is not selected onto Results', async () => {
  const stream = startPage1ReceiptStream(
    [
      makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
      makeOffer({ id: 'sunweb-a', provider: 'Sunweb', deepLink: 'https://example.com' }),
    ],
    { adults: 2, children: 1 },
    { fetchImpl: makeLiveFetch({}) },
  );

  const pending = stream.slots.filter((slot) => slot.kind === 'pending');
  const immediate = stream.slots.filter((slot) => slot.kind === 'immediate');
  assert.equal(pending.length, 0);
  assert.equal(immediate.length, 0);
  const presented = await stream.presented;
  assert.equal(presented.page1.length, 0);
});

test('stream: valid Corendon is pending; invalid Corendon is not a visible card', async () => {
  const stream = startPage1ReceiptStream(
    [
      makeOffer({ id: 'corendon-9514', provider: 'Corendon' }),
      makeOffer({
        id: 'corendon-1',
        provider: 'Corendon',
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
  const invalidCorendon = immediate.find(
    (slot) => slot.kind === 'immediate' && slot.offer.id === 'corendon-1',
  );
  assert.ok(invalidCorendon);
  assert.equal(invalidCorendon.offer.livePriceStatus, 'unavailable');

  const priced = await pending[0].offer;
  assert.ok(priced);
  assert.equal(priced.livePriceStatus, 'proven');
  assert.equal(priced.livePriceSource, 'upsales');
  const presented = await stream.presented;
  assert.ok(presented.page1.every((offer) => offer.id !== 'sunweb-a'));
  assert.ok(!presented.page1.some((offer) => offer.livePriceSource === 'lowestpricesacco'));
});

test('stream: Corendon failure does not present the card or use Search/feed as live', async () => {
  const stream = startPage1ReceiptStream(
    [makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 })],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({ lowestStatus: 500 }) },
  );

  const corSlot = stream.slots.find((slot) => slot.kind === 'pending');
  assert.ok(corSlot && corSlot.kind === 'pending');
  const priced = await corSlot.offer;
  assert.equal(priced, null);

  const presented = await stream.presented;
  assert.ok(!presented.page1.some((offer) => offer.id === 'corendon-9514'));
  assert.ok(presented.page1.every((offer) => offer.livePriceSource !== 'search'));
  assert.ok(presented.page1.every((offer) => offer.livePriceSource !== 'feed' || offer.provider !== 'Corendon'));
});

test('page1: live-capable Corendon is priced on page 1 when Sunweb 2A cannot fill slots', async () => {
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
    makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
  ];

  let lowestCalls = 0;
  const fetchImpl = makeLiveFetch({
    onLowest: () => {
      lowestCalls += 1;
    },
  });

  const page1 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1 },
    { fetchImpl, pageSize: 10 },
  );
  assert.equal(lowestCalls, 1);
  const cor = page1.visibleOffers.find((offer) => offer.provider === 'Corendon');
  assert.ok(cor);
  assert.equal(cor.livePriceSource, 'upsales');
  assert.equal(hasValidPresentablePrice(cor), true);
  assert.equal(page1.visibleOffers.some((offer) => offer.provider === 'Sunweb'), false);
});

test('Package-1 invariants still hold with a live Corendon slot', async () => {
  clearPrijsvrijReceiptTokenCache();
  const stats: Page1ReceiptPricingStats = {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
  };
  let receiptCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({ id: 'corendon-9514', provider: 'Corendon' }),
      ...Array.from({ length: 5 }, (_, i) =>
        makeOffer({
          id: `prijsvrij-${100 + i}-x`,
          provider: PRIJSVRIJ_PROVIDER_NAME,
          deepLink:
            'https://www.prijsvrij.be/vakantie/?r=https%3A%2F%2Fwww.prijsvrij.be%2Fvakanties%2Fspanje%3Fvertrekdatum%3D2026-09-30%26reisduurdagen%3D8%26transport%3Dvl',
        }),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        makeOffer({
          id: `sunweb-${i}`,
          provider: 'Sunweb',
          deepLink: 'https://example.com',
        }),
      ),
    ],
    { adults: 2 },
    {
      fetchImpl: makeLiveFetch({
        onReceipt: () => {
          receiptCalls += 1;
        },
      }),
      stats,
      pageSize: 10,
    },
  );

  assert.ok(page.every((offer) => offer.livePriceStatus === 'proven'));
  assert.ok(page.some((offer) => offer.provider === 'Corendon' && offer.livePriceSource === 'upsales'));
  assert.ok(!page.some((offer) => offer.provider === 'Sunweb'));
  assert.ok(page.filter((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME).length <= 5);
  assert.ok(stats.receiptCalls <= 10);
  assert.equal(stats.receiptCalls + (stats.matchsetReceiptCalls ?? 0), receiptCalls);
});

test('mark page2 helper hides Corendon catalog as live', () => {
  const marked = markPrijsvrijLivePriceUnavailable([
    makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
  ]);
  assert.equal(marked[0].livePriceStatus, 'unavailable');
  assert.equal(marked[0].livePriceSource, undefined);
});

const TWO_ADULTS_ISO = {
  adults: 2,
  children: 0,
  babies: 0,
  rooms: 1,
  party: [
    { dateOfBirth: '1980-03-12', roomIndex: 0 },
    { dateOfBirth: '1982-08-07', roomIndex: 0 },
  ],
};

function makeNumberedCorendon(accommodationId: number): TravelOffer {
  return makeOffer({
    id: `corendon-${accommodationId}`,
    provider: 'Corendon',
    deepLink: `https://www.corendon.be/vakantie#${accommodationId}.COSPY.BRUCFU.270826.3-4-3.SZ-U`,
  });
}

function accommodationIdFromUrl(url: string): string | null {
  return new URL(url).searchParams.get('accommodationId');
}

test('page1: next Corendon candidate is priced when earlier slots have no proven total', async () => {
  const pricedIds = new Set<string>();
  const offers = Array.from({ length: 11 }, (_, index) => makeNumberedCorendon(9514 + index));
  const page = await pricePage1WithPrijsvrijReceipts(offers, TWO_ADULTS_ISO, {
    pageSize: 10,
    fetchImpl: async (input) => {
      const url = String(input);
      const accommodationId = accommodationIdFromUrl(url);
      if (url.includes('lowestpricesacco')) {
        if (accommodationId) {
          pricedIds.add(accommodationId);
        }
        if (accommodationId && Number(accommodationId) <= 9523) {
          return new Response(null, { status: 204 });
        }
        return new Response(okLowestBody(), { status: 200 });
      }
      if (url.includes('/upsales')) {
        return new Response(
          JSON.stringify({
            result: {
              extendedTripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
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
      throw new Error(`unexpected url ${url}`);
    },
  });

  assert.equal(page.length, 1);
  assert.equal(page[0].id, 'corendon-9524');
  assert.equal(hasValidPresentablePrice(page[0]), true);
  assert.equal(page[0].liveTotalPrice, 1424);
  assert.notEqual(page[0].liveTotalPrice, 710 * 2);
  assert.ok(pricedIds.has('9514'));
  assert.ok(pricedIds.has('9524'));
});

test('page1: 2A without DOB walks extra Corendon candidates when earlier slots have no total', async () => {
  const pricedIds = new Set<string>();
  const offers = Array.from({ length: 11 }, (_, index) => makeNumberedCorendon(9514 + index));
  const page = await pricePage1WithPrijsvrijReceipts(offers, {
    adults: 2,
    children: 0,
    babies: 0,
    rooms: 1,
  }, {
    pageSize: 10,
    fetchImpl: async (input) => {
      const url = String(input);
      const accommodationId = accommodationIdFromUrl(url);
      if (url.includes('lowestpricesacco')) {
        if (accommodationId) {
          pricedIds.add(accommodationId);
        }
        if (accommodationId && Number(accommodationId) <= 9523) {
          return new Response(null, { status: 204 });
        }
        return new Response(okLowestBody(), { status: 200 });
      }
      if (url.includes('/upsales')) {
        return new Response(
          JSON.stringify({
            result: {
              extendedTripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
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
      throw new Error(`unexpected url ${url}`);
    },
  });

  assert.equal(page.length, 1);
  assert.equal(page[0].id, 'corendon-9524');
  assert.equal(hasValidPresentablePrice(page[0]), true);
  assert.equal(page[0].livePriceSource, 'upsales');
  assert.equal(page[0].liveTotalPrice, 1424);
  assert.ok(pricedIds.has('9514'));
  assert.ok(pricedIds.has('9524'));
});

test('page1: later failed Corendon slots do not drop already proven cards', async () => {
  const offers = Array.from({ length: 12 }, (_, index) => makeNumberedCorendon(9514 + index));
  const page = await pricePage1WithPrijsvrijReceipts(offers, { adults: 2 }, {
    pageSize: 10,
    fetchImpl: async (input) => {
      const url = String(input);
      const accommodationId = accommodationIdFromUrl(url);
      if (url.includes('lowestpricesacco')) {
        if (accommodationId === '9514' || accommodationId === '9515') {
          return new Response(okLowestBody(), { status: 200 });
        }
        return new Response(null, { status: 204 });
      }
      if (url.includes('/upsales')) {
        return new Response(
          JSON.stringify({
            result: {
              extendedTripCode: '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U.BRUCFU4C.CFU',
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
      throw new Error(`unexpected url ${url}`);
    },
  });

  assert.equal(page.length, 2);
  assert.deepEqual(
    page.map((offer) => offer.id).sort(),
    ['corendon-9514', 'corendon-9515'],
  );
  assert.ok(page.every((offer) => hasValidPresentablePrice(offer)));
});

test('page1: 2A + child without DOB does not use the adult reference fallback', async () => {
  let lowestCalls = 0;
  let upsalesCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 })],
    { adults: 2, children: 1, babies: 0, rooms: 1 },
    {
      fetchImpl: makeLiveFetch({
        onLowest: () => {
          lowestCalls += 1;
        },
        onUpsales: () => {
          upsalesCalls += 1;
        },
      }),
    },
  );

  assert.equal(lowestCalls, 0);
  assert.equal(upsalesCalls, 0);
  assert.equal(page.length, 0);
});
