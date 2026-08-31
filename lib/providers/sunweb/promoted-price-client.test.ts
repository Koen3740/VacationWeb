import assert from 'node:assert/strict';
import test from 'node:test';
import { resetContextItemIdCacheForTests } from '../context-item-id-cache';
import {
  buildSunwebPromotedPriceUrl,
  extractSunwebLandingGuids,
  fetchSunwebPromotedPrice,
} from './promoted-price-client';
import type { SunwebLiveContext } from './offer-context';
import { SUNWEB_FE_HOST } from './constants';

test.beforeEach(() => {
  resetContextItemIdCacheForTests();
});

const CONTEXT_ITEM_ID = 'c1440175-b6ef-4dd3-b7ea-96c7143d47ea';
const PROMOTED_PRICE_ID = 'D07B99C8-DFE0-4B7A-86C5-B4DE9A4C6077';
const BOOKING_GATE_ID = 'D7AF6C79-A074-4724-8595-F0A5DE507A04';

export const SUNWEB_LANDING_HTML =
  JSON.stringify({
    template: 'AccommodationPage',
    contextItemId: CONTEXT_ITEM_ID,
  }) +
  `"PDP.bookingGateId":"${BOOKING_GATE_ID}"` +
  `"PDP.promotedPriceId":"${PROMOTED_PRICE_ID}"`;

function ctx(overrides: {
  accoId?: string;
  departureDate?: string;
  departureAirport?: string;
  duration?: string;
  mealplan?: string;
} = {}): SunwebLiveContext {
  const departureDate = overrides.departureDate ?? '2026-09-26';
  const departureAirport = overrides.departureAirport ?? 'BRU';
  const duration = overrides.duration ?? '8';
  const mealplan = overrides.mealplan ?? 'LG';
  const accoId = overrides.accoId ?? '84012';
  return {
    accoId,
    landingUrl:
      'https://www.sunweb.be/nl/vakantie/griekenland/kos/kos-stad/appartementen-bristol-seaview' +
      `?Duration[0]=${duration}&TransportType[0]=Flight&Mealplan[0]=${mealplan}` +
      `&DepartureAirport[0]=${departureAirport}&DepartureDate[0]=${departureDate}` +
      '&Participants[0][0]=1990-01-15&Participants[0][1]=1988-03-03' +
      '&Participants[1][0]=2014-06-14&Participants[1][1]=2018-01-22',
    feHost: SUNWEB_FE_HOST,
    query: {
      accoId,
      departureDate,
      departureAirport,
      duration,
      mealplan,
      transportType: 'Flight',
      month: departureDate.slice(0, 7),
      participants: [
        { key: 'Participants[0][0]', value: '1990-01-15' },
        { key: 'Participants[0][1]', value: '1988-03-03' },
        { key: 'Participants[1][0]', value: '2014-06-14' },
        { key: 'Participants[1][1]', value: '2018-01-22' },
      ],
    },
  };
}

export function okGroupedPricesBody(
  rows: Array<{
    departureDate: string;
    duration: number | string;
    mealplan: string;
    transportType?: string;
  }>,
): string {
  return JSON.stringify({
    errors: [],
    data: {
      isEmptyResponse: rows.length === 0,
      prices: rows.map((row) => ({
        minPricePerPerson: 387.62,
        averagePrice: 387.62,
        totalPrice: 775.24,
        duration: row.duration,
        transportType: row.transportType ?? 'Flight',
        mealplan: row.mealplan,
        departureDate: row.departureDate,
      })),
    },
  });
}

export function okPromotedBody(overrides: {
  averagePrice?: number;
  totalPrice?: number;
  accommodationId?: number | string;
  duration?: number;
  departureDate?: string;
  mealplan?: string;
} = {}): string {
  return JSON.stringify({
    accommodationId: overrides.accommodationId ?? 84012,
    duration: overrides.duration ?? 8,
    price: {
      totalPrice: overrides.totalPrice ?? 1674,
      averagePrice: overrides.averagePrice ?? 558,
      value: overrides.averagePrice ?? 558,
      legend: 'Vanafprijs p.p.',
    },
    departureDate: { raw: overrides.departureDate ?? '2026-09-26' },
    featuredFilters: ['8 dagen', '4 personen', 'Logies'],
    acmInformation: {
      mealplanCode: overrides.mealplan ?? 'LG',
    },
  });
}

export function echoGroupedPricesFromUrl(url: string): string {
  const parsed = new URL(url);
  const departureDate = parsed.searchParams.get('DepartureDate[0]') ?? '';
  const duration = parsed.searchParams.get('Duration[0]') ?? '';
  const mealplan = parsed.searchParams.get('Mealplan') ?? '';
  const transportType = parsed.searchParams.get('TransportType') ?? 'Flight';
  return okGroupedPricesBody([
    { departureDate, duration, mealplan, transportType },
  ]);
}

function makeFetch(options: {
  landingStatus?: number;
  landingBody?: string;
  groupedStatus?: number;
  groupedBody?: string | ((url: string) => string);
  priceStatus?: number;
  priceBody?: string | null;
  onLanding?: (url: string) => void;
  onGrouped?: (url: string) => void;
  onPrice?: (url: string) => void;
}): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      options.onPrice?.(url);
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
    options.onLanding?.(url);
    const status = options.landingStatus ?? 200;
    return new Response(options.landingBody ?? SUNWEB_LANDING_HTML, { status });
  };
}

test('extractSunwebLandingGuids: AccommodationPage contextItemId + PDP.promotedPriceId + PDP.bookingGateId', () => {
  const guids = extractSunwebLandingGuids(SUNWEB_LANDING_HTML);
  assert.ok(guids);
  assert.equal(guids.contextItemId, CONTEXT_ITEM_ID);
  assert.equal(guids.promotedPriceId, PROMOTED_PRICE_ID);
  assert.equal(guids.bookingGateId, BOOKING_GATE_ID);
  assert.equal(extractSunwebLandingGuids('<html></html>'), null);
  assert.equal(
    extractSunwebLandingGuids(
      JSON.stringify({ template: 'AccommodationPage', contextItemId: CONTEXT_ITEM_ID }) +
        `"PDP.promotedPriceId":"${PROMOTED_PRICE_ID}"`,
    ),
    null,
  );
  const unprefixed = extractSunwebLandingGuids(
    JSON.stringify({ template: 'AccommodationPage', contextItemId: CONTEXT_ITEM_ID }) +
      `"PDP.promotedPriceId":"${PROMOTED_PRICE_ID}"` +
      `"bookingGateId":"${BOOKING_GATE_ID}"`,
  );
  assert.equal(unprefixed?.bookingGateId, BOOKING_GATE_ID);
});

test('buildSunwebPromotedPriceUrl: proven query shape with party Participants', () => {
  const url = new URL(
    buildSunwebPromotedPriceUrl(ctx(), {
      contextItemId: CONTEXT_ITEM_ID,
      promotedPriceId: PROMOTED_PRICE_ID,
    }),
  );
  assert.equal(url.hostname, SUNWEB_FE_HOST);
  assert.equal(url.pathname, '/api/sitecore/PromotedPrice/GetPromotedPriceApi');
  assert.equal(url.searchParams.get('accoId'), '84012');
  assert.equal(url.searchParams.get('DepartureAirport[0]'), 'BRU');
  assert.equal(url.searchParams.get('DepartureDate[0]'), '2026-09-26');
  assert.equal(url.searchParams.get('Duration[0]'), '8');
  assert.equal(url.searchParams.get('Mealplan'), 'LG');
  assert.equal(url.searchParams.get('TransportType'), 'Flight');
  assert.equal(url.searchParams.get('Month'), '2026-09');
  assert.equal(url.searchParams.get('Participants[0][0]'), '1990-01-15');
  assert.equal(url.searchParams.get('Participants[0][1]'), '1988-03-03');
  assert.equal(url.searchParams.get('Participants[1][0]'), '2014-06-14');
  assert.equal(url.searchParams.get('Participants[1][1]'), '2018-01-22');
  assert.equal(url.searchParams.get('contextItemId'), CONTEXT_ITEM_ID);
  assert.equal(url.searchParams.get('promotedPriceId'), PROMOTED_PRICE_ID);
});

test('A. exact date available → GetPromotedPrice is allowed', async () => {
  let landingCalls = 0;
  let groupedCalls = 0;
  let priceCalls = 0;
  const result = await fetchSunwebPromotedPrice(ctx(), {
    fetchImpl: makeFetch({
      onLanding: () => {
        landingCalls += 1;
      },
      onGrouped: () => {
        groupedCalls += 1;
      },
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(landingCalls, 1);
  assert.equal(groupedCalls, 1);
  assert.equal(priceCalls, 1);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pricePerPerson, 558);
    assert.equal(result.totalPrice, 1674);
    assert.equal(result.accoId, '84012');
  }
});

test('B. exact date missing → GetPromotedPrice is not called', async () => {
  let priceCalls = 0;
  const result = await fetchSunwebPromotedPrice(ctx({ departureDate: '2026-10-21' }), {
    fetchImpl: makeFetch({
      groupedBody: okGroupedPricesBody([]),
      priceBody: okPromotedBody({ departureDate: '2026-10-22', averagePrice: 388 }),
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(priceCalls, 0);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
});

test('C. 29-09 present while 28-09 requested → 28-09 offer rejected, no GPP', async () => {
  let priceCalls = 0;
  const result = await fetchSunwebPromotedPrice(ctx({ departureDate: '2026-09-28' }), {
    fetchImpl: makeFetch({
      groupedBody: okGroupedPricesBody([
        { departureDate: '2026-09-29', duration: 8, mealplan: 'LG' },
      ]),
      priceBody: okPromotedBody({ departureDate: '2026-09-29' }),
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(priceCalls, 0);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
});

test('D. exact date but wrong duration → rejected, no GPP', async () => {
  let priceCalls = 0;
  const result = await fetchSunwebPromotedPrice(ctx({ duration: '8' }), {
    fetchImpl: makeFetch({
      groupedBody: okGroupedPricesBody([
        { departureDate: '2026-09-26', duration: 9, mealplan: 'LG' },
      ]),
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(priceCalls, 0);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
});

test('E. exact date but wrong mealplan → rejected, no GPP', async () => {
  let priceCalls = 0;
  const result = await fetchSunwebPromotedPrice(ctx({ mealplan: 'LO' }), {
    fetchImpl: makeFetch({
      groupedBody: okGroupedPricesBody([
        { departureDate: '2026-09-26', duration: 8, mealplan: 'HP' },
      ]),
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(priceCalls, 0);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
});

test('F. CRL-offer is not validated by BRU grouped data', async () => {
  let groupedUrl = '';
  let priceCalls = 0;
  const result = await fetchSunwebPromotedPrice(ctx({ departureAirport: 'CRL' }), {
    fetchImpl: makeFetch({
      groupedBody: (url) => {
        groupedUrl = url;
        const airport = new URL(url).searchParams.get('DepartureAirport[0]');
        if (airport === 'BRU') {
          return okGroupedPricesBody([
            { departureDate: '2026-09-26', duration: 8, mealplan: 'LG' },
          ]);
        }
        return okGroupedPricesBody([]);
      },
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(new URL(groupedUrl).searchParams.get('DepartureAirport[0]'), 'CRL');
  assert.equal(priceCalls, 0);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
});

test('G. BRU-offer is not validated by CRL grouped data', async () => {
  let groupedUrl = '';
  let priceCalls = 0;
  const result = await fetchSunwebPromotedPrice(ctx({ departureAirport: 'BRU' }), {
    fetchImpl: makeFetch({
      groupedBody: (url) => {
        groupedUrl = url;
        const airport = new URL(url).searchParams.get('DepartureAirport[0]');
        if (airport === 'CRL') {
          return okGroupedPricesBody([
            { departureDate: '2026-09-26', duration: 8, mealplan: 'LG' },
          ]);
        }
        return okGroupedPricesBody([]);
      },
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(new URL(groupedUrl).searchParams.get('DepartureAirport[0]'), 'BRU');
  assert.equal(priceCalls, 0);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
});

test('H. 4P/2R availability request sends Participants', async () => {
  let groupedUrl = '';
  const result = await fetchSunwebPromotedPrice(ctx(), {
    fetchImpl: makeFetch({
      onGrouped: (url) => {
        groupedUrl = url;
      },
    }),
  });
  assert.equal(result.ok, true);
  const grouped = new URL(groupedUrl);
  assert.equal(grouped.searchParams.get('Participants[0][0]'), '1990-01-15');
  assert.equal(grouped.searchParams.get('Participants[1][1]'), '2018-01-22');
});

test('I. GPP response with another date stays stale_context fail-closed', async () => {
  const result = await fetchSunwebPromotedPrice(ctx({ departureDate: '2026-10-21' }), {
    fetchImpl: makeFetch({
      groupedBody: okGroupedPricesBody([
        { departureDate: '2026-10-21', duration: 8, mealplan: 'LG' },
      ]),
      priceBody: okPromotedBody({ departureDate: '2026-10-22', averagePrice: 388 }),
    }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'stale_context');
  }
});

test('J. past date → no grouped call and no GPP', async () => {
  let groupedCalls = 0;
  let priceCalls = 0;
  let landingCalls = 0;
  const result = await fetchSunwebPromotedPrice(ctx({ departureDate: '2026-08-10' }), {
    todayIso: '2026-08-20',
    fetchImpl: makeFetch({
      onLanding: () => {
        landingCalls += 1;
      },
      onGrouped: () => {
        groupedCalls += 1;
      },
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(landingCalls, 0);
  assert.equal(groupedCalls, 0);
  assert.equal(priceCalls, 0);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
});

test('K. no availability proof / API failure → fail closed, no GPP', async () => {
  let priceCalls = 0;
  const httpFail = await fetchSunwebPromotedPrice(ctx(), {
    fetchImpl: makeFetch({
      groupedStatus: 500,
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(priceCalls, 0);
  assert.equal(httpFail.ok, false);
  if (!httpFail.ok) {
    assert.equal(httpFail.reason, 'http_error');
  }

  const unparseable = await fetchSunwebPromotedPrice(ctx(), {
    fetchImpl: makeFetch({
      groupedBody: '<html>not json</html>',
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(priceCalls, 0);
  assert.equal(unparseable.ok, false);
  if (!unparseable.ok) {
    assert.equal(unparseable.reason, 'empty');
  }
});

test('Alba 2026-10-21 CRL 8 LO: grouped miss → no GPP even if GPP would return 22-10', async () => {
  let priceCalls = 0;
  const result = await fetchSunwebPromotedPrice(
    ctx({
      accoId: '6143876',
      departureDate: '2026-10-21',
      departureAirport: 'CRL',
      duration: '8',
      mealplan: 'LO',
    }),
    {
      fetchImpl: makeFetch({
        groupedBody: okGroupedPricesBody([]),
        priceBody: okPromotedBody({
          accommodationId: 6143876,
          departureDate: '2026-10-22',
          mealplan: 'LO',
          averagePrice: 388,
        }),
        onPrice: () => {
          priceCalls += 1;
        },
      }),
    },
  );
  assert.equal(priceCalls, 0);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
});

test('Alba 2026-10-22 CRL 8 LO: available → proven GPP €388', async () => {
  const result = await fetchSunwebPromotedPrice(
    ctx({
      accoId: '6143876',
      departureDate: '2026-10-22',
      departureAirport: 'CRL',
      duration: '8',
      mealplan: 'LO',
    }),
    {
      fetchImpl: makeFetch({
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
      }),
    },
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pricePerPerson, 388);
  }
});

test('The Breeze 2026-09-08 CRL 8 AI: grouped miss → no GPP', async () => {
  let priceCalls = 0;
  const result = await fetchSunwebPromotedPrice(
    ctx({
      accoId: '6254500',
      departureDate: '2026-09-08',
      departureAirport: 'CRL',
      duration: '8',
      mealplan: 'AI',
    }),
    {
      fetchImpl: makeFetch({
        groupedBody: okGroupedPricesBody([
          { departureDate: '2026-09-30', duration: 8, mealplan: 'AI' },
        ]),
        priceBody: okPromotedBody({
          accommodationId: 6254500,
          departureDate: '2026-09-30',
          mealplan: 'AI',
          averagePrice: 490,
        }),
        onPrice: () => {
          priceCalls += 1;
        },
      }),
    },
  );
  assert.equal(priceCalls, 0);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
});

test('Aquamarina 2026-10-06 NRN 8 HP: available → proven GPP €398', async () => {
  const result = await fetchSunwebPromotedPrice(
    ctx({
      accoId: '39064',
      departureDate: '2026-10-06',
      departureAirport: 'NRN',
      duration: '8',
      mealplan: 'HP',
    }),
    {
      fetchImpl: makeFetch({
        groupedBody: okGroupedPricesBody([
          { departureDate: '2026-10-06', duration: 8, mealplan: 'HP' },
        ]),
        priceBody: okPromotedBody({
          accommodationId: 39064,
          departureDate: '2026-10-06',
          mealplan: 'HP',
          averagePrice: 398,
        }),
      }),
    },
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pricePerPerson, 398);
  }
});

test('fetch: HTTP 204 is empty, not a feed price', async () => {
  const result = await fetchSunwebPromotedPrice(ctx(), {
    fetchImpl: makeFetch({ priceStatus: 204 }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'empty');
    assert.equal(result.httpStatus, 204);
  }
});

test('fetch: API failure does not invent a price', async () => {
  const result = await fetchSunwebPromotedPrice(ctx(), {
    fetchImpl: makeFetch({ priceStatus: 500 }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'http_error');
  }
});

test('fetch: acco/date/duration/meal mismatch is stale_context', async () => {
  const result = await fetchSunwebPromotedPrice(ctx(), {
    fetchImpl: makeFetch({
      priceBody: okPromotedBody({ accommodationId: 999, departureDate: '2026-12-01' }),
    }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'stale_context');
  }
});

test('fetch: missing landing GUIDs does not call grouped or GPP', async () => {
  let groupedCalls = 0;
  let priceCalls = 0;
  const result = await fetchSunwebPromotedPrice(ctx(), {
    fetchImpl: makeFetch({
      landingBody: '<html>no guids</html>',
      onGrouped: () => {
        groupedCalls += 1;
      },
      onPrice: () => {
        priceCalls += 1;
      },
    }),
  });
  assert.equal(groupedCalls, 0);
  assert.equal(priceCalls, 0);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'missing_page_context');
  }
});

test('fetch: zero/invalid PromotedPrice is not presentable', async () => {
  const result = await fetchSunwebPromotedPrice(ctx(), {
    fetchImpl: makeFetch({ priceBody: okPromotedBody({ averagePrice: 0 }) }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'invalid_price');
  }
});
