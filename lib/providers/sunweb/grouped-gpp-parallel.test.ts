import assert from 'node:assert/strict';
import test from 'node:test';
import { resetContextItemIdCacheForTests } from '../context-item-id-cache';
import {
  clearLivePriceStepTelemetryForTests,
  getLivePriceStepTelemetrySnapshot,
} from '../live-price-step-telemetry';
import {
  SUNWEB_GROUPED_GPP_PARALLEL_ENV,
  SUNWEB_LIVE_PAGE1_CONCURRENCY,
  isSunwebGroupedGppParallelEnabled,
} from './constants';
import type { SunwebLiveContext } from './offer-context';
import { fetchSunwebPromotedPrice } from './promoted-price-client';

const CONTEXT_ITEM_ID = 'c1440175-b6ef-4dd3-b7ea-96c7143d47ea';
const PROMOTED_PRICE_ID = 'D07B99C8-DFE0-4B7A-86C5-B4DE9A4C6077';
const BOOKING_GATE_ID = 'D7AF6C79-A074-4724-8595-F0A5DE507A04';

const SUNWEB_LANDING_HTML =
  JSON.stringify({
    template: 'AccommodationPage',
    contextItemId: CONTEXT_ITEM_ID,
  }) +
  `"PDP.bookingGateId":"${BOOKING_GATE_ID}"` +
  `"PDP.promotedPriceId":"${PROMOTED_PRICE_ID}"`;

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

function echoGroupedPricesFromUrl(url: string): string {
  const parsed = new URL(url);
  const departureDate = parsed.searchParams.get('DepartureDate[0]') ?? '';
  const duration = parsed.searchParams.get('Duration[0]') ?? '';
  const mealplan = parsed.searchParams.get('Mealplan') ?? '';
  const transportType = parsed.searchParams.get('TransportType') ?? 'Flight';
  return okGroupedPricesBody([
    { departureDate, duration, mealplan, transportType },
  ]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ctx(): SunwebLiveContext {
  return {
    accoId: '84012',
    landingUrl:
      'https://www.sunweb.be/nl/vakantie/griekenland/kos/kos-stad/appartementen-bristol-seaview' +
      '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
      '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-09-26' +
      '&Participants[0][0]=1990-01-15&Participants[0][1]=1988-03-03' +
      '&Participants[1][0]=2014-06-14&Participants[1][1]=2018-01-22',
    feHost: 'www.sunweb.be',
    query: {
      accoId: '84012',
      departureDate: '2026-09-26',
      departureAirport: 'BRU',
      duration: '8',
      mealplan: 'LG',
      transportType: 'Flight',
      month: '2026-09',
      participants: [
        { key: 'Participants[0][0]', value: '1990-01-15' },
        { key: 'Participants[0][1]', value: '1988-03-03' },
        { key: 'Participants[1][0]', value: '2014-06-14' },
        { key: 'Participants[1][1]', value: '2018-01-22' },
      ],
    },
  };
}

function baseFetch(options: {
  groupedDelayMs?: number;
  gppDelayMs?: number;
  groupedBody?: string;
  priceBody?: string;
  onGroupedStart?: () => void;
  onGppStart?: () => void;
  onGroupedEnd?: () => void;
  onGppEnd?: () => void;
}): typeof fetch {
  return async (input) => {
    const url = String(input);
    if (url.includes('GetPromotedPriceApi')) {
      options.onGppStart?.();
      if (options.gppDelayMs) {
        await sleep(options.gppDelayMs);
      }
      options.onGppEnd?.();
      return new Response(options.priceBody ?? okPromotedBody({ averagePrice: 621 }), { status: 200 });
    }
    if (url.includes('GetPricesGroupedByDurationApi')) {
      options.onGroupedStart?.();
      if (options.groupedDelayMs) {
        await sleep(options.groupedDelayMs);
      }
      options.onGroupedEnd?.();
      return new Response(
        options.groupedBody ?? echoGroupedPricesFromUrl(url),
        { status: 200 },
      );
    }
    return new Response(SUNWEB_LANDING_HTML, { status: 200 });
  };
}

test.beforeEach(() => {
  resetContextItemIdCacheForTests();
  clearLivePriceStepTelemetryForTests();
  delete process.env[SUNWEB_GROUPED_GPP_PARALLEL_ENV];
});

test('L4 flag default OFF', () => {
  assert.equal(isSunwebGroupedGppParallelEnabled({}), false);
  assert.equal(isSunwebGroupedGppParallelEnabled({ [SUNWEB_GROUPED_GPP_PARALLEL_ENV]: '' }), false);
  assert.equal(isSunwebGroupedGppParallelEnabled({ [SUNWEB_GROUPED_GPP_PARALLEL_ENV]: '0' }), false);
  assert.equal(isSunwebGroupedGppParallelEnabled({ [SUNWEB_GROUPED_GPP_PARALLEL_ENV]: 'true' }), false);
  assert.equal(isSunwebGroupedGppParallelEnabled({ [SUNWEB_GROUPED_GPP_PARALLEL_ENV]: '1' }), true);
});

test('L4 C=5 unchanged', () => {
  assert.equal(SUNWEB_LIVE_PAGE1_CONCURRENCY, 5);
});

test('L4 flag OFF: grouped completes before GPP starts (sequential)', async () => {
  let groupedEnd = 0;
  let gppStart = 0;
  const result = await fetchSunwebPromotedPrice(ctx(), {
    todayIso: '2026-08-01',
    fetchImpl: baseFetch({
      groupedDelayMs: 40,
      gppDelayMs: 10,
      onGroupedEnd: () => {
        groupedEnd = performance.now();
      },
      onGppStart: () => {
        gppStart = performance.now();
      },
    }),
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pricePerPerson, 621);
  }
  assert.ok(gppStart >= groupedEnd);
});

test('L4 flag ON: grouped and GPP overlap (parallel start)', async () => {
  process.env[SUNWEB_GROUPED_GPP_PARALLEL_ENV] = '1';
  let groupedStart = 0;
  let gppStart = 0;
  const result = await fetchSunwebPromotedPrice(ctx(), {
    todayIso: '2026-08-01',
    fetchImpl: baseFetch({
      groupedDelayMs: 60,
      gppDelayMs: 60,
      onGroupedStart: () => {
        groupedStart = performance.now();
      },
      onGppStart: () => {
        gppStart = performance.now();
      },
    }),
  });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(gppStart - groupedStart) < 30, 'parallel starts should overlap');
});

test('L4 flag ON: grouped failure fail-closed even when GPP would succeed', async () => {
  process.env[SUNWEB_GROUPED_GPP_PARALLEL_ENV] = '1';
  let gppCalls = 0;
  const result = await fetchSunwebPromotedPrice(ctx(), {
    todayIso: '2026-08-01',
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('GetPromotedPriceApi')) {
        gppCalls += 1;
        return new Response(okPromotedBody({ averagePrice: 999 }), { status: 200 });
      }
      if (url.includes('GetPricesGroupedByDurationApi')) {
        return new Response(
          okGroupedPricesBody([
            { departureDate: '2026-10-01', duration: 8, mealplan: 'LG' },
          ]),
          { status: 200 },
        );
      }
      return new Response(SUNWEB_LANDING_HTML, { status: 200 });
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
  assert.equal(gppCalls, 1, 'GPP may run in parallel but result must be discarded');
});

test('L4 flag ON: GPP failure after grouped ok', async () => {
  process.env[SUNWEB_GROUPED_GPP_PARALLEL_ENV] = '1';
  const result = await fetchSunwebPromotedPrice(ctx(), {
    todayIso: '2026-08-01',
    fetchImpl: baseFetch({
      priceBody: okPromotedBody({ averagePrice: 0 }),
    }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'invalid_price');
  }
});

test('L4 flag ON: stale_context still triggers landing fallback', async () => {
  process.env[SUNWEB_GROUPED_GPP_PARALLEL_ENV] = '1';
  resetContextItemIdCacheForTests();
  const {
    setCachedContextItemId,
    setSitecoreSiteGuidConfig,
    getContextItemIdCacheStats,
  } = await import('../context-item-id-cache');

  setSitecoreSiteGuidConfig('sunweb', {
    promotedPriceId: 'D07B99C8-DFE0-4B7A-86C5-B4DE9A4C6077',
    bookingGateId: 'D7AF6C79-A074-4724-8595-F0A5DE507A04',
  });
  setCachedContextItemId('sunweb', 'www.sunweb.be', '84012', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');

  let landingCalls = 0;
  let priceRound = 0;
  const result = await fetchSunwebPromotedPrice(ctx(), {
    todayIso: '2026-08-01',
    fetchImpl: async (input) => {
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
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pricePerPerson, 621);
  }
  assert.equal(landingCalls, 1);
  assert.equal(getContextItemIdCacheStats().landingFallbacks, 1);
});

test('L4 flag OFF: grouped failure skips GPP entirely (sequential)', async () => {
  let gppCalls = 0;
  const result = await fetchSunwebPromotedPrice(ctx(), {
    todayIso: '2026-08-01',
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('GetPromotedPriceApi')) {
        gppCalls += 1;
        return new Response(okPromotedBody({ averagePrice: 999 }), { status: 200 });
      }
      if (url.includes('GetPricesGroupedByDurationApi')) {
        return new Response(
          okGroupedPricesBody([
            { departureDate: '2026-10-01', duration: 8, mealplan: 'LG' },
          ]),
          { status: 200 },
        );
      }
      return new Response(SUNWEB_LANDING_HTML, { status: 200 });
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
  assert.equal(gppCalls, 0);
});

test('L4 flag ON: both grouped and GPP fail → grouped reason wins', async () => {
  process.env[SUNWEB_GROUPED_GPP_PARALLEL_ENV] = '1';
  const result = await fetchSunwebPromotedPrice(ctx(), {
    todayIso: '2026-08-01',
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('GetPromotedPriceApi')) {
        return new Response(null, { status: 500 });
      }
      if (url.includes('GetPricesGroupedByDurationApi')) {
        return new Response(
          okGroupedPricesBody([
            { departureDate: '2026-10-01', duration: 8, mealplan: 'LG' },
          ]),
          { status: 200 },
        );
      }
      return new Response(SUNWEB_LANDING_HTML, { status: 200 });
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'unavailable_trip');
  }
});

test('L4 flag ON: exact-trip mismatch stays fail-closed (stale_context)', async () => {
  process.env[SUNWEB_GROUPED_GPP_PARALLEL_ENV] = '1';
  const result = await fetchSunwebPromotedPrice(ctx(), {
    todayIso: '2026-08-01',
    fetchImpl: baseFetch({
      priceBody: okPromotedBody({ departureDate: '2026-12-01' }),
    }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'stale_context');
  }
});

test('L4 reversed-order correctness: sequential OFF vs parallel ON same price', async () => {
  const liveCtx = ctx();

  delete process.env[SUNWEB_GROUPED_GPP_PARALLEL_ENV];
  const sequential = await fetchSunwebPromotedPrice(liveCtx, {
    todayIso: '2026-08-01',
    fetchImpl: baseFetch({ priceBody: okPromotedBody({ averagePrice: 621 }) }),
  });

  resetContextItemIdCacheForTests();
  process.env[SUNWEB_GROUPED_GPP_PARALLEL_ENV] = '1';
  const parallel = await fetchSunwebPromotedPrice(liveCtx, {
    todayIso: '2026-08-01',
    fetchImpl: baseFetch({ priceBody: okPromotedBody({ averagePrice: 621 }) }),
  });

  assert.equal(sequential.ok, true);
  assert.equal(parallel.ok, true);
  if (sequential.ok && parallel.ok) {
    assert.equal(sequential.pricePerPerson, parallel.pricePerPerson);
    assert.equal(sequential.accoId, parallel.accoId);
  }
});

test('L4 latency: parallel totalMs lower than sequential with equal step delays', async () => {
  const liveCtx = ctx();
  const delayMs = 50;

  delete process.env[SUNWEB_GROUPED_GPP_PARALLEL_ENV];
  clearLivePriceStepTelemetryForTests();
  await fetchSunwebPromotedPrice(liveCtx, {
    todayIso: '2026-08-01',
    fetchImpl: baseFetch({ groupedDelayMs: delayMs, gppDelayMs: delayMs }),
  });
  const sequentialTotal = getLivePriceStepTelemetrySnapshot().byProvider.sunweb.totalMs?.p50 ?? 0;

  resetContextItemIdCacheForTests();
  clearLivePriceStepTelemetryForTests();
  process.env[SUNWEB_GROUPED_GPP_PARALLEL_ENV] = '1';
  await fetchSunwebPromotedPrice(liveCtx, {
    todayIso: '2026-08-01',
    fetchImpl: baseFetch({ groupedDelayMs: delayMs, gppDelayMs: delayMs }),
  });
  const parallelTotal = getLivePriceStepTelemetrySnapshot().byProvider.sunweb.totalMs?.p50 ?? 0;

  assert.ok(parallelTotal < sequentialTotal);
  assert.ok(parallelTotal >= delayMs);
  assert.ok(sequentialTotal >= delayMs * 2 - 5);
});

test('L4 flag ON records groupedMs and gppMs in telemetry', async () => {
  process.env[SUNWEB_GROUPED_GPP_PARALLEL_ENV] = '1';
  await fetchSunwebPromotedPrice(ctx(), {
    todayIso: '2026-08-01',
    fetchImpl: baseFetch({ groupedDelayMs: 20, gppDelayMs: 20 }),
  });
  const snap = getLivePriceStepTelemetrySnapshot().byProvider.sunweb;
  assert.equal(snap.events, 1);
  assert.ok(snap.groupedMs && snap.groupedMs.n === 1);
  assert.ok(snap.gppMs && snap.gppMs.n === 1);
});
