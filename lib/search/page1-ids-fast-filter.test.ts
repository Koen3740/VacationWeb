import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import type { TravelOffer } from '../../types/travel';
import type { SearchParams } from '../../types/travel';
import { filterOffers, sortOffers } from './filtering';
import { applyFilterNavigationPaging } from './filter-navigation';
import { shouldPreservePage1Ids } from './filter-classification';
import {
  buildOfferDetailHref,
  buildResultsPageHref,
  paginateResults,
} from './pagination';
import {
  clearLivePriceInflightForTests,
  resolveResultsPageSlice,
  tryCatalogRefinePage1,
} from '../providers/prijsvrij/page1-receipt-pricing';
import { clearPrijsvrijReceiptTokenCache } from '../providers/prijsvrij/receipt-auth';
import { clearResultsLivePriceCache } from './results-live-price-cache';
import { hasValidPresentablePrice } from './presentable-price';

const CORENDON_HOTEL_IDS = [9514, 9515, 9516, 9517, 9518, 9519, 9520, 9521, 9522, 9523] as const;

const FOUR_PAX_TWO_ROOMS: Pick<SearchParams, 'adults' | 'children' | 'rooms' | 'party'> = {
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

function withLiveTotalOccupancy(params: SearchParams): SearchParams {
  return { ...params, ...FOUR_PAX_TWO_ROOMS, page: params.page, page1Ids: params.page1Ids };
}

function corendonDeepLink(hotelId: number): string {
  return `https://www.corendon.be/vakantie#${hotelId}.COSPY.BRUCFU.270826.3-4-3.SZ-U`;
}

function makeSunweb(
  overrides: Partial<TravelOffer> & Pick<TravelOffer, 'id'>,
): TravelOffer {
  return {
    provider: 'Sunweb',
    hotelName: 'Sunweb Hotel',
    destinationCountry: 'Spanje',
    nights: 8,
    price: 400,
    pricePerDay: 50,
    stars: 3,
    boardType: 'Logies',
    flightIncluded: 'true',
    departureAirport: 'BRU',
    imageUrl: 'https://example.com/a.jpg',
    deepLink:
      'https://www.sunweb.be/nl/vakantie/reizen?tt=1&r=' +
      encodeURIComponent(
        'https://www.sunweb.be/nl/vakantie/x?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LO&DepartureAirport[0]=BRU&DepartureDate[0]=2026-08-20',
      ),
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 1600,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
    ...overrides,
  };
}

function makeCorendonLive(
  hotelId: number,
  overrides: Partial<TravelOffer> = {},
): TravelOffer {
  return {
    id: `corendon-${hotelId}`,
    provider: 'Corendon',
    hotelName: `Fly-Drive ${hotelId}`,
    destinationCountry: 'Spanje',
    departureDate: '2026-08-27',
    nights: 4,
    price: 458,
    pricePerDay: 115,
    stars: 5,
    boardType: 'All Inclusive',
    flightIncluded: 'true',
    hasCarRental: true,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: corendonDeepLink(hotelId),
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    ...overrides,
  };
}

function stalePage1Sunweb(): TravelOffer[] {
  return Array.from({ length: 10 }, (_, index) =>
    makeSunweb({
      id: `sunweb-stale-${index}`,
      price: 300 + index,
      hasCarRental: undefined,
      stars: 3,
    }),
  );
}

function matchingCorendon(): TravelOffer[] {
  return CORENDON_HOTEL_IDS.map((hotelId, index) =>
    makeCorendonLive(hotelId, { price: 500 + index }),
  );
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

function makeLiveFetch(onLowest?: (url: string) => void): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('lowestpricesacco')) {
      onLowest?.(url);
      return new Response(okLowestBody(), { status: 200 });
    }
    if (url.includes('/upsales')) {
      return new Response(okUpsalesBody(), { status: 200 });
    }
    throw new Error(`unexpected live HTTP: ${url}`);
  };
}

function prepareMatchset(offers: TravelOffer[], params: SearchParams): TravelOffer[] {
  return sortOffers(filterOffers(offers, params), params.sort);
}

beforeEach(() => {
  clearPrijsvrijReceiptTokenCache();
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
});

test('A/C: stale page1Ids are not a whitelist; empty presentable page 1 falls back to live pipeline', async () => {
  const stale = stalePage1Sunweb();
  const matching = matchingCorendon();
  const catalog = [...stale, ...matching];
  const params: SearchParams = withLiveTotalOccupancy({
    adults: 2,
    page: 1,
    page1Ids: stale.map((offer) => offer.id),
    hasCarRental: true,
  });
  const filtered = prepareMatchset(catalog, params);
  assert.equal(filtered.length, matching.length);
  assert.equal(
    filtered.some((offer) => params.page1Ids!.includes(offer.id)),
    false,
  );

  assert.equal(tryCatalogRefinePage1(filtered, params), null);

  const lowestUrls: string[] = [];
  const slice = await resolveResultsPageSlice(filtered, params, {
    fetchImpl: makeLiveFetch((url) => lowestUrls.push(url)),
  });

  assert.ok(slice.visibleOffers.length > 0);
  assert.ok(slice.visibleOffers.every(hasValidPresentablePrice));
  assert.ok(slice.visibleOffers.every((offer) => offer.hasCarRental === true));
  assert.equal(
    slice.visibleOffers.some((offer) => offer.id.startsWith('sunweb-stale-')),
    false,
  );
  assert.ok(lowestUrls.length > 0);
  assert.equal(
    lowestUrls.some((url) => url.includes('sunweb')),
    false,
  );
});

test('B: filtered matchset > 0 must not yield 0 cards solely because page1Ids are stale', async () => {
  const catalog = [...stalePage1Sunweb(), ...matchingCorendon()];
  const params: SearchParams = withLiveTotalOccupancy({
    adults: 2,
    page: 1,
    page1Ids: stalePage1Sunweb().map((offer) => offer.id),
    stars: [5],
  });
  const filtered = prepareMatchset(catalog, params);
  assert.ok(filtered.length >= 10);

  const slice = await resolveResultsPageSlice(filtered, params, {
    fetchImpl: makeLiveFetch(),
  });
  assert.ok(slice.visibleOffers.length > 0);
  assert.ok(slice.visibleOffers.every((offer) => offer.stars === 5));
});

test('D: partial page1Ids overlap keeps presentable matches and fills from the filtered pool', async () => {
  const provenMatches = CORENDON_HOTEL_IDS.slice(0, 2).map((hotelId, index) =>
    makeCorendonLive(hotelId, {
      livePriceStatus: 'proven',
      livePriceSource: 'upsales',
      price: 700 + index,
      liveTotalPrice: 2800 + index,
      liveTotalPriceField: 'upsales.totalPrice',
    }),
  );
  const extraPresentable = CORENDON_HOTEL_IDS.slice(2, 8).map((hotelId, index) =>
    makeCorendonLive(hotelId, {
      livePriceStatus: 'proven',
      livePriceSource: 'upsales',
      price: 800 + index,
      liveTotalPrice: 3200 + index,
      liveTotalPriceField: 'upsales.totalPrice',
    }),
  );
  const staleOthers = stalePage1Sunweb().slice(2);
  const params: SearchParams = {
    adults: 2,
    page: 1,
    page1Ids: [...provenMatches.map((offer) => offer.id), ...staleOthers.map((offer) => offer.id)],
    hasCarRental: true,
  };
  const filtered = prepareMatchset([...provenMatches, ...extraPresentable, ...staleOthers], params);
  let httpCalls = 0;
  const slice = await resolveResultsPageSlice(filtered, params, {
    fetchImpl: async () => {
      httpCalls += 1;
      throw new Error('catalog refine with presentable cards must not live-price');
    },
  });

  assert.equal(httpCalls, 0);
  assert.equal(slice.visibleOffers.length, 8);
  assert.ok(provenMatches.every((offer) => slice.visibleOffers.some((visible) => visible.id === offer.id)));
  assert.ok(
    extraPresentable.every((offer) => slice.visibleOffers.some((visible) => visible.id === offer.id)),
  );
  assert.deepEqual(
    slice.page1Ids,
    slice.visibleOffers.map((offer) => offer.id),
  );
});

test('E: filter off keeps ordinary flight packages visible with stale page1Ids', async () => {
  const stale = stalePage1Sunweb();
  const params: SearchParams = { adults: 2, page: 1, page1Ids: stale.map((offer) => offer.id) };
  const filtered = prepareMatchset([...stale, ...matchingCorendon()], params);
  let httpCalls = 0;
  const slice = await resolveResultsPageSlice(filtered, params, {
    fetchImpl: async () => {
      httpCalls += 1;
      throw new Error('presentable catalog refine must skip HTTP');
    },
  });
  assert.equal(httpCalls, 0);
  assert.equal(slice.visibleOffers.length, 10);
  assert.deepEqual(
    slice.visibleOffers.map((offer) => offer.id),
    stale.map((offer) => offer.id),
  );
});

test('F: hasCarRental filter on only returns matching offers', async () => {
  const catalog = [...stalePage1Sunweb(), ...matchingCorendon()];
  const params: SearchParams = withLiveTotalOccupancy({
    adults: 2,
    page: 1,
    page1Ids: stalePage1Sunweb().map((offer) => offer.id),
    hasCarRental: true,
  });
  const filtered = prepareMatchset(catalog, params);
  const slice = await resolveResultsPageSlice(filtered, params, { fetchImpl: makeLiveFetch() });
  assert.ok(slice.visibleOffers.length > 0);
  assert.ok(slice.visibleOffers.every((offer) => offer.hasCarRental === true));
});

test('G: pagination of the rebuilt set stays inside the filtered remaining', async () => {
  const catalog = [...stalePage1Sunweb(), ...matchingCorendon()];
  const params: SearchParams = withLiveTotalOccupancy({
    adults: 2,
    page: 1,
    page1Ids: stalePage1Sunweb().map((offer) => offer.id),
    hasCarRental: true,
  });
  const filtered = prepareMatchset(catalog, params);
  const page1 = await resolveResultsPageSlice(filtered, params, { fetchImpl: makeLiveFetch() });
  assert.ok((page1.page1Ids?.length ?? 0) > 0);

  const page2 = await resolveResultsPageSlice(
    filtered,
    { ...params, page: 2, page1Ids: page1.page1Ids },
    { fetchImpl: async () => { throw new Error('page 2 with usable ids must not live-price'); } },
  );
  assert.ok(page2.visibleOffers.every((offer) => offer.hasCarRental === true));
  assert.ok(page2.visibleOffers.every((offer) => !page1.page1Ids!.includes(offer.id)));
  assert.deepEqual(page2.page1Ids, page1.page1Ids);
});

test('H: Detail → Terug keeps hasCarRental and rebuilt page1Ids', () => {
  const params: SearchParams = {
    adults: 2,
    country: 'Spanje',
    hasCarRental: true,
    page: 1,
    page1Ids: ['corendon-9514', 'corendon-9515'],
  };
  const detail = buildOfferDetailHref('corendon-9514', params);
  assert.match(detail, /hasCarRental=1/);
  const back = buildResultsPageHref(params, 1);
  assert.match(back, /hasCarRental=1/);
  assert.match(back, /page1Ids=/);
});

test('I: hasCarRental is not a sort key; price order of the filtered set is unchanged', () => {
  const matching = matchingCorendon();
  const byPrice = sortOffers(matching, 'price').map((offer) => offer.id);
  const flagged = matching.map((offer) => ({ ...offer, hasCarRental: true as const }));
  assert.deepEqual(sortOffers(flagged, 'price').map((offer) => offer.id), byPrice);
  assert.deepEqual(
    paginateResults(sortOffers(flagged, 'price'), 1, 10).map((offer) => offer.id),
    paginateResults(sortOffers(matching, 'price'), 1, 10).map((offer) => offer.id),
  );
});

test('J: live HTTP runs only for the filtered matchset, not stale page1 offers', async () => {
  const stale = stalePage1Sunweb();
  const matching = matchingCorendon();
  const params: SearchParams = {
    adults: 2,
    page: 1,
    page1Ids: stale.map((offer) => offer.id),
    hasCarRental: true,
  };
  const filtered = prepareMatchset([...stale, ...matching], params);
  const lowestUrls: string[] = [];
  await resolveResultsPageSlice(filtered, params, {
    fetchImpl: makeLiveFetch((url) => lowestUrls.push(url)),
  });
  assert.ok(lowestUrls.length > 0);
  for (const url of lowestUrls) {
    assert.equal(/sunweb-stale/.test(url), false);
  }
});

test('K: stars / board / vacation / country with stale disjoint page1Ids are the same generic bug, not hasCarRental-specific', async () => {
  const stale = stalePage1Sunweb();
  const matching = matchingCorendon();
  const catalog = [...stale, ...matching];
  const cases: SearchParams[] = [
    withLiveTotalOccupancy({ adults: 2, page: 1, page1Ids: stale.map((o) => o.id), stars: [5] }),
    withLiveTotalOccupancy({
      adults: 2,
      page: 1,
      page1Ids: stale.map((o) => o.id),
      boardTypes: ['All Inclusive'],
    }),
    withLiveTotalOccupancy({
      adults: 2,
      page: 1,
      page1Ids: stale.map((o) => o.id),
      country: 'Spanje',
      stars: [5],
    }),
    withLiveTotalOccupancy({ adults: 2, page: 1, page1Ids: stale.map((o) => o.id), hasCarRental: true }),
  ];

  for (const params of cases) {
    clearResultsLivePriceCache();
    clearLivePriceInflightForTests();
    const filtered = prepareMatchset(catalog, params);
    assert.ok(filtered.length > 0, JSON.stringify(params));
    assert.equal(tryCatalogRefinePage1(filtered, params), null, JSON.stringify(params));
    const slice = await resolveResultsPageSlice(filtered, params, { fetchImpl: makeLiveFetch() });
    assert.ok(slice.visibleOffers.length > 0, JSON.stringify(params));
  }
});

test('presentable Sunweb 2A with stale page1Ids still skips HTTP (cannot enter live pipeline)', async () => {
  const sun = makeSunweb({
    id: 'sunweb-unpriced',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
    hasCarRental: true,
  });
  const params: SearchParams = {
    adults: 2,
    page: 1,
    page1Ids: ['sunweb-stale-0'],
    hasCarRental: true,
  };
  let httpCalls = 0;
  const slice = await resolveResultsPageSlice([sun], params, {
    fetchImpl: async () => {
      httpCalls += 1;
      throw new Error('Sunweb 2A catalog must not start live HTTP');
    },
  });
  assert.equal(httpCalls, 0);
  assert.equal(slice.visibleOffers.length, 0);
});

test('fast-filter navigation still preserves page1Ids on the URL', () => {
  const previous = new URLSearchParams('country=Spanje&adults=2&page1Ids=a,b,c');
  for (const [key, value] of [
    ['hasCarRental', '1'],
    ['stars', '5'],
    ['boardTypes', 'All Inclusive'],
  ] as const) {
    const next = new URLSearchParams(previous);
    next.set(key, value);
    assert.equal(shouldPreservePage1Ids(previous, next), true);
    applyFilterNavigationPaging(next, { preservePage1Ids: true });
    assert.equal(next.get('page1Ids'), 'a,b,c');
    assert.equal(next.get('page'), null);
  }
});
