/**
 * Fase L0 — step telemetry records timings without changing price outcomes.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { resetContextItemIdCacheForTests } from './context-item-id-cache';
import {
  clearLivePriceStepTelemetryForTests,
  getLivePriceStepTelemetrySnapshot,
} from './live-price-step-telemetry';
import {
  ELIZA_LANDING_HTML,
  okPromotedBody as okElizaPromotedBody,
} from './eliza/promoted-price-client.test';
import { fetchElizaPromotedPrice } from './eliza/promoted-price-client';
import type { ElizaLiveContext } from './eliza/offer-context';
import { ELIZA_FE_HOST, ELIZA_LIVE_PAGE1_CONCURRENCY } from './eliza/constants';
import {
  SUNWEB_LANDING_HTML,
  echoGroupedPricesFromUrl,
  okPromotedBody as okSunwebPromotedBody,
} from './sunweb/promoted-price-client.test';
import { fetchSunwebPromotedPrice } from './sunweb/promoted-price-client';
import type { SunwebLiveContext } from './sunweb/offer-context';
import { SUNWEB_FE_HOST, SUNWEB_LIVE_PAGE1_CONCURRENCY } from './sunweb/constants';
import { CONTEXT_ITEM_ID_CACHE_TTL_MS } from './context-item-id-cache';

afterEach(() => {
  resetContextItemIdCacheForTests();
  clearLivePriceStepTelemetryForTests();
});

function sunwebCtx(): SunwebLiveContext {
  return {
    accoId: '84012',
    landingUrl:
      'https://www.sunweb.be/nl/vakantie/griekenland/kos/kos-stad/appartementen-bristol-seaview' +
      '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
      '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-09-26' +
      '&Participants[0][0]=1990-01-15&Participants[0][1]=1988-03-03' +
      '&Participants[1][0]=2014-06-14&Participants[1][1]=2018-01-22',
    feHost: SUNWEB_FE_HOST,
    query: {
      accoId: '84012',
      departureDate: '2026-09-26',
      departureAirport: 'BRU',
      duration: '8',
      mealplan: 'LG',
      transportType: 'Flight',
      month: '9',
      participants: [
        { key: 'Participants[0][0]', value: '1990-01-15' },
        { key: 'Participants[0][1]', value: '1988-03-03' },
        { key: 'Participants[1][0]', value: '2014-06-14' },
        { key: 'Participants[1][1]', value: '2018-01-22' },
      ],
    },
  };
}

function elizaCtx(): ElizaLiveContext {
  return {
    accoId: '6270665',
    landingUrl:
      'https://www.elizawashere.be/nl/vakantie/spanje/costa-blanca/benidorm/hotel-example' +
      '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
      '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-11-19' +
      '&Participants[0][0]=1996-07-30&Participants[0][1]=1996-07-30',
    feHost: ELIZA_FE_HOST,
    query: {
      accoId: '6270665',
      departureDate: '2026-11-19',
      departureAirport: 'BRU',
      duration: '8',
      mealplan: 'LG',
      transportType: 'Flight',
      month: '2026-11',
      participants: [
        { key: 'Participants[0][0]', value: '1996-07-30' },
        { key: 'Participants[0][1]', value: '1996-07-30' },
      ],
    },
  };
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

test('L0 baseline knobs remain C=5 and TTL=10s (L3)', () => {
  assert.equal(SUNWEB_LIVE_PAGE1_CONCURRENCY, 5);
  assert.equal(ELIZA_LIVE_PAGE1_CONCURRENCY, 5);
  assert.equal(CONTEXT_ITEM_ID_CACHE_TTL_MS, 10_000);
});

test('L0 Sunweb records landing+grouped+gpp timings without changing success price', async () => {
  const result = await fetchSunwebPromotedPrice(sunwebCtx(), {
    todayIso: '2026-08-01',
    fetchImpl: async (input) => {
      const url = urlOf(input);
      if (url.includes('GetPricesGroupedByDurationApi')) {
        return new Response(echoGroupedPricesFromUrl(url), { status: 200 });
      }
      if (url.includes('GetPromotedPriceApi')) {
        return new Response(okSunwebPromotedBody({ averagePrice: 412, totalPrice: 1648 }), {
          status: 200,
        });
      }
      return new Response(SUNWEB_LANDING_HTML, { status: 200 });
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pricePerPerson, 412);
  }

  const snap = getLivePriceStepTelemetrySnapshot();
  assert.equal(snap.baseline.sunwebPage1Concurrency, 5);
  assert.equal(snap.baseline.contextItemIdCacheTtlMs, 10_000);
  const sun = snap.byProvider.sunweb;
  assert.equal(sun.events, 1);
  assert.equal(sun.ok, 1);
  assert.equal(sun.http429, 0);
  assert.equal(sun.landingFetched, 1);
  assert.ok(sun.landingMs && sun.landingMs.n === 1);
  assert.ok(sun.groupedMs && sun.groupedMs.n === 1);
  assert.ok(sun.gppMs && sun.gppMs.n === 1);
  assert.ok(sun.totalMs && sun.totalMs.n === 1);
});

test('L0 Sunweb counts HTTP 429 on GPP without altering fail-closed result', async () => {
  const result = await fetchSunwebPromotedPrice(sunwebCtx(), {
    todayIso: '2026-08-01',
    fetchImpl: async (input) => {
      const url = urlOf(input);
      if (url.includes('GetPricesGroupedByDurationApi')) {
        return new Response(echoGroupedPricesFromUrl(url), { status: 200 });
      }
      if (url.includes('GetPromotedPriceApi')) {
        return new Response('rate limited', { status: 429 });
      }
      return new Response(SUNWEB_LANDING_HTML, { status: 200 });
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'http_error');
    assert.equal(result.httpStatus, 429);
  }
  const sun = getLivePriceStepTelemetrySnapshot().byProvider.sunweb;
  assert.equal(sun.http429, 1);
  assert.equal(sun.fail, 1);
});

test('L0 Eliza records landing+gpp timings (no grouped step)', async () => {
  const result = await fetchElizaPromotedPrice(elizaCtx(), {
    fetchImpl: async (input) => {
      const url = urlOf(input);
      if (url.includes('GetPromotedPriceApi')) {
        return new Response(okElizaPromotedBody({ averagePrice: 501, totalPrice: 1002 }), {
          status: 200,
        });
      }
      return new Response(ELIZA_LANDING_HTML, { status: 200 });
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.pricePerPerson, 501);
  }
  const el = getLivePriceStepTelemetrySnapshot().byProvider.eliza;
  assert.equal(el.events, 1);
  assert.equal(el.ok, 1);
  assert.equal(el.landingFetched, 1);
  assert.equal(el.groupedMs, null);
  assert.ok(el.gppMs && el.gppMs.n === 1);
  assert.equal(getLivePriceStepTelemetrySnapshot().baseline.elizaPage1Concurrency, 5);
});
