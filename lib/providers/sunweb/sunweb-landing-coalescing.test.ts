/**
 * L5 — Sunweb acco-level landing coalescing (concurrent bootstrap dedup).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getContextItemIdCacheStats,
  resetContextItemIdCacheForTests,
  setCachedContextItemId,
  setSitecoreSiteGuidConfig,
} from '../context-item-id-cache';
import type { SunwebLiveContext } from './offer-context';
import { SUNWEB_FE_HOST } from './constants';
import {
  fetchSunwebPromotedPrice,
  getSunwebLandingCoalescingStatsForTests,
  resetSunwebLandingInflightForTests,
} from './promoted-price-client';

const CONTEXT_ITEM_ID = 'c1440175-b6ef-4dd3-b7ea-96c7143d47ea';
const PROMOTED_PRICE_ID = 'D07B99C8-DFE0-4B7A-86C5-B4DE9A4C6077';
const BOOKING_GATE_ID = 'D7AF6C79-A074-4724-8595-F0A5DE507A04';
const ACCO_ID = '84012';

const SUNWEB_LANDING_HTML =
  JSON.stringify({
    template: 'AccommodationPage',
    contextItemId: CONTEXT_ITEM_ID,
  }) +
  `"PDP.bookingGateId":"${BOOKING_GATE_ID}"` +
  `"PDP.promotedPriceId":"${PROMOTED_PRICE_ID}"`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
  const accoId = overrides.accoId ?? ACCO_ID;
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

function okGroupedPricesBody(
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

function okPromotedBody(overrides: {
  averagePrice?: number;
  accommodationId?: number | string;
  duration?: number;
  departureDate?: string;
  mealplan?: string;
} = {}): string {
  return JSON.stringify({
    accommodationId: overrides.accommodationId ?? 84012,
    duration: overrides.duration ?? 8,
    price: {
      totalPrice: 1674,
      averagePrice: overrides.averagePrice ?? 558,
      value: overrides.averagePrice ?? 558,
      legend: 'Vanafprijs p.p.',
    },
    departureDate: { raw: overrides.departureDate ?? '2026-09-26' },
    acmInformation: { mealplanCode: overrides.mealplan ?? 'LG' },
  });
}

function echoGroupedPricesFromUrl(url: string): string {
  const parsed = new URL(url);
  return okGroupedPricesBody([
    {
      departureDate: parsed.searchParams.get('DepartureDate[0]') ?? '',
      duration: parsed.searchParams.get('Duration[0]') ?? '8',
      mealplan: parsed.searchParams.get('Mealplan') ?? 'LG',
      transportType: parsed.searchParams.get('TransportType') ?? 'Flight',
    },
  ]);
}

function makeCoalescingFetch(options: {
  landingDelayMs?: number;
  priceByDate?: Record<string, number>;
  onLanding?: () => void;
}): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      const parsed = new URL(url);
      const date = parsed.searchParams.get('DepartureDate[0]') ?? '2026-09-26';
      const price = options.priceByDate?.[date] ?? 558;
      return new Response(
        okPromotedBody({ averagePrice: price, departureDate: date }),
        { status: 200 },
      );
    }
    if (url.includes('GetPricesGroupedByDurationApi')) {
      return new Response(echoGroupedPricesFromUrl(url), { status: 200 });
    }
    options.onLanding?.();
    if (options.landingDelayMs) {
      await sleep(options.landingDelayMs);
    }
    return new Response(SUNWEB_LANDING_HTML, { status: 200 });
  };
}

test.beforeEach(() => {
  resetContextItemIdCacheForTests();
  resetSunwebLandingInflightForTests();
});

test('L5: same acco + same pricing-context concurrent → one landing', async () => {
  let landingCalls = 0;
  const liveCtx = ctx();
  const fetchImpl = makeCoalescingFetch({
    landingDelayMs: 30,
    onLanding: () => {
      landingCalls += 1;
    },
  });

  const results = await Promise.all([
    fetchSunwebPromotedPrice(liveCtx, { todayIso: '2026-08-01', fetchImpl }),
    fetchSunwebPromotedPrice(liveCtx, { todayIso: '2026-08-01', fetchImpl }),
  ]);

  assert.equal(landingCalls, 1);
  assert.equal(getSunwebLandingCoalescingStatsForTests().inflightJoined, 1);
  assert.ok(results.every((r) => r.ok));
});

test('L5: same acco + different date concurrent → one landing, correct prices each', async () => {
  let landingCalls = 0;
  const fetchImpl = makeCoalescingFetch({
    landingDelayMs: 25,
    priceByDate: { '2026-09-10': 501, '2026-09-17': 502 },
    onLanding: () => {
      landingCalls += 1;
    },
  });

  const ctxA = ctx({ departureDate: '2026-09-10' });
  const ctxB = ctx({ departureDate: '2026-09-17' });
  const [resultA, resultB] = await Promise.all([
    fetchSunwebPromotedPrice(ctxA, { todayIso: '2026-08-01', fetchImpl }),
    fetchSunwebPromotedPrice(ctxB, { todayIso: '2026-08-01', fetchImpl }),
  ]);

  assert.equal(landingCalls, 1);
  assert.equal(resultA.ok, true);
  assert.equal(resultB.ok, true);
  if (resultA.ok && resultB.ok) {
    assert.equal(resultA.pricePerPerson, 501);
    assert.equal(resultB.pricePerPerson, 502);
  }
});

test('L5: same acco + different duration → one landing, trip-specific grouped gate', async () => {
  let landingCalls = 0;
  const fetchImpl = makeCoalescingFetch({
    onLanding: () => {
      landingCalls += 1;
    },
  });

  const ctx7 = ctx({ duration: '7', departureDate: '2026-09-10' });
  const ctx8 = ctx({ duration: '8', departureDate: '2026-09-10' });

  const fetchImplGroupedFail7: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('GetPricesGroupedByDurationApi')) {
      const duration = new URL(url).searchParams.get('Duration[0]');
      if (duration === '7') {
        return new Response(
          okGroupedPricesBody([{ departureDate: '2026-10-01', duration: 7, mealplan: 'LG' }]),
          { status: 200 },
        );
      }
      return new Response(echoGroupedPricesFromUrl(url), { status: 200 });
    }
    return fetchImpl(input);
  };

  const [result7, result8] = await Promise.all([
    fetchSunwebPromotedPrice(ctx7, { todayIso: '2026-08-01', fetchImpl: fetchImplGroupedFail7 }),
    fetchSunwebPromotedPrice(ctx8, { todayIso: '2026-08-01', fetchImpl: fetchImplGroupedFail7 }),
  ]);

  assert.equal(landingCalls, 1);
  assert.equal(result7.ok, false);
  assert.equal(result8.ok, true);
  if (!result7.ok) {
    assert.equal(result7.reason, 'unavailable_trip');
  }
});

test('L5: same acco + different mealplan → one landing, fail-closed per trip', async () => {
  let landingCalls = 0;
  const baseFetch = makeCoalescingFetch({
    onLanding: () => {
      landingCalls += 1;
    },
  });

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      const meal = new URL(url).searchParams.get('Mealplan') ?? 'LG';
      if (meal === 'AI') {
        return new Response(
          okPromotedBody({ averagePrice: 700, mealplan: 'AI', departureDate: '2026-09-10' }),
          { status: 200 },
        );
      }
      return new Response(
        okPromotedBody({ averagePrice: 600, mealplan: 'LG', departureDate: '2026-09-10' }),
        { status: 200 },
      );
    }
    return baseFetch(input);
  };

  const [lg, ai] = await Promise.all([
    fetchSunwebPromotedPrice(ctx({ mealplan: 'LG', departureDate: '2026-09-10' }), {
      todayIso: '2026-08-01',
      fetchImpl,
    }),
    fetchSunwebPromotedPrice(ctx({ mealplan: 'AI', departureDate: '2026-09-10' }), {
      todayIso: '2026-08-01',
      fetchImpl,
    }),
  ]);

  assert.equal(landingCalls, 1);
  assert.equal(lg.ok, true);
  assert.equal(ai.ok, true);
  if (lg.ok && ai.ok) {
    assert.equal(lg.pricePerPerson, 600);
    assert.equal(ai.pricePerPerson, 700);
  }
});

test('L5: same acco + different airport → one landing, airport-specific grouped', async () => {
  let landingCalls = 0;
  const fetchImpl = makeCoalescingFetch({
    onLanding: () => {
      landingCalls += 1;
    },
  });

  const fetchImplAirport: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('GetPricesGroupedByDurationApi')) {
      const airport = new URL(url).searchParams.get('DepartureAirport[0]');
      if (airport === 'CRL') {
        return new Response(
          okGroupedPricesBody([
            { departureDate: '2026-09-10', duration: 8, mealplan: 'LG', transportType: 'Flight' },
          ]),
          { status: 200 },
        );
      }
      return new Response(
        okGroupedPricesBody([
          { departureDate: '2026-10-01', duration: 8, mealplan: 'LG', transportType: 'Flight' },
        ]),
        { status: 200 },
      );
    }
    return fetchImpl(input);
  };

  const [bru, crl] = await Promise.all([
    fetchSunwebPromotedPrice(ctx({ departureAirport: 'BRU', departureDate: '2026-09-10' }), {
      todayIso: '2026-08-01',
      fetchImpl: fetchImplAirport,
    }),
    fetchSunwebPromotedPrice(ctx({ departureAirport: 'CRL', departureDate: '2026-09-10' }), {
      todayIso: '2026-08-01',
      fetchImpl: fetchImplAirport,
    }),
  ]);

  assert.equal(landingCalls, 1);
  assert.equal(crl.ok, true);
  assert.equal(bru.ok, false);
  if (!bru.ok) {
    assert.equal(bru.reason, 'unavailable_trip');
  }
});

test('L5: different accommodations → separate landings', async () => {
  let landingCalls = 0;
  const fetchImpl = makeCoalescingFetch({
    onLanding: () => {
      landingCalls += 1;
    },
  });

  await Promise.all([
    fetchSunwebPromotedPrice(ctx({ accoId: '84012' }), { todayIso: '2026-08-01', fetchImpl }),
    fetchSunwebPromotedPrice(ctx({ accoId: '84013' }), { todayIso: '2026-08-01', fetchImpl }),
  ]);

  assert.equal(landingCalls, 2);
});

test('L5: stale_context → invalidate + forceLanding + retry still works', async () => {
  setSitecoreSiteGuidConfig('sunweb', {
    promotedPriceId: PROMOTED_PRICE_ID,
    bookingGateId: BOOKING_GATE_ID,
  });
  setCachedContextItemId('sunweb', SUNWEB_FE_HOST, ACCO_ID, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');

  let landingCalls = 0;
  let priceRound = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      priceRound += 1;
      if (priceRound === 1) {
        return new Response(
          okPromotedBody({ accommodationId: 999, departureDate: '2026-12-01' }),
          { status: 200 },
        );
      }
      return new Response(okPromotedBody({ averagePrice: 621 }), { status: 200 });
    }
    if (url.includes('GetPricesGroupedByDurationApi')) {
      return new Response(echoGroupedPricesFromUrl(url), { status: 200 });
    }
    landingCalls += 1;
    return new Response(SUNWEB_LANDING_HTML, { status: 200 });
  };

  const result = await fetchSunwebPromotedPrice(ctx(), { todayIso: '2026-08-01', fetchImpl });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pricePerPerson, 621);
  }
  assert.equal(landingCalls, 1);
  assert.equal(getContextItemIdCacheStats().landingFallbacks, 1);
});

test('L5: cached context mismatch never presents wrong price', async () => {
  setSitecoreSiteGuidConfig('sunweb', {
    promotedPriceId: PROMOTED_PRICE_ID,
    bookingGateId: BOOKING_GATE_ID,
  });
  setCachedContextItemId('sunweb', SUNWEB_FE_HOST, ACCO_ID, CONTEXT_ITEM_ID);

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      return new Response(
        okPromotedBody({ averagePrice: 777, departureDate: '2026-12-01' }),
        { status: 200 },
      );
    }
    if (url.includes('GetPricesGroupedByDurationApi')) {
      return new Response(echoGroupedPricesFromUrl(url), { status: 200 });
    }
    return new Response(SUNWEB_LANDING_HTML, { status: 200 });
  };

  const result = await fetchSunwebPromotedPrice(ctx({ departureDate: '2026-09-10' }), {
    todayIso: '2026-08-01',
    fetchImpl,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'stale_context');
  }
});

test('L5 benchmark: three offers same acco concurrent → one landing', async () => {
  let landingCalls = 0;
  const fetchImpl = makeCoalescingFetch({
    landingDelayMs: 20,
    priceByDate: {
      '2026-09-10': 501,
      '2026-09-17': 502,
      '2026-09-24': 503,
    },
    onLanding: () => {
      landingCalls += 1;
    },
  });

  const offers = [
    ctx({ departureDate: '2026-09-10' }),
    ctx({ departureDate: '2026-09-17' }),
    ctx({ departureDate: '2026-09-24' }),
  ];

  const results = await Promise.all(
    offers.map((liveCtx) =>
      fetchSunwebPromotedPrice(liveCtx, { todayIso: '2026-08-01', fetchImpl }),
    ),
  );

  assert.equal(landingCalls, 1);
  assert.equal(getSunwebLandingCoalescingStatsForTests().inflightJoined, 2);
  assert.deepEqual(
    results.filter((r) => r.ok).map((r) => (r.ok ? r.pricePerPerson : null)),
    [501, 502, 503],
  );
});

test('L5: B3 offer-level inflight unchanged — sequential second hit uses cache not landing', async () => {
  let landingCalls = 0;
  const fetchImpl = makeCoalescingFetch({
    onLanding: () => {
      landingCalls += 1;
    },
  });
  const liveCtx = ctx();

  await fetchSunwebPromotedPrice(liveCtx, { todayIso: '2026-08-01', fetchImpl });
  await fetchSunwebPromotedPrice(liveCtx, { todayIso: '2026-08-01', fetchImpl });

  assert.equal(landingCalls, 1);
  assert.equal(getContextItemIdCacheStats().hits, 1);
});
