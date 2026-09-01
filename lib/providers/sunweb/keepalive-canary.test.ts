/**
 * Sunweb keep-alive canary — flag, host gate, singleton pool.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  assertSunwebKeepAliveHostOrThrow,
  extractSunwebTransportErrorCode,
  getSunwebKeepAliveAgentForTests,
  getSunwebKeepAliveObservability,
  getSunwebKeepAliveStatsForTests,
  getSunwebTransportFetch,
  isSunwebKeepAliveCanaryEnabled,
  isSunwebKeepAliveHost,
  resetSunwebKeepAliveForTests,
  resolveSunwebFetchImpl,
} from '../../http/sunweb-keepalive-agent';
import { SUNWEB_FE_HOST, SUNWEB_KEEPALIVE_ENV } from './constants';
import { fetchSunwebPromotedPrice } from './promoted-price-client';
import type { SunwebLiveContext } from './offer-context';
import {
  SUNWEB_LANDING_HTML,
  echoGroupedPricesFromUrl,
  okPromotedBody,
} from './promoted-price-client.test';
import { clearLivePriceStepTelemetryForTests, getLivePriceStepTelemetrySnapshot } from '../live-price-step-telemetry';
import { resetContextItemIdCacheForTests } from '../context-item-id-cache';

afterEach(() => {
  resetSunwebKeepAliveForTests();
  resetContextItemIdCacheForTests();
  clearLivePriceStepTelemetryForTests();
  delete process.env[SUNWEB_KEEPALIVE_ENV];
});

test('flag OFF by default and for non-1 values', () => {
  assert.equal(isSunwebKeepAliveCanaryEnabled({}), false);
  assert.equal(isSunwebKeepAliveCanaryEnabled({ [SUNWEB_KEEPALIVE_ENV]: '' }), false);
  assert.equal(isSunwebKeepAliveCanaryEnabled({ [SUNWEB_KEEPALIVE_ENV]: '0' }), false);
  assert.equal(isSunwebKeepAliveCanaryEnabled({ [SUNWEB_KEEPALIVE_ENV]: 'true' }), false);
  assert.equal(isSunwebKeepAliveCanaryEnabled({ [SUNWEB_KEEPALIVE_ENV]: '1' }), true);
});

test('flag OFF → getSunwebTransportFetch is global fetch', () => {
  delete process.env[SUNWEB_KEEPALIVE_ENV];
  assert.equal(getSunwebTransportFetch(), fetch);
  assert.equal(resolveSunwebFetchImpl(), fetch);
  assert.equal(resolveSunwebFetchImpl(fetch), fetch);
});

test('flag ON → getSunwebTransportFetch is not global fetch', () => {
  process.env[SUNWEB_KEEPALIVE_ENV] = '1';
  const transport = getSunwebTransportFetch();
  assert.notEqual(transport, fetch);
  assert.equal(resolveSunwebFetchImpl(), transport);
  assert.equal(resolveSunwebFetchImpl(fetch), transport);
});

test('explicit mock fetchImpl wins over canary', () => {
  process.env[SUNWEB_KEEPALIVE_ENV] = '1';
  const mock: typeof fetch = async () => new Response('x');
  assert.equal(resolveSunwebFetchImpl(mock), mock);
});

test('host gate allows only www.sunweb.be', () => {
  assert.equal(isSunwebKeepAliveHost(SUNWEB_FE_HOST), true);
  assert.equal(isSunwebKeepAliveHost('www.elizawashere.be'), false);
  assert.equal(isSunwebKeepAliveHost('api-fe.corendonresources.com'), false);
  assert.equal(isSunwebKeepAliveHost(null), false);
  assert.throws(() => assertSunwebKeepAliveHostOrThrow('www.elizawashere.be'), /host gate/);
  assert.doesNotThrow(() => assertSunwebKeepAliveHostOrThrow(SUNWEB_FE_HOST));
});

test('keep-alive FetchLike refuses non-Sunweb hosts', async () => {
  process.env[SUNWEB_KEEPALIVE_ENV] = '1';
  const transport = getSunwebTransportFetch();
  await assert.rejects(
    async () => {
      await transport('https://www.elizawashere.be/nl/vakantie', { method: 'GET' });
    },
    (err: unknown) => err instanceof Error && /host gate/.test(err.message),
  );
  assert.equal(getSunwebKeepAliveStatsForTests().httpRequests, 0);
});

test('singleton agent: multiple resolve calls reuse same agent instance', () => {
  process.env[SUNWEB_KEEPALIVE_ENV] = '1';
  assert.equal(getSunwebKeepAliveAgentForTests(), null);
  const a = getSunwebTransportFetch();
  const agent1 = getSunwebKeepAliveAgentForTests();
  assert.ok(agent1);
  const b = getSunwebTransportFetch();
  const agent2 = getSunwebKeepAliveAgentForTests();
  assert.equal(a, b);
  assert.equal(agent1, agent2);
  const obs = getSunwebKeepAliveObservability();
  assert.equal(obs.canaryEnabled, true);
  assert.equal(obs.host, SUNWEB_FE_HOST);
});

test('resetSunwebKeepAliveForTests destroys agent (lifecycle not per-request)', () => {
  process.env[SUNWEB_KEEPALIVE_ENV] = '1';
  getSunwebTransportFetch();
  assert.ok(getSunwebKeepAliveAgentForTests());
  resetSunwebKeepAliveForTests();
  assert.equal(getSunwebKeepAliveAgentForTests(), null);
});

test('extractSunwebTransportErrorCode reads UND_ERR_CONNECT_TIMEOUT from cause', () => {
  const err = Object.assign(new TypeError('fetch failed'), {
    cause: Object.assign(new Error('Connect Timeout Error'), {
      name: 'ConnectTimeoutError',
      code: 'UND_ERR_CONNECT_TIMEOUT',
    }),
  });
  assert.equal(extractSunwebTransportErrorCode(err), 'UND_ERR_CONNECT_TIMEOUT');
});

test('network_error records transportErrorCode in step telemetry (fail-closed)', async () => {
  const ctx: SunwebLiveContext = {
    accoId: '84012',
    landingUrl:
      'https://www.sunweb.be/nl/vakantie/griekenland/kos/kos-stad/appartementen-bristol-seaview' +
      '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
      '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-09-26' +
      '&Participants[0][0]=1990-01-15&Participants[0][1]=1988-03-03',
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
      ],
    },
  };

  const boom = Object.assign(new TypeError('fetch failed'), {
    cause: { name: 'ConnectTimeoutError', code: 'UND_ERR_CONNECT_TIMEOUT' },
  });

  const result = await fetchSunwebPromotedPrice(ctx, {
    fetchImpl: async () => {
      throw boom;
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'network_error');
  }
  const snap = getLivePriceStepTelemetrySnapshot().byProvider.sunweb;
  assert.equal(snap.byReason.network_error, 1);
  assert.equal(snap.byTransportErrorCode.UND_ERR_CONNECT_TIMEOUT, 1);
});

test('existing happy path still works with explicit mock when canary ON', async () => {
  process.env[SUNWEB_KEEPALIVE_ENV] = '1';
  const ctx: SunwebLiveContext = {
    accoId: '84012',
    landingUrl:
      'https://www.sunweb.be/nl/vakantie/griekenland/kos/kos-stad/appartementen-bristol-seaview' +
      '?Duration[0]=8&TransportType[0]=Flight&Mealplan[0]=LG' +
      '&DepartureAirport[0]=BRU&DepartureDate[0]=2026-09-26' +
      '&Participants[0][0]=1990-01-15&Participants[0][1]=1988-03-03',
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
      ],
    },
  };

  const result = await fetchSunwebPromotedPrice(ctx, {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('GetPricesGroupedByDurationApi')) {
        return new Response(echoGroupedPricesFromUrl(url), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('GetPromotedPriceApi')) {
        return new Response(okPromotedBody({}), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(SUNWEB_LANDING_HTML, { status: 200 });
    },
  });
  assert.equal(result.ok, true);
  // Canary fetch not used — mock inject; agent may still be lazy-created only if transport was resolved
  assert.equal(getSunwebKeepAliveStatsForTests().httpRequests, 0);
});
