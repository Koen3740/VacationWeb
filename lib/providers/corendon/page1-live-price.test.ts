import assert from 'node:assert/strict';
import test from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import { PRIJSVRIJ_PROVIDER_NAME } from '../prijsvrij/constants';
import {
  markPrijsvrijLivePriceUnavailable,
  pricePage1WithPrijsvrijReceipts,
  resolveResultsPageSlice,
  startPage1ReceiptStream,
  type Page1ReceiptPricingStats,
} from '../prijsvrij/page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from '../prijsvrij/receipt-auth';

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
  onLowest?: (url: string) => void;
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
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 't'.repeat(40) }), { status: 200 });
    }
    options.onReceipt?.();
    return new Response(okReceiptBody(), { status: 200 });
  };
}

test('page1: Corendon success is proven lowestpricesacco, not feed price', async () => {
  let lowestCalls = 0;
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
      }),
    },
  );

  const cor = page.find((offer) => offer.provider === 'Corendon');
  assert.ok(cor);
  assert.equal(lowestCalls, 1);
  assert.equal(cor.livePriceStatus, 'proven');
  assert.equal(cor.livePriceSource, 'lowestpricesacco');
  assert.equal(cor.price, 876);
  assert.notEqual(cor.price, 458);
  assert.equal(cor.nights, 4);
  assert.equal(cor.id, 'corendon-9514');
});

test('page1: Corendon 204 keeps card and does not use feed as live', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 })],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({ lowestStatus: 204 }) },
  );

  assert.equal(page.length, 1);
  assert.equal(page[0].id, 'corendon-9514');
  assert.equal(page[0].livePriceStatus, 'unavailable');
  assert.equal(page[0].livePriceSource, undefined);
  assert.equal(page[0].price, 458);
});

test('page1: invalid occupancy does not call lowestpricesacco', async () => {
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
  assert.equal(page[0].livePriceStatus, 'unavailable');
  assert.notEqual(page[0].livePriceSource, 'lowestpricesacco');
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
  assert.equal(page[0].livePriceStatus, 'unavailable');
  assert.equal(page[0].price, 458);
});

test('stream: valid Corendon is pending; invalid Corendon is immediate unavailable', async () => {
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
  assert.equal(immediate[0].kind, 'immediate');
  if (immediate[0].kind === 'immediate') {
    assert.equal(immediate[0].offer.id, 'corendon-1');
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
  assert.equal(priced.livePriceSource, 'lowestpricesacco');
});

test('stream: Corendon failure does not compact the slot or use Search/feed as live', async () => {
  const stream = startPage1ReceiptStream(
    [
      makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
      makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME }),
    ],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({ lowestStatus: 500 }) },
  );

  const corSlot = stream.slots.find((slot) => slot.kind === 'pending' && slot.selectedIndex === 0);
  assert.ok(corSlot && corSlot.kind === 'pending');
  const priced = await corSlot.offer;
  assert.ok(priced);
  assert.equal(priced.id, 'corendon-9514');
  assert.equal(priced.livePriceStatus, 'unavailable');
  assert.notEqual(priced.livePriceSource, 'lowestpricesacco');
  assert.notEqual(priced.livePriceSource, 'search');
  assert.notEqual(priced.livePriceSource, 'receipt');

  const presented = await stream.presented;
  assert.ok(presented.page1.some((offer) => offer.id === 'corendon-9514'));
});

test('page2+: Corendon is unavailable and does 0 lowestpricesacco calls', async () => {
  clearPrijsvrijReceiptTokenCache();
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
  assert.equal(lowestCalls, 0);
  assert.ok(page1.page1Ids);

  lowestCalls = 0;
  const page2 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 2, page1Ids: page1.page1Ids },
    { fetchImpl, pageSize: 10 },
  );
  assert.equal(lowestCalls, 0);
  const cor = page2.visibleOffers.find((offer) => offer.provider === 'Corendon');
  assert.ok(cor);
  assert.equal(cor.livePriceStatus, 'unavailable');
  assert.notEqual(cor.livePriceSource, 'lowestpricesacco');
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

  assert.equal(page.length, 10);
  assert.ok(page.filter((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME).length <= 3);
  assert.ok(stats.receiptCalls <= 10);
  assert.equal(stats.receiptCalls, receiptCalls);
  const cor = page.find((offer) => offer.provider === 'Corendon');
  assert.ok(cor);
  assert.equal(cor.livePriceSource, 'lowestpricesacco');
});

test('mark page2 helper hides Corendon catalog as live', () => {
  const marked = markPrijsvrijLivePriceUnavailable([
    makeOffer({ id: 'corendon-9514', provider: 'Corendon', price: 458 }),
  ]);
  assert.equal(marked[0].livePriceStatus, 'unavailable');
  assert.equal(marked[0].livePriceSource, undefined);
});
