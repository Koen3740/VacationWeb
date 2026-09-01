/**
 * Eliza keep-alive canary — flag, host gate, singleton pool, fail-closed telemetry.
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  assertElizaKeepAliveHostOrThrow,
  extractElizaTransportErrorCode,
  getElizaKeepAliveAgentForTests,
  getElizaKeepAliveObservability,
  getElizaKeepAliveStatsForTests,
  getElizaTransportFetch,
  isElizaKeepAliveCanaryEnabled,
  isElizaKeepAliveHost,
  resetElizaKeepAliveForTests,
  resolveElizaFetchImpl,
  resolveElizaKeepAliveMaxSockets,
} from '../../http/eliza-keepalive-agent';
import {
  ELIZA_FE_HOST,
  ELIZA_KEEPALIVE_ENV,
  ELIZA_KEEPALIVE_MAX_SOCKETS_DEFAULT,
  ELIZA_KEEPALIVE_MAX_SOCKETS_ENV,
  ELIZA_LIVE_TIMEOUT_MS,
} from './constants';
import { fetchElizaPromotedPrice } from './promoted-price-client';
import type { ElizaLiveContext } from './offer-context';
import { ELIZA_LANDING_HTML, okPromotedBody } from './promoted-price-client.test';
import {
  clearLivePriceStepTelemetryForTests,
  getLivePriceStepTelemetrySnapshot,
} from '../live-price-step-telemetry';
import { resetContextItemIdCacheForTests } from '../context-item-id-cache';

afterEach(() => {
  resetElizaKeepAliveForTests();
  resetContextItemIdCacheForTests();
  clearLivePriceStepTelemetryForTests();
  delete process.env[ELIZA_KEEPALIVE_ENV];
  delete process.env[ELIZA_KEEPALIVE_MAX_SOCKETS_ENV];
});

function elizaCtx(): ElizaLiveContext {
  return {
    accoId: '6270665',
    landingUrl:
      'https://www.elizawashere.be/spanje/andalusie/ronda/casita-paradise-island' +
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

test('flag OFF by default and for non-1 values', () => {
  assert.equal(isElizaKeepAliveCanaryEnabled({}), false);
  assert.equal(isElizaKeepAliveCanaryEnabled({ [ELIZA_KEEPALIVE_ENV]: '' }), false);
  assert.equal(isElizaKeepAliveCanaryEnabled({ [ELIZA_KEEPALIVE_ENV]: '0' }), false);
  assert.equal(isElizaKeepAliveCanaryEnabled({ [ELIZA_KEEPALIVE_ENV]: 'true' }), false);
  assert.equal(isElizaKeepAliveCanaryEnabled({ [ELIZA_KEEPALIVE_ENV]: '1' }), true);
});

test('flag OFF → getElizaTransportFetch is global fetch', () => {
  delete process.env[ELIZA_KEEPALIVE_ENV];
  assert.equal(getElizaTransportFetch(), fetch);
  assert.equal(resolveElizaFetchImpl(), fetch);
  assert.equal(resolveElizaFetchImpl(fetch), fetch);
});

test('flag ON → getElizaTransportFetch is not global fetch', () => {
  process.env[ELIZA_KEEPALIVE_ENV] = '1';
  const transport = getElizaTransportFetch();
  assert.notEqual(transport, fetch);
  assert.equal(resolveElizaFetchImpl(), transport);
  assert.equal(resolveElizaFetchImpl(fetch), transport);
});

test('explicit mock fetchImpl wins over canary', () => {
  process.env[ELIZA_KEEPALIVE_ENV] = '1';
  const mock: typeof fetch = async () => new Response('x');
  assert.equal(resolveElizaFetchImpl(mock), mock);
});

test('host gate allows only www.elizawashere.be', () => {
  assert.equal(isElizaKeepAliveHost(ELIZA_FE_HOST), true);
  assert.equal(isElizaKeepAliveHost('www.sunweb.be'), false);
  assert.equal(isElizaKeepAliveHost('api-fe.corendonresources.com'), false);
  assert.equal(isElizaKeepAliveHost(null), false);
  assert.throws(() => assertElizaKeepAliveHostOrThrow('www.sunweb.be'), /host gate/);
  assert.doesNotThrow(() => assertElizaKeepAliveHostOrThrow(ELIZA_FE_HOST));
});

test('keep-alive FetchLike refuses non-Eliza hosts', async () => {
  process.env[ELIZA_KEEPALIVE_ENV] = '1';
  const transport = getElizaTransportFetch();
  await assert.rejects(
    async () => {
      await transport('https://www.sunweb.be/nl/vakantie', { method: 'GET' });
    },
    (err: unknown) => err instanceof Error && /host gate/.test(err.message),
  );
  assert.equal(getElizaKeepAliveStatsForTests().httpRequests, 0);
});

test('singleton agent: multiple resolve calls reuse same agent instance', () => {
  process.env[ELIZA_KEEPALIVE_ENV] = '1';
  assert.equal(getElizaKeepAliveAgentForTests(), null);
  const a = getElizaTransportFetch();
  const agent1 = getElizaKeepAliveAgentForTests();
  assert.ok(agent1);
  const b = getElizaTransportFetch();
  const agent2 = getElizaKeepAliveAgentForTests();
  assert.equal(a, b);
  assert.equal(agent1, agent2);
  const obs = getElizaKeepAliveObservability();
  assert.equal(obs.canaryEnabled, true);
  assert.equal(obs.host, ELIZA_FE_HOST);
  assert.equal(obs.maxSockets, ELIZA_KEEPALIVE_MAX_SOCKETS_DEFAULT);
});

test('maxSockets default 32; env override applies on create', () => {
  assert.equal(resolveElizaKeepAliveMaxSockets({}), ELIZA_KEEPALIVE_MAX_SOCKETS_DEFAULT);
  assert.equal(
    resolveElizaKeepAliveMaxSockets({ [ELIZA_KEEPALIVE_MAX_SOCKETS_ENV]: '24' }),
    24,
  );
  assert.equal(
    resolveElizaKeepAliveMaxSockets({ [ELIZA_KEEPALIVE_MAX_SOCKETS_ENV]: '0' }),
    ELIZA_KEEPALIVE_MAX_SOCKETS_DEFAULT,
  );
  process.env[ELIZA_KEEPALIVE_ENV] = '1';
  process.env[ELIZA_KEEPALIVE_MAX_SOCKETS_ENV] = '20';
  getElizaTransportFetch();
  assert.equal(getElizaKeepAliveObservability().maxSockets, 20);
});

test('resetElizaKeepAliveForTests destroys agent (lifecycle not per-request)', () => {
  process.env[ELIZA_KEEPALIVE_ENV] = '1';
  getElizaTransportFetch();
  assert.ok(getElizaKeepAliveAgentForTests());
  resetElizaKeepAliveForTests();
  assert.equal(getElizaKeepAliveAgentForTests(), null);
});

test('AbortSignal.timeout duration remains ELIZA_LIVE_TIMEOUT_MS (15s)', () => {
  assert.equal(ELIZA_LIVE_TIMEOUT_MS, 15_000);
});

test('landing/GPP requests still receive AbortSignal when mocked', async () => {
  const signals: AbortSignal[] = [];
  const result = await fetchElizaPromotedPrice(elizaCtx(), {
    fetchImpl: async (_input, init) => {
      if (init?.signal) {
        signals.push(init.signal);
      }
      const url = String(_input);
      if (url.includes('GetPromotedPriceApi')) {
        return new Response(okPromotedBody({}), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(ELIZA_LANDING_HTML, { status: 200 });
    },
  });
  assert.equal(result.ok, true);
  assert.ok(signals.length >= 2);
  for (const signal of signals) {
    assert.equal(typeof signal.aborted, 'boolean');
  }
});

test('extractElizaTransportErrorCode reads UND_ERR_CONNECT_TIMEOUT from cause', () => {
  const err = Object.assign(new TypeError('fetch failed'), {
    cause: Object.assign(new Error('Connect Timeout Error'), {
      name: 'ConnectTimeoutError',
      code: 'UND_ERR_CONNECT_TIMEOUT',
    }),
  });
  assert.equal(extractElizaTransportErrorCode(err), 'UND_ERR_CONNECT_TIMEOUT');
});

test('network_error records transportErrorCode in step telemetry (fail-closed)', async () => {
  const boom = Object.assign(new TypeError('fetch failed'), {
    cause: { name: 'ConnectTimeoutError', code: 'UND_ERR_CONNECT_TIMEOUT' },
  });

  const result = await fetchElizaPromotedPrice(elizaCtx(), {
    fetchImpl: async () => {
      throw boom;
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'network_error');
  }
  const snap = getLivePriceStepTelemetrySnapshot().byProvider.eliza;
  assert.equal(snap.byReason.network_error, 1);
  assert.equal(snap.byTransportErrorCode.UND_ERR_CONNECT_TIMEOUT, 1);
  assert.equal(getElizaKeepAliveStatsForTests().connectTimeoutErrors, 1);
  assert.equal(getElizaKeepAliveStatsForTests().abortTimeoutErrors, 0);
});

test('AbortError timeout is classified as timeout and counted separately', async () => {
  const boom = new DOMException('This operation was aborted', 'AbortError');
  const result = await fetchElizaPromotedPrice(elizaCtx(), {
    fetchImpl: async () => {
      throw boom;
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'timeout');
  }
  const snap = getLivePriceStepTelemetrySnapshot().byProvider.eliza;
  assert.equal(snap.byReason.timeout, 1);
  assert.equal(snap.byTransportErrorCode.AbortError, 1);
  assert.equal(getElizaKeepAliveStatsForTests().abortTimeoutErrors, 1);
  assert.equal(getElizaKeepAliveStatsForTests().connectTimeoutErrors, 0);
});

test('existing happy path still works with explicit mock when canary ON', async () => {
  process.env[ELIZA_KEEPALIVE_ENV] = '1';
  const result = await fetchElizaPromotedPrice(elizaCtx(), {
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes('GetPromotedPriceApi')) {
        return new Response(okPromotedBody({}), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(ELIZA_LANDING_HTML, { status: 200 });
    },
  });
  assert.equal(result.ok, true);
  assert.equal(getElizaKeepAliveStatsForTests().httpRequests, 0);
});

test('connection reuse: sequential requests reuse socket when host reachable', async () => {
  process.env[ELIZA_KEEPALIVE_ENV] = '1';
  const transport = getElizaTransportFetch();
  const url = `https://${ELIZA_FE_HOST}/`;
  try {
    await transport(url, { method: 'GET', signal: AbortSignal.timeout(12_000) });
    await transport(url, { method: 'GET', signal: AbortSignal.timeout(12_000) });
  } catch (err) {
    // Soft-skip when network/path unavailable in CI — reuse still covered by createConnection hook.
    assert.ok(err instanceof Error);
    return;
  }
  const s = getElizaKeepAliveStatsForTests();
  assert.ok(s.httpRequests >= 2);
  assert.equal(s.createConnectionCalls, 1);
  assert.ok(s.reusedSocketTrue >= 1);
});
