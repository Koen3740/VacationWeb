/**
 * Sunweb keep-alive transport canary (www.sunweb.be only).
 *
 * Default OFF — `VACATIONWEB_SUNWEB_KEEPALIVE=1` enables the shared pool.
 * No global fetch patch, no DNS changes, no family:4.
 *
 * Research: docs/research/search-capacity/_sunweb_eliza_perf/sunweb-keepalive-dispatcher-validation.md
 */
import https from 'node:https';
import { Agent as HttpsAgent } from 'node:https';
import type { FetchLike } from '../providers/prijsvrij/auth';
import { SUNWEB_FE_HOST, SUNWEB_KEEPALIVE_ENV } from '../providers/sunweb/constants';

/** Opt-in canary. Any value other than exactly `1` → OFF (native fetch). */
export { SUNWEB_KEEPALIVE_ENV };

export function isSunwebKeepAliveCanaryEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (env[SUNWEB_KEEPALIVE_ENV] ?? '').trim() === '1';
}

export function isSunwebKeepAliveHost(hostname: string | null | undefined): boolean {
  return hostname === SUNWEB_FE_HOST;
}

function hostnameFromInput(input: RequestInfo | URL): string | null {
  try {
    if (typeof input === 'string') {
      return new URL(input).hostname;
    }
    if (input instanceof URL) {
      return input.hostname;
    }
    if (typeof Request !== 'undefined' && input instanceof Request) {
      return new URL(input.url).hostname;
    }
  } catch {
    return null;
  }
  return null;
}

/** Local helper — do not import prefer-ipv4 (that module patches global fetch + DNS). */
function nodeHttpToFetchResponse(
  statusCode: number,
  statusText: string | undefined,
  headers: Headers,
  body: Buffer,
): Response {
  const status = statusCode >= 200 && statusCode <= 599 ? statusCode : 502;
  const emptyBody = status === 204 || status === 205 || status === 304;
  return new Response(emptyBody ? null : body, {
    status,
    statusText,
    headers,
  });
}

type PoolStats = {
  httpRequests: number;
  createConnectionCalls: number;
  reusedSocketTrue: number;
  connectTimeoutErrors: number;
  networkErrors: number;
};

const stats: PoolStats = {
  httpRequests: 0,
  createConnectionCalls: 0,
  reusedSocketTrue: 0,
  connectTimeoutErrors: 0,
  networkErrors: 0,
};

let agent: HttpsAgent | null = null;
let keepAliveFetch: FetchLike | null = null;

function getOrCreateAgent(): HttpsAgent {
  if (agent) {
    return agent;
  }
  const created = new HttpsAgent({
    keepAlive: true,
    keepAliveMsecs: 30_000,
    maxSockets: 16,
    maxFreeSockets: 8,
    scheduling: 'lifo',
  });
  // Node Agent.createConnection exists at runtime; @types/node Agent typing omits it.
  const agentAny = created as HttpsAgent & {
    createConnection: (
      options: https.RequestOptions,
      callback?: (err: Error | null, stream: import('node:net').Socket) => void,
    ) => import('node:net').Socket;
  };
  const orig = agentAny.createConnection.bind(created);
  agentAny.createConnection = ((
    options: https.RequestOptions,
    callback?: (err: Error | null, stream: import('node:net').Socket) => void,
  ) => {
    stats.createConnectionCalls += 1;
    return orig(options, callback);
  }) as typeof agentAny.createConnection;
  agent = created;
  return created;
}

/**
 * Extract Undici/Node transport codes for canary observability.
 * Does not change fail-closed classification.
 */
export function extractSunwebTransportErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const e = error as { code?: unknown; cause?: unknown; name?: unknown };
  if (typeof e.code === 'string' && e.code.length > 0) {
    return e.code;
  }
  if (e.cause && typeof e.cause === 'object') {
    const c = e.cause as { code?: unknown; name?: unknown };
    if (typeof c.code === 'string' && c.code.length > 0) {
      return c.code;
    }
    if (typeof c.name === 'string' && c.name.length > 0) {
      return c.name;
    }
  }
  if (typeof e.name === 'string' && e.name !== 'Error' && e.name !== 'TypeError') {
    return e.name;
  }
  return undefined;
}

export function noteSunwebTransportFailure(error: unknown): void {
  stats.networkErrors += 1;
  const code = extractSunwebTransportErrorCode(error);
  if (code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ConnectTimeoutError') {
    stats.connectTimeoutErrors += 1;
  }
}

function sunwebKeepAliveHttpsFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const request =
      typeof Request !== 'undefined' && input instanceof Request && init == null
        ? input
        : new Request(input, init);
    const url = new URL(request.url);
    if (!isSunwebKeepAliveHost(url.hostname)) {
      return Promise.reject(
        new Error(
          `Sunweb keep-alive host gate: refused ${url.hostname} (only ${SUNWEB_FE_HOST})`,
        ),
      );
    }

    const pool = getOrCreateAgent();
    stats.httpRequests += 1;

    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {};
      request.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const req = https.request(
        {
          hostname: url.hostname,
          port: url.port ? Number(url.port) : 443,
          path: `${url.pathname}${url.search}`,
          method: request.method,
          headers,
          agent: pool,
          servername: url.hostname,
        },
        (incoming) => {
          if (req.reusedSocket) {
            stats.reusedSocketTrue += 1;
          }
          const chunks: Buffer[] = [];
          incoming.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          incoming.on('end', () => {
            const responseHeaders = new Headers();
            for (const [key, value] of Object.entries(incoming.headers)) {
              if (value == null) {
                continue;
              }
              if (Array.isArray(value)) {
                for (const item of value) {
                  responseHeaders.append(key, item);
                }
              } else {
                responseHeaders.set(key, value);
              }
            }
            try {
              resolve(
                nodeHttpToFetchResponse(
                  incoming.statusCode ?? 502,
                  incoming.statusMessage,
                  responseHeaders,
                  Buffer.concat(chunks),
                ),
              );
            } catch (error) {
              reject(error);
            }
          });
        },
      );

      const abort = () => {
        req.destroy();
        reject(
          request.signal.reason ?? new DOMException('This operation was aborted', 'AbortError'),
        );
      };

      if (request.signal.aborted) {
        abort();
        return;
      }
      request.signal.addEventListener('abort', abort, { once: true });
      req.on('error', reject);

      void request.arrayBuffer().then((body) => {
        if (body.byteLength > 0) {
          req.write(Buffer.from(body));
        }
        req.end();
      }, reject);
    });
  } catch (error) {
    return Promise.reject(error);
  }
}

function getOrCreateKeepAliveFetch(): FetchLike {
  if (!keepAliveFetch) {
    getOrCreateAgent();
    keepAliveFetch = sunwebKeepAliveHttpsFetch as FetchLike;
  }
  return keepAliveFetch;
}

/**
 * Default Sunweb transport:
 * - canary OFF → global `fetch`
 * - canary ON → shared keep-alive FetchLike (www.sunweb.be only)
 */
export function getSunwebTransportFetch(
  env: Record<string, string | undefined> = process.env,
): FetchLike {
  if (!isSunwebKeepAliveCanaryEnabled(env)) {
    return fetch;
  }
  return getOrCreateKeepAliveFetch();
}

/**
 * Resolve FetchLike for Sunweb clients.
 * Explicit non-global inject (tests/mocks) wins; global `fetch` defers to canary transport.
 */
export function resolveSunwebFetchImpl(override?: FetchLike): FetchLike {
  if (override && override !== fetch) {
    return override;
  }
  return getSunwebTransportFetch();
}

export function getSunwebKeepAliveAgentForTests(): HttpsAgent | null {
  return agent;
}

export function getSunwebKeepAliveStatsForTests(): Readonly<PoolStats> {
  return { ...stats };
}

export function resetSunwebKeepAliveForTests(): void {
  if (agent) {
    agent.destroy();
  }
  agent = null;
  keepAliveFetch = null;
  stats.httpRequests = 0;
  stats.createConnectionCalls = 0;
  stats.reusedSocketTrue = 0;
  stats.connectTimeoutErrors = 0;
  stats.networkErrors = 0;
}

/** Snapshot for canary observability (cheap counters). */
export function getSunwebKeepAliveObservability(): {
  canaryEnabled: boolean;
  host: string;
  httpRequests: number;
  newTcpHandshakes: number;
  reusedSocketTrue: number;
  connectTimeoutErrors: number;
  networkErrors: number;
} {
  return {
    canaryEnabled: isSunwebKeepAliveCanaryEnabled(),
    host: SUNWEB_FE_HOST,
    httpRequests: stats.httpRequests,
    newTcpHandshakes: stats.createConnectionCalls,
    reusedSocketTrue: stats.reusedSocketTrue,
    connectTimeoutErrors: stats.connectTimeoutErrors,
    networkErrors: stats.networkErrors,
  };
}

export function assertSunwebKeepAliveHostOrThrow(hostname: string): void {
  if (!isSunwebKeepAliveHost(hostname)) {
    throw new Error(
      `Sunweb keep-alive host gate: refused ${hostname} (only ${SUNWEB_FE_HOST})`,
    );
  }
}

/** Exported for tests that need to inspect hostname parsing without fetching. */
export function sunwebKeepAliveHostnameFromInput(input: RequestInfo | URL): string | null {
  return hostnameFromInput(input);
}
