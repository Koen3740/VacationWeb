/**
 * Fase B3 — evidence only.
 * Proves existing joinOrStartInflight coalescing for Sunweb / Eliza / Corendon.
 * No production code changes. No imports from other *.test.ts (avoids loading those suites).
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import type { TravelOffer } from '../feeds/canonical/travel-offer';
import { clearResultsLivePriceCache } from '../search/results-live-price-cache';
import { resetContextItemIdCacheForTests } from './context-item-id-cache';
import {
  clearLivePriceInflightForTests,
  priceLiveRequiredMatchset,
  startCatalogPageLiveOverlays,
} from './prijsvrij/page1-receipt-pricing';

afterEach(() => {
  clearResultsLivePriceCache();
  clearLivePriceInflightForTests();
  resetContextItemIdCacheForTests();
});

const SUNWEB_LANDING =
  'https://www.sunweb.be/nl/vakantie/griekenland/kos/kos-stad/appartementen-bristol-seaview' +
  '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
  '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-09-26' +
  '&Participants[0][0]=1990-01-15&Participants[0][1]=1988-03-03';

const SUNWEB_PRODUCT_URL =
  'https://www.sunweb.be/nl/vakantie/reizen?tt=1393_1754875_511747_&r=' +
  encodeURIComponent(SUNWEB_LANDING);

const SUNWEB_LANDING_HTML =
  JSON.stringify({
    template: 'AccommodationPage',
    contextItemId: 'c1440175-b6ef-4dd3-b7ea-96c7143d47ea',
  }) +
  '"PDP.bookingGateId":"D7AF6C79-A074-4724-8595-F0A5DE507A04"' +
  '"PDP.promotedPriceId":"D07B99C8-DFE0-4B7A-86C5-B4DE9A4C6077"';

const ELIZA_LANDING =
  'https://www.elizawashere.be/spanje/andalusie/ronda/casita-paradise-island' +
  '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
  '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-11-19' +
  '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30';

const ELIZA_PRODUCT_URL =
  'https://www.elizawashere.be/reizen?tt=1327_2084000_511747_&r=' +
  encodeURIComponent(ELIZA_LANDING);

const ELIZA_LANDING_HTML =
  JSON.stringify({
    template: 'AccommodationPage',
    contextItemId: '29c6d01a-70c6-4297-9422-1c3dab8c94ad',
  }) + '"PDP.promotedPriceId":"C6E4E13C-D74A-4A4D-BC6B-C151B6FF1E42"';

const PARTY_2A_1C = {
  adults: 2,
  children: 1,
  rooms: 1,
  party: [
    { dateOfBirth: '1990-01-15', roomIndex: 0 },
    { dateOfBirth: '1988-03-03', roomIndex: 0 },
    { dateOfBirth: '2018-06-01', roomIndex: 0 },
  ],
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeSunweb(): TravelOffer {
  return {
    id: 'sunweb-84012',
    provider: 'Sunweb',
    hotelName: 'Appartementen Bristol Seaview',
    destinationCountry: 'Griekenland',
    departureDate: '2026-09-26',
    nights: 7,
    flightIncluded: 'true',
    price: 427,
    pricePerDay: 61,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: SUNWEB_PRODUCT_URL,
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
  };
}

function makeEliza(): TravelOffer {
  return {
    id: 'eliza-6270665',
    provider: 'Eliza was here',
    hotelName: 'Casita Paradise Island',
    destinationCountry: 'Spanje',
    departureDate: '2026-11-19',
    nights: 7,
    flightIncluded: 'true',
    price: 599,
    pricePerDay: 86,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: ELIZA_PRODUCT_URL,
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
  };
}

function makeCorendon(): TravelOffer {
  return {
    id: 'corendon-9514',
    provider: 'Corendon',
    hotelName: 'Corendon Hotel',
    destinationCountry: 'Portugal',
    departureDate: '2026-08-27',
    nights: 4,
    flightIncluded: 'true',
    price: 458,
    pricePerDay: 115,
    imageUrl: 'https://example.com/a.jpg',
    deepLink: 'https://www.corendon.be/vakantie#9514.COSPY.BRUCFU.270826.3-4-3.SZ-U',
    livePriceStatus: 'catalog',
    livePriceSource: 'feed',
  };
}

function okSunwebPromotedBody(): string {
  return JSON.stringify({
    accommodationId: 84012,
    duration: 8,
    price: { totalPrice: 1010, averagePrice: 505, value: 505, legend: 'Vanafprijs p.p.' },
    departureDate: { raw: '2026-09-26' },
    acmInformation: { mealplanCode: 'LG' },
  });
}

function okElizaPromotedBody(): string {
  return JSON.stringify({
    accommodationId: 6270665,
    duration: 8,
    price: { totalPrice: 1304, averagePrice: 652, value: 652, legend: 'Vanafprijs p.p.' },
    departureDate: { raw: '2026-11-19' },
    acmInformation: { mealplanCode: 'LG' },
  });
}

function echoGroupedPricesFromUrl(url: string): string {
  const parsed = new URL(url);
  return JSON.stringify({
    errors: [],
    data: {
      isEmptyResponse: false,
      prices: [
        {
          minPricePerPerson: 505,
          averagePrice: 505,
          totalPrice: 1010,
          duration: parsed.searchParams.get('Duration[0]') ?? '8',
          transportType: parsed.searchParams.get('TransportType') ?? 'Flight',
          mealplan: parsed.searchParams.get('Mealplan') ?? 'LG',
          departureDate: parsed.searchParams.get('DepartureDate[0]') ?? '2026-09-26',
        },
      ],
    },
  });
}

function okLowestBody(): string {
  return JSON.stringify({
    package: {
      lowestPriceTrip: {
        tripDepartureDate: '2026-08-27T00:00:00',
        trip: {
          price: 876,
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
        totalPrice: pricePerPerson * 3,
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

type HttpCounters = {
  sunwebPromoted: number;
  sunwebLanding: number;
  elizaPromoted: number;
  elizaLanding: number;
  corendonLowest: number;
};

function createCounters(): HttpCounters {
  return {
    sunwebPromoted: 0,
    sunwebLanding: 0,
    elizaPromoted: 0,
    elizaLanding: 0,
    corendonLowest: 0,
  };
}

function makeProviderFetch(counters: HttpCounters, latencyMs = 40): typeof fetch {
  return async (input) => {
    await delay(latencyMs);
    const url = String(input);

    if (url.includes('GetPromotedPriceApi')) {
      if (url.includes('elizawashere')) {
        counters.elizaPromoted += 1;
        return new Response(okElizaPromotedBody(), { status: 200 });
      }
      counters.sunwebPromoted += 1;
      return new Response(okSunwebPromotedBody(), { status: 200 });
    }
    if (url.includes('GetPricesGroupedByDurationApi')) {
      return new Response(echoGroupedPricesFromUrl(url), { status: 200 });
    }
    if (url.includes('sunweb.be') && !url.includes('/api/')) {
      counters.sunwebLanding += 1;
      return new Response(SUNWEB_LANDING_HTML, { status: 200 });
    }
    if (url.includes('elizawashere.be') && !url.includes('/api/')) {
      counters.elizaLanding += 1;
      return new Response(ELIZA_LANDING_HTML, { status: 200 });
    }
    if (url.includes('lowestpricesacco')) {
      counters.corendonLowest += 1;
      return new Response(okLowestBody(), { status: 200 });
    }
    if (url.includes('upsales')) {
      return new Response(okUpsalesBody(), { status: 200 });
    }
    return new Response('unexpected', { status: 404 });
  };
}

async function runPage1AndMatchsetOverlap(
  offer: TravelOffer,
  params: { adults: number } & Record<string, unknown>,
  fetchImpl: typeof fetch,
): Promise<void> {
  const page1 = startCatalogPageLiveOverlays([offer], params as never, { fetchImpl });
  const matchset = priceLiveRequiredMatchset([offer], params as never, { fetchImpl });
  await Promise.all([Promise.all(page1.map((row) => row.live)), matchset]);
}

test('B3 Sunweb: identical concurrent page1+matchset → one PromotedPrice (+ one landing)', async () => {
  const counters = createCounters();
  const fetchImpl = makeProviderFetch(counters);
  await runPage1AndMatchsetOverlap(makeSunweb(), { adults: 2 }, fetchImpl);
  assert.equal(counters.sunwebPromoted, 1);
  assert.equal(counters.sunwebLanding, 1);
});

test('B3 Eliza: identical concurrent page1+matchset → one PromotedPrice (+ one landing)', async () => {
  const counters = createCounters();
  const fetchImpl = makeProviderFetch(counters);
  await runPage1AndMatchsetOverlap(makeEliza(), { adults: 2 }, fetchImpl);
  assert.equal(counters.elizaPromoted, 1);
  assert.equal(counters.elizaLanding, 1);
});

test('B3 Corendon: identical concurrent page1+matchset → one lowestpricesacco', async () => {
  const counters = createCounters();
  const fetchImpl = makeProviderFetch(counters);
  await runPage1AndMatchsetOverlap(makeCorendon(), { adults: 2 }, fetchImpl);
  assert.equal(counters.corendonLowest, 1);
});

test('B3 Sunweb: different occupancy keys stay separate (2 calls)', async () => {
  const counters = createCounters();
  const fetchImpl = makeProviderFetch(counters);
  await Promise.all(
    startCatalogPageLiveOverlays([makeSunweb()], { adults: 2 }, { fetchImpl }).map((r) => r.live),
  );
  await Promise.all(
    startCatalogPageLiveOverlays([makeSunweb()], PARTY_2A_1C, { fetchImpl }).map((r) => r.live),
  );
  assert.equal(counters.sunwebPromoted, 2);
});

test('B3 Eliza: different occupancy keys stay separate (2 calls)', async () => {
  const counters = createCounters();
  const fetchImpl = makeProviderFetch(counters);
  await Promise.all(
    startCatalogPageLiveOverlays([makeEliza()], { adults: 2 }, { fetchImpl }).map((r) => r.live),
  );
  await Promise.all(
    startCatalogPageLiveOverlays([makeEliza()], PARTY_2A_1C, { fetchImpl }).map((r) => r.live),
  );
  assert.equal(counters.elizaPromoted, 2);
});

test('B3 Corendon: different occupancy keys stay separate (2 lowest calls)', async () => {
  const counters = createCounters();
  const fetchImpl = makeProviderFetch(counters);
  await Promise.all(
    startCatalogPageLiveOverlays([makeCorendon()], { adults: 2 }, { fetchImpl }).map((r) => r.live),
  );
  await Promise.all(
    startCatalogPageLiveOverlays([makeCorendon()], PARTY_2A_1C, { fetchImpl }).map((r) => r.live),
  );
  assert.equal(counters.corendonLowest, 2);
});
