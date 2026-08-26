import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { TravelOffer } from '@/types/travel';
import {
  clearLivePriceInflightForTests,
  presentCatalogPage1WithoutLivePricing,
  priceLiveRequiredMatchset,
  pricePage1WithPrijsvrijReceipts,
  resolveResultsPageSlice,
  startPage1ReceiptStream,
} from '@/lib/providers/prijsvrij';
import { PRIJSVRIJ_PROVIDER_NAME } from '@/lib/providers/prijsvrij/constants';
import { clearPrijsvrijReceiptTokenCache } from '@/lib/providers/prijsvrij/receipt-auth';
import { clearResultsLivePriceCache } from '@/lib/search/results-live-price-cache';
import { priceOfferForDetail } from '@/lib/search/price-offer-for-detail';
import { SUNWEB_PRODUCT_URL } from '../providers/sunweb/offer-context.test';
import {
  echoGroupedPricesFromUrl,
  okPromotedBody as okSunwebPromotedBody,
  SUNWEB_LANDING_HTML,
} from '../providers/sunweb/promoted-price-client.test';
import { sortOffers } from '@/lib/search/filtering';
import { rankLivePricedCandidatePool } from '@/lib/search/prepare-results-offers';
import {
  ELIZA_PROVIDER_NAME,
  RESULTS_PRICE_COPY,
  filterToPresentableOffers,
  filterToResultsVisibleOffers,
  hasProvenLiveDisplayPrice,
  hasProvenLiveTotalPrice,
  hasValidPresentablePrice,
  isResultsListableOffer,
  isResultsVisibleOffer,
  isUnpricedResultsOffer,
  isValidNumericPrice,
  resultsPricePresentation,
  SUNWEB_PROVIDER_NAME,
} from '@/lib/search/presentable-price';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

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
    deepLink: 'https://example.com',
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

const CORENDON_FRAGMENT = '9514.COSPY.BRUCFU.270826.3-4-3.SZ-U';

function makeCorendonOffer(overrides: Partial<TravelOffer> = {}): TravelOffer {
  return makeOffer({
    id: 'corendon-9514',
    provider: 'Corendon',
    departureDate: '2026-08-27',
    nights: 4,
    price: 458,
    deepLink: `https://www.corendon.be/vakantie#${CORENDON_FRAGMENT}`,
    ...overrides,
  });
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

function makeLiveFetch(options: {
  failReceiptHotelIds?: Set<string>;
  lowestStatus?: number;
  lowestBody?: string | null;
}): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      return new Response(okSunwebPromotedBody(), { status: 200 });
    }
    if (url.includes('GetPricesGroupedByDurationApi')) {
      return new Response(echoGroupedPricesFromUrl(url), { status: 200 });
    }
    if (url.includes('sunweb.be') && !url.includes('/api/')) {
      return new Response(SUNWEB_LANDING_HTML, { status: 200 });
    }
    if (url.includes('lowestpricesacco')) {
      const status = options.lowestStatus ?? 200;
      if (status === 204) {
        return new Response(null, { status: 204 });
      }
      return new Response(options.lowestBody ?? okLowestBody(), { status });
    }
    if (url.includes('/upsales')) {
      return new Response(okUpsalesBody(), { status: 200 });
    }
    if (url.includes('/token') && !url.includes('receipt')) {
      return new Response(JSON.stringify({ token: 't'.repeat(40) }), { status: 200 });
    }
    const hotelMatch = /\/(\d+)\/receipt\//.exec(url);
    const hotelId = hotelMatch?.[1] ?? '';
    if (options.failReceiptHotelIds?.has(hotelId)) {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    return new Response(okReceiptBody(), { status: 200 });
  };
}

beforeEach(() => {
  clearPrijsvrijReceiptTokenCache();
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
});

test('1. Prijsvrij Receipt success remains internally proven; Results still parks the provider', async () => {
  clearPrijsvrijReceiptTokenCache();
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 999 })],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({}) },
  );
  assert.equal(page.length, 1);
  assert.equal(page[0].livePriceStatus, 'proven');
  assert.equal(page[0].livePriceSource, 'receipt');
  assert.ok(hasValidPresentablePrice(page[0]));
  assert.notEqual(page[0].price, 999);
});

test('2-5. Prijsvrij Receipt failure → niet zichtbaar; geen Search/Matrix/feed fallback', async () => {
  clearPrijsvrijReceiptTokenCache();
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 999 })],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({ failReceiptHotelIds: new Set(['100']) }) },
  );
  assert.equal(page.length, 0);
  assert.ok(!page.some((offer) => offer.livePriceSource === 'search'));
  assert.ok(!page.some((offer) => offer.livePriceSource === 'feed'));
  assert.ok(!page.some((offer) => offer.price === 999));
});

test('6. Prijsvrij catalog/unavailable is never presentable', () => {
  assert.equal(
    hasValidPresentablePrice(
      makeOffer({
        id: 'pv-feed',
        provider: PRIJSVRIJ_PROVIDER_NAME,
        price: 400,
        livePriceStatus: 'catalog',
        livePriceSource: 'feed',
      }),
    ),
    false,
  );
  assert.equal(
    hasValidPresentablePrice(
      makeOffer({
        id: 'pv-search',
        provider: PRIJSVRIJ_PROVIDER_NAME,
        price: 400,
        livePriceStatus: 'proven',
        livePriceSource: 'search',
      }),
    ),
    false,
  );
  assert.equal(
    hasValidPresentablePrice(
      makeOffer({
        id: 'pv-unavail',
        provider: PRIJSVRIJ_PROVIDER_NAME,
        price: 400,
        livePriceStatus: 'unavailable',
      }),
    ),
    false,
  );
});

test('7. Corendon 2A without DOB is presentable only when upsales supplies a provider total', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeCorendonOffer({ price: 458 })],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({}) },
  );
  assert.equal(page.length, 1);
  assert.equal(page[0].livePriceSource, 'upsales');
  assert.equal(hasValidPresentablePrice(page[0]), true);

  const [lowestOnly] = await priceLiveRequiredMatchset(
    [makeCorendonOffer({ price: 458 })],
    { adults: 2, rooms: 2 },
    { fetchImpl: makeLiveFetch({}) },
  );
  assert.equal(lowestOnly.livePriceStatus, 'proven');
  assert.equal(lowestOnly.livePriceSource, 'lowestpricesacco');
  assert.equal(lowestOnly.price, 876);
  assert.equal(hasProvenLiveDisplayPrice(lowestOnly), true);
  assert.equal(hasProvenLiveTotalPrice(lowestOnly), false);
  assert.equal(hasValidPresentablePrice(lowestOnly), false);
});

test('8-10. Corendon live failure → niet zichtbaar; geen feed fallback', async () => {
  const empty = await pricePage1WithPrijsvrijReceipts(
    [makeCorendonOffer({ price: 458 })],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({ lowestStatus: 204 }) },
  );
  assert.equal(empty.length, 0);

  const failed = await pricePage1WithPrijsvrijReceipts(
    [makeCorendonOffer({ price: 458 })],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({ lowestStatus: 500 }) },
  );
  assert.equal(failed.length, 0);

  assert.equal(
    hasValidPresentablePrice(
      makeCorendonOffer({
        livePriceStatus: 'unavailable',
        livePriceSource: undefined,
        price: 458,
      }),
    ),
    false,
  );
  assert.equal(
    hasValidPresentablePrice(
      makeCorendonOffer({
        livePriceStatus: 'catalog',
        livePriceSource: 'feed',
        price: 458,
      }),
    ),
    false,
  );
});

test('11-12. Sunweb live success zichtbaar; live failure niet', () => {
  const success = makeOffer({
    id: 'sun-ok',
    provider: SUNWEB_PROVIDER_NAME,
    price: 1250,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 5000,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
  const failure = makeOffer({
    id: 'sun-fail',
    provider: SUNWEB_PROVIDER_NAME,
    price: 800,
    livePriceStatus: 'unavailable',
  });
  assert.equal(hasValidPresentablePrice(success), true);
  assert.equal(hasValidPresentablePrice(failure), false);
  assert.deepEqual(filterToPresentableOffers([success, failure]).map((offer) => offer.id), ['sun-ok']);
});

test('13-14. Eliza live success zichtbaar; live failure en catalog niet', () => {
  const success = makeOffer({
    id: 'eliza-ok',
    provider: ELIZA_PROVIDER_NAME,
    price: 1100,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 2200,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
  const failure = makeOffer({
    id: 'eliza-fail',
    provider: ELIZA_PROVIDER_NAME,
    price: 700,
    livePriceStatus: 'unavailable',
  });
  const catalog = makeOffer({
    id: 'eliza-feed',
    provider: ELIZA_PROVIDER_NAME,
    price: 599,
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
  });
  assert.equal(hasValidPresentablePrice(success), true);
  assert.equal(hasValidPresentablePrice(failure), false);
  assert.equal(hasValidPresentablePrice(catalog), false);
});

test('15. Geen provider presenteert een offer zonder geldige prijs', () => {
  const invalid: TravelOffer[] = [
    makeOffer({ id: 'pv', provider: PRIJSVRIJ_PROVIDER_NAME, price: 400 }),
    makeOffer({ id: 'cor', provider: 'Corendon', price: 400 }),
    makeOffer({ id: 'zero', provider: SUNWEB_PROVIDER_NAME, price: 0 }),
    makeOffer({
      id: 'unavail',
      provider: ELIZA_PROVIDER_NAME,
      price: 500,
      livePriceStatus: 'unavailable',
    }),
  ];
  assert.equal(filterToPresentableOffers(invalid).length, 0);
  assert.ok(invalid.every((offer) => !hasValidPresentablePrice(offer) || isValidNumericPrice(offer.price)));
});

test('16-17. Fast catalog filters keep valid price semantics and do not invent unavailable', () => {
  const offers = [
    makeOffer({
      id: 'sun-1',
      provider: SUNWEB_PROVIDER_NAME,
      price: 900,
      stars: 4,
      boardType: 'All Inclusive',
      livePriceStatus: 'catalog',
      livePriceSource: 'feed',
    }),
    makeOffer({
      id: 'pv-1',
      provider: PRIJSVRIJ_PROVIDER_NAME,
      price: 800,
      stars: 4,
      boardType: 'All Inclusive',
    }),
    makeOffer({
      id: 'cor-1',
      provider: 'Corendon',
      price: 850,
      stars: 5,
      boardType: 'All Inclusive',
    }),
    makeOffer({
      id: 'sun-proven',
      provider: SUNWEB_PROVIDER_NAME,
      price: 1250,
      stars: 5,
      boardType: 'All Inclusive',
      livePriceStatus: 'proven',
      livePriceSource: 'getPromotedPrice',
      liveTotalPrice: 2500,
      liveTotalPriceField: 'getPromotedPrice.totalPrice',
    }),
  ];

  const budgeted = presentCatalogPage1WithoutLivePricing(
    offers.filter((offer) => offer.price <= 1000),
    10,
  );
  assert.ok(budgeted.visibleOffers.every(hasValidPresentablePrice));
  assert.ok(!budgeted.visibleOffers.some((offer) => offer.livePriceStatus === 'unavailable'));
  assert.ok(!budgeted.visibleOffers.some((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME));
  assert.ok(!budgeted.visibleOffers.some((offer) => offer.provider === 'Corendon'));
  assert.equal(budgeted.visibleOffers.some((offer) => offer.id === 'sun-1'), false);

  const starred = presentCatalogPage1WithoutLivePricing(
    offers.filter((offer) => offer.stars === 5),
    10,
  );
  assert.ok(starred.visibleOffers.every(hasValidPresentablePrice));
  assert.deepEqual(starred.visibleOffers.map((offer) => offer.id), ['sun-proven']);
});

test('18. Prijs op aanvraag is gone from product UI', () => {
  const travelCard = readFileSync(join(ROOT, 'components/results/travel-card.tsx'), 'utf8');
  const presentable = readFileSync(join(ROOT, 'lib/search/presentable-price.ts'), 'utf8');
  assert.ok(!travelCard.includes('Prijs op aanvraag'));
  assert.ok(!travelCard.includes('price on request'));
  assert.ok(!travelCard.includes('shouldShowOfferPrice'));
  assert.ok(presentable.includes('Actuele prijs niet beschikbaar'));
  assert.ok(presentable.includes('Geen bevestigde prijs voor deze samenstelling'));
  assert.ok(travelCard.includes('RESULTS_PRICE_COPY.unpriced'));
  assert.ok(travelCard.includes('RESULTS_PRICE_COPY.unavailable'));
});

test('19-20. Price sort low→high and high→low only includes numeric presentable prices', () => {
  const offers = [
    makeOffer({
      id: 'high',
      provider: SUNWEB_PROVIDER_NAME,
      price: 1450,
      livePriceStatus: 'proven',
      livePriceSource: 'getPromotedPrice',
      liveTotalPrice: 2900,
      liveTotalPriceField: 'getPromotedPrice.totalPrice',
    }),
    makeOffer({
      id: 'mid',
      provider: ELIZA_PROVIDER_NAME,
      price: 1300,
      livePriceStatus: 'proven',
      livePriceSource: 'getPromotedPrice',
      liveTotalPrice: 2600,
      liveTotalPriceField: 'getPromotedPrice.totalPrice',
    }),
    makeOffer({
      id: 'low',
      provider: 'Corendon',
      price: 1250,
      livePriceStatus: 'proven',
      livePriceSource: 'lowestpricesacco',
    }),
    makeOffer({
      id: 'hidden-pv',
      provider: PRIJSVRIJ_PROVIDER_NAME,
      price: 100,
    }),
    makeOffer({
      id: 'hidden-cor',
      provider: 'Corendon',
      price: 90,
      livePriceStatus: 'unavailable',
    }),
  ];

  const presentable = filterToPresentableOffers(offers);
  assert.ok(presentable.every((offer) => isValidNumericPrice(offer.price)));
  assert.ok(!presentable.some((offer) => offer.id.startsWith('hidden')));

  assert.deepEqual(presentable.map((offer) => offer.id).sort(), ['high', 'mid']);

  const lowToHigh = sortOffers(presentable, 'price');
  assert.deepEqual(lowToHigh.map((offer) => offer.price), [1300, 1450]);

  const highToLow = sortOffers(presentable, 'price-desc');
  assert.deepEqual(highToLow.map((offer) => offer.price), [1450, 1300]);
});

test('21. Package-1: Receipt success stays, failure is reserved, no redesign of caps', async () => {
  clearPrijsvrijReceiptTokenCache();
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 999 }),
      makeOffer({ id: 'prijsvrij-200-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 888 }),
      makeOffer({ id: 'sunweb-a', provider: SUNWEB_PROVIDER_NAME, price: 350 }),
      makeOffer({ id: 'prijsvrij-300-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 777 }),
    ],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({ failReceiptHotelIds: new Set(['100']) }) },
  );
  assert.ok(!page.some((offer) => offer.id === 'prijsvrij-100-x'));
  assert.ok(page.some((offer) => offer.id === 'prijsvrij-300-x' && offer.livePriceSource === 'receipt'));
  assert.ok(page.filter((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME).length <= 3);
  assert.ok(page.every(hasValidPresentablePrice));
  assert.equal(page.some((offer) => offer.id === 'sunweb-a'), false);
});

test('22. Package-2A: non-PV presentable cards stay immediate; failed live slots are null', async () => {
  clearPrijsvrijReceiptTokenCache();
  const stream = startPage1ReceiptStream(
    [
      makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME }),
      makeOffer({ id: 'sunweb-a', provider: SUNWEB_PROVIDER_NAME, price: 350 }),
      makeCorendonOffer({ id: 'corendon-9514' }),
    ],
    { adults: 2 },
    { fetchImpl: makeLiveFetch({ lowestStatus: 204, failReceiptHotelIds: new Set(['100']) }) },
  );
  const immediate = stream.slots.filter((slot) => slot.kind === 'immediate');
  assert.equal(
    immediate.some((slot) => slot.kind === 'immediate' && slot.offer.provider === SUNWEB_PROVIDER_NAME),
    true,
  );
  if (immediate.some((slot) => slot.offer.provider === SUNWEB_PROVIDER_NAME)) {
    const sunweb = immediate.find((slot) => slot.offer.provider === SUNWEB_PROVIDER_NAME);
    assert.equal(sunweb?.offer.livePriceStatus, 'unavailable');
  }
  const presented = await stream.presented;
  assert.ok(presented.page1.every(hasValidPresentablePrice));
  assert.equal(presented.page1.some((offer) => offer.provider === SUNWEB_PROVIDER_NAME), false);
  assert.ok(!presented.page1.some((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME));
  assert.ok(!presented.page1.some((offer) => offer.provider === 'Corendon'));
  assert.ok(!presented.page1.some((offer) => offer.provider === ELIZA_PROVIDER_NAME && offer.livePriceSource === 'feed'));
});

test('23. Homepage bevat geen airport selector', () => {
  const homeSearch = readFileSync(join(ROOT, 'components/home/home-search.tsx'), 'utf8');
  const homeHero = readFileSync(join(ROOT, 'components/home/home-hero.tsx'), 'utf8');
  const homePage = readFileSync(join(ROOT, 'app/page.tsx'), 'utf8');
  assert.ok(!homeSearch.includes('DepartureAirportPopup'));
  assert.ok(!homeSearch.includes('airportPopupOpen'));
  assert.ok(!homeSearch.includes('Vertrekluchthaven'));
  assert.ok(!homeHero.includes('departureAirports'));
  assert.ok(!homePage.includes('departureAirports'));
});

test('24. Results bevat wel airport multi-select', () => {
  const resultsBar = readFileSync(join(ROOT, 'components/results-v2/results-search-bar.tsx'), 'utf8');
  assert.ok(resultsBar.includes('DepartureAirportPopup'));
  assert.ok(resultsBar.includes('selectedDepartureAirports'));
});

test('fast refine with page1Ids does 0 live HTTP and never marks unavailable', async () => {
  let httpCalls = 0;
  const fetchImpl: typeof fetch = async () => {
    httpCalls += 1;
    throw new Error('live pricing must not run on fast catalog refine');
  };
  const offers = [
    makeOffer({
      id: 'sun-1',
      provider: SUNWEB_PROVIDER_NAME,
      price: 900,
      stars: 4,
      livePriceStatus: 'catalog',
      livePriceSource: 'feed',
    }),
  ];
  const slice = await resolveResultsPageSlice(
    offers,
    { adults: 2, page: 1, page1Ids: ['sun-1'], stars: [4] },
    { fetchImpl },
  );
  assert.equal(httpCalls, 0);
  assert.ok(slice.visibleOffers.every(hasValidPresentablePrice));
  assert.ok(!slice.visibleOffers.some((offer) => offer.livePriceStatus === 'unavailable'));
  assert.equal(slice.visibleOffers.length, 0);
});

test('UNPRICED is not visible on Results and is not a presentable live price', () => {
  const unpriced = makeCorendonOffer({
    livePriceStatus: 'unpriced',
    price: 458,
  });
  const unavailable = makeCorendonOffer({
    livePriceStatus: 'unavailable',
    price: 458,
  });
  assert.equal(hasValidPresentablePrice(unpriced), false);
  assert.equal(isUnpricedResultsOffer(unpriced), true);
  assert.equal(isResultsVisibleOffer(unpriced), false);
  assert.equal(isResultsVisibleOffer(unavailable), false);
  assert.deepEqual(filterToPresentableOffers([unpriced, unavailable]).map((offer) => offer.id), []);
  assert.deepEqual(filterToResultsVisibleOffers([unpriced, unavailable]).map((offer) => offer.id), []);
});

test('Corendon proven upsales is a presentable live price', () => {
  assert.equal(
    hasValidPresentablePrice(
      makeCorendonOffer({
        livePriceStatus: 'proven',
        livePriceSource: 'upsales',
        price: 600,
        liveTotalPrice: 1893,
        liveTotalPriceField: 'upsales.totalPrice',
      }),
    ),
    true,
  );
});

test('4 pax / 2 rooms: Corendon upsales is presentable; Prijsvrij stays unpriced', async () => {
  let lowestCalls = 0;
  let upsalesCalls = 0;
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({ id: 'prijsvrij-100-x', provider: PRIJSVRIJ_PROVIDER_NAME, price: 999 }),
      makeCorendonOffer({ price: 458 }),
      makeOffer({ id: 'sunweb-a', provider: SUNWEB_PROVIDER_NAME, price: 350 }),
    ],
    {
      adults: 2,
      children: 2,
      rooms: 2,
      party: [
        { dateOfBirth: '1990-01-15', roomIndex: 0 },
        { dateOfBirth: '1988-03-03', roomIndex: 0 },
        { dateOfBirth: '2014-06-14', roomIndex: 1 },
        { dateOfBirth: '2018-01-22', roomIndex: 1 },
      ],
    },
    {
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes('lowestpricesacco')) {
          lowestCalls += 1;
        }
        if (url.includes('/upsales')) {
          upsalesCalls += 1;
        }
        return makeLiveFetch({})(input);
      },
    },
  );

  assert.equal(lowestCalls, 1);
  assert.equal(upsalesCalls, 1);
  const pv = page.find((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME);
  const cor = page.find((offer) => offer.provider === 'Corendon');
  const sun = page.find((offer) => offer.provider === SUNWEB_PROVIDER_NAME);
  assert.equal(pv, undefined);
  assert.ok(cor);
  assert.equal(cor.livePriceStatus, 'proven');
  assert.equal(cor.livePriceSource, 'upsales');
  assert.equal(hasValidPresentablePrice(cor), true);
  assert.equal(sun, undefined);
  assert.ok(page.every(isResultsVisibleOffer));
  assert.ok(!page.some((offer) => offer.livePriceSource === 'feed'));
});

test('1. SUCCESS → kaart zichtbaar + prijs', () => {
  const offer = makeOffer({
    id: 'eliza-ok',
    provider: ELIZA_PROVIDER_NAME,
    price: 1100,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 2200,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
  assert.equal(hasValidPresentablePrice(offer), true);
  assert.equal(isResultsVisibleOffer(offer), true);
  assert.equal(resultsPricePresentation(offer), 'amount');
});

test('2. UNPRICED → kaart niet zichtbaar', () => {
  const offer = makeCorendonOffer({ livePriceStatus: 'unpriced', price: 458 });
  assert.equal(hasValidPresentablePrice(offer), false);
  assert.equal(isResultsVisibleOffer(offer), false);
  assert.equal(resultsPricePresentation(offer), 'unpriced');
  assert.equal(RESULTS_PRICE_COPY.unpriced.includes('niet beschikbaar'), false);
});

test('3. UNAVAILABLE → kaart niet zichtbaar', () => {
  const offer = makeCorendonOffer({ livePriceStatus: 'unavailable', price: 458 });
  assert.equal(hasValidPresentablePrice(offer), false);
  assert.equal(isResultsVisibleOffer(offer), false);
  assert.equal(resultsPricePresentation(offer), 'unavailable');
});

test('3b. A and C settled failures are not Results-listable', () => {
  const confirmed = makeCorendonOffer({
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'no_trip',
    price: 458,
  });
  assert.equal(isResultsListableOffer(confirmed), false);

  const timedOut = makeCorendonOffer({
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'timeout',
    price: 458,
  });
  assert.equal(isResultsListableOffer(timedOut), false);
  assert.equal(resultsPricePresentation(timedOut), 'unavailable');

  const stale = makeCorendonOffer({
    livePriceStatus: 'unavailable',
    livePriceFailureReason: 'stale_context',
    price: 458,
  });
  assert.equal(isResultsListableOffer(stale), false);
});

test('4. ERROR → kaart niet zichtbaar', () => {
  const offer = makeCorendonOffer({ livePriceStatus: 'unavailable', livePriceSource: undefined, price: 458 });
  assert.equal(hasValidPresentablePrice(offer), false);
  assert.equal(isResultsVisibleOffer(offer), false);
  assert.equal(resultsPricePresentation(offer), 'unavailable');
  assert.equal(resultsPricePresentation(offer, { provisional: true }), 'pending');
});

test('5. PRICE PENDING is only a temporary presentation, not a proven price', () => {
  const offer = makeCorendonOffer({ livePriceStatus: 'catalog', livePriceSource: 'feed', price: 458 });
  assert.equal(isResultsVisibleOffer(offer), false);
  assert.equal(resultsPricePresentation(offer, { provisional: true }), 'pending');
  assert.equal(hasValidPresentablePrice(offer), false);
});

test('6. Feedprijs zonder live bewijs → kaart niet zichtbaar', () => {
  const sunFeed = makeOffer({
    id: 'sun-feed',
    provider: SUNWEB_PROVIDER_NAME,
    price: 400,
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
  });
  assert.equal(hasValidPresentablePrice(sunFeed), false);
  assert.equal(isResultsVisibleOffer(sunFeed), false);
  assert.notEqual(resultsPricePresentation(sunFeed), 'amount');
  assert.equal(
    isResultsVisibleOffer(
      makeCorendonOffer({ livePriceStatus: 'catalog', livePriceSource: 'feed', price: 458 }),
    ),
    false,
  );
  assert.equal(
    isResultsVisibleOffer(
      makeOffer({
        id: 'eliza-feed',
        provider: ELIZA_PROVIDER_NAME,
        price: 599,
        livePriceStatus: 'catalog',
        livePriceSource: 'feed',
      }),
    ),
    false,
  );
});

test('7. 2A/1R Sunweb with proven GetPromotedPrice is presentable on Results', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [
      makeOffer({
        id: 'sunweb-84012',
        provider: SUNWEB_PROVIDER_NAME,
        price: 427,
        deepLink: SUNWEB_PRODUCT_URL,
      }),
    ],
    { adults: 2, rooms: 1 },
    { fetchImpl: makeLiveFetch({}) },
  );
  assert.equal(page.length, 1);
  assert.equal(page[0].livePriceSource, 'getPromotedPrice');
  assert.ok(hasValidPresentablePrice(page[0]));
});

test('8. 2A/1R Corendon lowest source without a provider total is not presentable', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeCorendonOffer({ price: 458 })],
    { adults: 2, rooms: 2 },
    { fetchImpl: makeLiveFetch({}) },
  );
  assert.equal(page.length, 0);
  assert.equal(
    hasValidPresentablePrice(
      makeCorendonOffer({
        livePriceStatus: 'proven',
        livePriceSource: 'lowestpricesacco',
        price: 876,
      }),
    ),
    false,
  );
});

test('9. 2A/1R Eliza SUCCESS → zichtbaar', () => {
  const offer = makeOffer({
    id: 'eliza-ok',
    provider: ELIZA_PROVIDER_NAME,
    price: 672,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 1901,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
  assert.equal(isResultsVisibleOffer(offer), true);
  assert.equal(resultsPricePresentation(offer), 'amount');
});

test('10. 4P/2R Sunweb SUCCESS → zichtbaar', () => {
  const offer = makeOffer({
    id: 'sun-ok',
    provider: SUNWEB_PROVIDER_NAME,
    price: 1250,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 5000,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
  assert.equal(hasValidPresentablePrice(offer), true);
  assert.equal(isResultsVisibleOffer(offer), true);
  assert.equal(resultsPricePresentation(offer), 'amount');
});

test('11. 4P/2R Eliza SUCCESS → zichtbaar', () => {
  const offer = makeOffer({
    id: 'eliza-4p',
    provider: ELIZA_PROVIDER_NAME,
    price: 890,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
    liveTotalPrice: 3560,
    liveTotalPriceField: 'getPromotedPrice.totalPrice',
  });
  assert.equal(isResultsVisibleOffer(offer), true);
  assert.equal(resultsPricePresentation(offer), 'amount');
});

test('12. 4P/2R Corendon SUCCESS → zichtbaar', () => {
  assert.equal(
    isResultsVisibleOffer(
      makeCorendonOffer({
        livePriceStatus: 'proven',
        livePriceSource: 'upsales',
        price: 600,
        liveTotalPrice: 2400,
        liveTotalPriceField: 'upsales.totalPrice',
      }),
    ),
    true,
  );
});

test('13. 4p/2r zonder bewezen live prijs → niet zichtbaar', async () => {
  const page = await pricePage1WithPrijsvrijReceipts(
    [makeOffer({ id: 'sunweb-84012', provider: SUNWEB_PROVIDER_NAME, price: 427 })],
    { adults: 2, children: 2, rooms: 2 },
    { fetchImpl: makeLiveFetch({}) },
  );
  assert.equal(page.length, 0);
});

test('14. Prijsvrij blijft PARKED: catalog is not presentable and Detail does not call Receipt', async () => {
  const offer = makeOffer({
    id: 'prijsvrij-parked',
    provider: PRIJSVRIJ_PROVIDER_NAME,
    price: 400,
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
  });
  assert.equal(hasValidPresentablePrice(offer), false);
  assert.equal(isResultsVisibleOffer(offer), false);
  const detail = await priceOfferForDetail(offer, { adults: 2 }, {
    fetchImpl: async () => {
      throw new Error('Receipt must not run on Detail');
    },
  });
  assert.equal(hasValidPresentablePrice(detail), false);
});

test('15. Price sorting behoudt catalogusoffers; presentable sorteert vooraan', () => {
  const offers = [
    makeOffer({
      id: 'proven',
      provider: SUNWEB_PROVIDER_NAME,
      price: 1250,
      livePriceStatus: 'proven',
      livePriceSource: 'getPromotedPrice',
      liveTotalPrice: 5000,
      liveTotalPriceField: 'getPromotedPrice.totalPrice',
    }),
    makeOffer({
      id: 'feed',
      provider: SUNWEB_PROVIDER_NAME,
      price: 100,
      livePriceStatus: 'catalog',
      livePriceSource: 'feed',
    }),
    makeCorendonOffer({ id: 'corendon-unpriced', livePriceStatus: 'unpriced', price: 90 }),
  ];
  const presentable = filterToPresentableOffers(offers);
  assert.deepEqual(presentable.map((offer) => offer.id), ['proven']);
  const ranked = rankLivePricedCandidatePool(offers, { adults: 2, sort: 'price' });
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0].id, 'proven');
  assert.equal(hasValidPresentablePrice(ranked[0]), true);
  assert.equal(hasValidPresentablePrice(ranked[1]), false);
  assert.equal(hasValidPresentablePrice(ranked[2]), false);
  assert.deepEqual(sortOffers(presentable, 'price').map((offer) => offer.id), ['proven']);
});

test('16. Results → Detail → Results behoudt dezelfde eligibility', async () => {
  const params = { adults: 2 };
  const offer = makeOffer({
    id: 'sunweb-status',
    provider: SUNWEB_PROVIDER_NAME,
    price: 400,
    deepLink: 'https://www.sunweb.nl/hotel',
  });
  const detail = await priceOfferForDetail(offer, params);
  assert.equal(isResultsVisibleOffer(detail), false);
  const back = await pricePage1WithPrijsvrijReceipts([offer], params, { fetchImpl: makeLiveFetch({}) });
  assert.equal(back.length, 0);
  assert.equal(isResultsVisibleOffer(detail), false);
  assert.notEqual(resultsPricePresentation(detail), 'amount');
});

test('9. Corendon proven live price blijft zichtbaar alleen met provider-total', () => {
  assert.equal(
    resultsPricePresentation(
      makeCorendonOffer({
        livePriceStatus: 'proven',
        livePriceSource: 'lowestpricesacco',
        price: 876,
      }),
    ),
    'unpriced',
  );
  assert.equal(
    resultsPricePresentation(
      makeCorendonOffer({
        livePriceStatus: 'proven',
        livePriceSource: 'upsales',
        price: 600,
        liveTotalPrice: 1200,
        liveTotalPriceField: 'upsales.totalPrice',
      }),
    ),
    'amount',
  );
});

test('10. Eliza proven live price blijft zichtbaar', () => {
  assert.equal(
    resultsPricePresentation(
      makeOffer({
        id: 'eliza-ok',
        provider: ELIZA_PROVIDER_NAME,
        price: 1100,
        livePriceStatus: 'proven',
        livePriceSource: 'getPromotedPrice',
        liveTotalPrice: 2200,
        liveTotalPriceField: 'getPromotedPrice.totalPrice',
      }),
    ),
    'amount',
  );
});
