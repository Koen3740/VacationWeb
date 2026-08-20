import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import { PRIJSVRIJ_PROVIDER_NAME } from './constants';
import {
  priceLiveRequiredMatchset,
  resolveResultsPageSlice,
  selectPage1Candidates,
  startPage1ReceiptStream,
  clearLivePriceInflightForTests,
  type Page1ReceiptPricingStats,
} from './page1-receipt-pricing';
import { getResultsTotalPages, paginateResults } from '../../search/pagination';
import { filterToPresentableOffers } from '../../search/presentable-price';
import { clearResultsLivePriceCache } from '../../search/results-live-price-cache';
import { clearPrijsvrijReceiptTokenCache } from './receipt-auth';

function emptyStats(): Page1ReceiptPricingStats {
  return {
    receiptCalls: 0,
    receiptSuccesses: 0,
    receiptFailures: 0,
    prijsvrijSlotsFilled: 0,
    stoppedEarlyBecauseEnoughPv: false,
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

function makeOffer(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id' | 'provider'>,
): TravelOffer {
  return {
    hotelName: 'Test Hotel',
    destinationCountry: 'Spanje',
    destinationRegion: 'Mallorca',
    departureDate: '2026-09-30',
    nights: 8,
    flightIncluded: 'true',
    price: 472,
    pricePerDay: 59,
    imageUrl: 'https://example.com/a.jpg',
    deepLink:
      'https://www.prijsvrij.be/vakantie/?r=https%3A%2F%2Fwww.prijsvrij.be%2Fvakanties%2Fspanje%2Fmallorca%2Fporto-cristo%2Fportodrach%3Fvertrekdatum%3D2026-09-30%26reisduurdagen%3D8%26transport%3Dvl',
    ...overrides,
  };
}

function makePvOffers(count: number, priceStart = 100): TravelOffer[] {
  return Array.from({ length: count }, (_, index) =>
    makeOffer({
      id: `prijsvrij-${1000 + index}-x`,
      provider: PRIJSVRIJ_PROVIDER_NAME,
      price: priceStart + index,
    }),
  );
}

function makeReceiptFetch(options: {
  failHotelIds?: Set<string>;
  onReceipt?: () => void;
} = {}): typeof fetch {
  const fail = options.failHotelIds ?? new Set<string>();
  return async (input) => {
    const url = String(input);
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 'm'.repeat(40) }), { status: 200 });
    }
    options.onReceipt?.();
    const hotelMatch = /\/(\d+)\/receipt\//.exec(url);
    const hotelId = hotelMatch?.[1] ?? '';
    if (fail.has(hotelId)) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(okReceiptBody(800 + Number(hotelId || '0')), { status: 200 });
  };
}

beforeEach(() => {
  clearPrijsvrijReceiptTokenCache();
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
});

test('E. 60 Prijsvrij: all 60 live-priced; page 1 max 10; page 2+ 10; no max-3 on page 2+', async () => {
  const offers = makePvOffers(60);
  let receiptPosts = 0;
  const stats = emptyStats();
  const fetchImpl = makeReceiptFetch({ onReceipt: () => { receiptPosts += 1; } });
  const page1 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1 },
    { fetchImpl, stats },
  );

  assert.ok(page1.visibleOffers.length <= 10);
  assert.ok(stats.receiptCalls <= 10);
  assert.equal(stats.matchsetReceiptCalls ?? 0, 0);
  assert.ok(page1.visibleOffers.every((offer) => offer.livePriceSource === 'receipt'));

  await priceLiveRequiredMatchset(offers, { adults: 2 }, { fetchImpl, stats });
  assert.equal(receiptPosts, 60);
  assert.equal((stats.matchsetReceiptCalls ?? 0) + stats.receiptCalls, 60);

  const page1After = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1, page1Ids: page1.page1Ids },
    { fetchImpl },
  );
  assert.equal(page1After.paginationTotal, 60);
  assert.equal(getResultsTotalPages(page1After.paginationTotal, 10), 6);

  const page2 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 2, page1Ids: page1.page1Ids },
    { fetchImpl: makeReceiptFetch({ onReceipt: () => { receiptPosts += 1; } }) },
  );
  assert.equal(receiptPosts, 60, 'page 2 must use cache, not extra Receipts');
  assert.equal(page2.visibleOffers.length, 10);
  assert.equal(page2.visibleOffers.filter((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME).length, 10);
  assert.ok(page2.visibleOffers.every((offer) => offer.livePriceSource === 'receipt'));
  assert.ok(page2.visibleOffers.every((offer) => !(page1.page1Ids ?? []).includes(offer.id)));
});

test('F. 34 Prijsvrij paginate 10/10/10/4', async () => {
  const offers = makePvOffers(34);
  const fetchImpl = makeReceiptFetch();
  const page1 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1 },
    { fetchImpl },
  );
  assert.equal(page1.visibleOffers.length, 10);
  await priceLiveRequiredMatchset(offers, { adults: 2 }, { fetchImpl });
  const page1After = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1, page1Ids: page1.page1Ids },
    { fetchImpl },
  );
  assert.equal(page1After.paginationTotal, 34);
  assert.equal(getResultsTotalPages(page1After.paginationTotal, 10), 4);

  const lengths: number[] = [page1.visibleOffers.length];
  for (const page of [2, 3, 4]) {
    const slice = await resolveResultsPageSlice(
      offers,
      { adults: 2, page, page1Ids: page1.page1Ids },
      { fetchImpl: makeReceiptFetch() },
    );
    lengths.push(slice.visibleOffers.length);
    assert.ok(slice.visibleOffers.every((offer) => offer.livePriceSource === 'receipt'));
  }
  assert.deepEqual(lengths, [10, 10, 10, 4]);
});

test('G. 11 Prijsvrij paginate 10/1', async () => {
  const offers = makePvOffers(11);
  const fetchImpl = makeReceiptFetch();
  const page1 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1 },
    { fetchImpl },
  );
  await priceLiveRequiredMatchset(offers, { adults: 2 }, { fetchImpl });
  const page1After = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1, page1Ids: page1.page1Ids },
    { fetchImpl },
  );
  const page2 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 2, page1Ids: page1.page1Ids },
    { fetchImpl: makeReceiptFetch() },
  );
  assert.equal(page1.visibleOffers.length, 10);
  assert.equal(page2.visibleOffers.length, 1);
  assert.equal(page1After.paginationTotal, 11);
  assert.equal(getResultsTotalPages(page1After.paginationTotal, 10), 2);
});

test('H. 6 Prijsvrij stay on one page', async () => {
  const offers = makePvOffers(6);
  const fetchImpl = makeReceiptFetch();
  const page1 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1 },
    { fetchImpl },
  );
  await priceLiveRequiredMatchset(offers, { adults: 2 }, { fetchImpl });
  const page1After = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1, page1Ids: page1.page1Ids },
    { fetchImpl },
  );
  const page2 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 2, page1Ids: page1.page1Ids },
    { fetchImpl: makeReceiptFetch() },
  );
  assert.equal(page1.visibleOffers.length, 6);
  assert.equal(page2.visibleOffers.length, 0);
  assert.equal(page1After.paginationTotal, 6);
  assert.equal(getResultsTotalPages(page1After.paginationTotal, 10), 1);
});

test('I. first new page 1 keeps max-3 Prijsvrij when alternatives exist', async () => {
  const offers = [
    ...makePvOffers(8),
    ...Array.from({ length: 12 }, (_, index) =>
      makeOffer({
        id: `sunweb-${index}`,
        provider: 'Sunweb',
        price: 200 + index,
        livePriceStatus: 'catalog',
        livePriceSource: 'feed',
      }),
    ),
  ];
  const selected = selectPage1Candidates(offers, 10, 3).selected;
  assert.equal(selected.filter((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME).length, 3);

  const page1 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1 },
    { fetchImpl: makeReceiptFetch() },
  );
  assert.equal(page1.visibleOffers.filter((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME).length, 8);
  assert.ok(page1.visibleOffers.length <= 10);
  assert.ok(!page1.visibleOffers.some((offer) => offer.provider === 'Sunweb'));
});

test('J. subsequent search with page1Ids does not re-apply max-3 as a pagination rule', async () => {
  const offers = makePvOffers(60);
  const fetchImpl = makeReceiptFetch();
  await priceLiveRequiredMatchset(offers, { adults: 2 }, { fetchImpl });
  const page1 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1, page1Ids: ['prijsvrij-1000-x'] },
    { fetchImpl: makeReceiptFetch() },
  );
  assert.equal(page1.visibleOffers.length, 10);
  assert.equal(page1.visibleOffers.filter((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME).length, 10);
  assert.equal(page1.paginationTotal, 60);

  const page2 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 2, page1Ids: page1.page1Ids },
    { fetchImpl: makeReceiptFetch() },
  );
  assert.equal(page2.visibleOffers.length, 10);
  assert.equal(page2.visibleOffers.filter((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME).length, 10);
});

test('K. page1Ids remove only actually presented page-1 IDs from remaining', async () => {
  const offers = [
    ...makePvOffers(6),
    ...Array.from({ length: 12 }, (_, index) =>
      makeOffer({
        id: `sunweb-${index}`,
        provider: 'Sunweb',
        price: 300 + index,
        livePriceStatus: 'catalog',
        livePriceSource: 'feed',
      }),
    ),
  ];
  const presented = await startPage1ReceiptStream(offers, { adults: 2 }, {
    fetchImpl: makeReceiptFetch(),
  }).presented;
  assert.deepEqual(presented.page1Ids, presented.page1.map((offer) => offer.id));
  assert.ok(presented.remaining.every((offer) => !presented.page1Ids.includes(offer.id)));
  assert.equal(presented.page1.length + presented.remaining.length, offers.length);
});

test('L. live failures do not empty later pages while valid results remain', async () => {
  const offers = makePvOffers(12);
  const fail = new Set(['1000', '1001', '1002']);
  const fetchImpl = makeReceiptFetch({ failHotelIds: fail });
  const page1 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1 },
    { fetchImpl },
  );
  await priceLiveRequiredMatchset(offers, { adults: 2 }, { fetchImpl });
  const after = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1, page1Ids: page1.page1Ids },
    { fetchImpl },
  );
  const presentable = filterToPresentableOffers([
    ...after.visibleOffers,
    ...after.remaining,
  ]);
  assert.equal(presentable.length, 9);
  assert.equal(after.paginationTotal, 9);
  assert.ok(after.visibleOffers.length > 0);
  assert.ok(after.visibleOffers.length <= 10);

  const page2 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 2, page1Ids: after.page1Ids },
    { fetchImpl: makeReceiptFetch({ failHotelIds: fail }) },
  );
  const remainingPresentable = after.paginationTotal - after.visibleOffers.length;
  if (remainingPresentable > 0) {
    assert.ok(page2.visibleOffers.length > 0);
    assert.equal(page2.visibleOffers.length, Math.min(10, remainingPresentable));
  }
  assert.ok(page2.visibleOffers.every((offer) => offer.livePriceStatus === 'proven'));
});

test('L. limited page-1 slot filling must not hide unpriced remaining Prijsvrij', async () => {
  const offers = makePvOffers(20);
  let receiptPosts = 0;
  const priced = await priceLiveRequiredMatchset(
    offers,
    { adults: 2 },
    { fetchImpl: makeReceiptFetch({ onReceipt: () => { receiptPosts += 1; } }) },
  );
  assert.equal(receiptPosts, 20);
  assert.equal(priced.filter((offer) => offer.livePriceSource === 'receipt').length, 20);
});

test('observed empty-page sizes 60/59/34/30/11/6 keep filled pages', async () => {
  for (const count of [60, 59, 34, 30, 11, 6]) {
    clearResultsLivePriceCache();
    clearPrijsvrijReceiptTokenCache();
    const offers = makePvOffers(count);
    const fetchImpl = makeReceiptFetch();
    const page1 = await resolveResultsPageSlice(
      offers,
      { adults: 2, page: 1 },
      { fetchImpl },
    );
    await priceLiveRequiredMatchset(offers, { adults: 2 }, { fetchImpl });
    const page1After = await resolveResultsPageSlice(
      offers,
      { adults: 2, page: 1, page1Ids: page1.page1Ids },
      { fetchImpl },
    );
    assert.equal(page1After.paginationTotal, count, `${count} matches should all be presentable`);
    const pages = getResultsTotalPages(page1After.paginationTotal, 10);
    assert.equal(pages, Math.ceil(count / 10));
    for (let page = 1; page <= pages; page += 1) {
      const slice = await resolveResultsPageSlice(
        offers,
        { adults: 2, page, page1Ids: page === 1 ? undefined : page1.page1Ids },
        { fetchImpl: makeReceiptFetch() },
      );
      const expected = page === pages ? count - (pages - 1) * 10 : 10;
      if (page === 1) {
        assert.equal(slice.visibleOffers.length, Math.min(10, count));
      } else {
        assert.equal(slice.visibleOffers.length, expected, `${count} matches page ${page}`);
      }
    }
  }
});

test('M. catalog Sunweb does not fill the 150-cap; only proven live prices paginate', async () => {
  const offers = [
    ...makePvOffers(20),
    ...Array.from({ length: 200 }, (_, index) =>
      makeOffer({
        id: `sunweb-${index}`,
        provider: 'Sunweb',
        price: 50 + index,
        livePriceStatus: 'catalog',
        livePriceSource: 'feed',
      }),
    ),
  ];
  const fetchImpl = makeReceiptFetch();
  const page1 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1 },
    { fetchImpl },
  );
  await priceLiveRequiredMatchset(offers, { adults: 2 }, { fetchImpl });
  const page1After = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1, page1Ids: page1.page1Ids },
    { fetchImpl },
  );
  assert.equal(page1After.paginationTotal, 20);
  assert.equal(getResultsTotalPages(page1After.paginationTotal, 10), 2);

  const page2 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 2, page1Ids: page1.page1Ids },
    { fetchImpl: makeReceiptFetch() },
  );
  assert.equal(page2.visibleOffers.length, 10);
  const page3 = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 3, page1Ids: page1.page1Ids },
    { fetchImpl: makeReceiptFetch() },
  );
  assert.equal(page3.visibleOffers.length, 0);
});
