/**
 * Eliza keep-alive transport canary (www.elizawashere.be only).
 *
 * Default OFF — `VACATIONWEB_ELIZA_KEEPALIVE=1` enables the shared pool.
 * No global fetch patch, no DNS changes, no family:4.
 *
 * Research: docs/research/search-capacity/_sunweb_eliza_perf/eliza-transport-keepalive-analysis.md
 */
import https from 'node:https';
import { Agent as HttpsAgent } from 'node:https';
import type { FetchLike } from '../providers/prijsvrij/auth';
import {
  ELIZA_FE_HOST,
  ELIZA_KEEPALIVE_ENV,
  ELIZA_KEEPALIVE_MAX_SOCKETS_DEFAULT,
  ELIZA_KEEPALIVE_MAX_SOCKETS_ENV,
} from '../providers/eliza/constants';

/** Opt-in canary. Any value other than exactly `1` → OFF (native fetch). */
export { ELIZA_KEEPALIVE_ENV, ELIZA_KEEPALIVE_MAX_SOCKETS_ENV };

export function isElizaKeepAliveCanaryEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (env[ELIZA_KEEPALIVE_ENV] ?? '').trim() === '1';
}

export function isElizaKeepAliveHost(hostname: string | null | undefined): boolean {
  return hostname === ELIZA_FE_HOST;
}

/**
 * Resolve Agent maxSockets for the canary.
 * Default 32 (see ELIZA_KEEPALIVE_MAX_SOCKETS_DEFAULT). Env override optional.
 */
export function resolveElizaKeepAliveMaxSockets(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = (env[ELIZA_KEEPALIVE_MAX_SOCKETS_ENV] ?? '').trim();
  if (!raw) {
    return ELIZA_KEEPALIVE_MAX_SOCKETS_DEFAULT;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 256) {
    return ELIZA_KEEPALIVE_MAX_SOCKETS_DEFAULT;
  }
  return n;
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
  abortTimeoutErrors: number;
  networkErrors: number;
};

const stats: PoolStats = {
  httpRequests: 0,
  createConnectionCalls: 0,
  reusedSocketTrue: 0,
  connectTimeoutErrors: 0,
  abortTimeoutErrors: 0,
  networkErrors: 0,
};

let agent: HttpsAgent | null = null;
let agentMaxSockets: number | null = null;
let keepAliveFetch: FetchLike | null = null;

function getOrCreateAgent(
  env: Record<string, string | undefined> = process.env,
): HttpsAgent {
  const maxSockets = resolveElizaKeepAliveMaxSockets(env);
  if (agent && agentMaxSockets === maxSockets) {
    return agent;
  }
  if (agent) {
    agent.destroy();
    agent = null;
    keepAliveFetch = null;
  }
  const created = new HttpsAgent({
    keepAlive: true,
    keepAliveMsecs: 30_000,
    maxSockets,
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
  agentMaxSockets = maxSockets;
  return created;
}

/**
 * Extract transport codes for canary observability.
 * Distinguishes Undici connect timeout, AbortSignal abort, and other codes.
 * Does not change fail-closed classification.
 */
export function extractElizaTransportErrorCode(error: unknown): string | undefined {
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

function isAbortOrTimeoutName(code: string | undefined): boolean {
  return (
    code === 'AbortError' ||
    code === 'TimeoutError' ||
    code === 'ABORT_ERR' ||
    code === 'UND_ERR_ABORTED'
  );
}

/**
 * Record transport failure counters. Call with the classified live-price reason
 * so AbortSignal timeouts are not counted as connect timeouts.
 */
export function noteElizaTransportFailure(
  error: unknown,
  classifiedReason: 'timeout' | 'network_error',
): void {
  if (classifiedReason === 'timeout') {
    stats.abortTimeoutErrors += 1;
    return;
  }
  stats.networkErrors += 1;
  const code = extractElizaTransportErrorCode(error);
  if (code === 'UND_ERR_CONNECT_TIMEOUT' || code === 'ConnectTimeoutError') {
    stats.connectTimeoutErrors += 1;
  }
}

function elizaKeepAliveHttpsFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const request =
      typeof Request !== 'undefined' && input instanceof Request && init == null
        ? input
        : new Request(input, init);
    const url = new URL(request.url);
    if (!isElizaKeepAliveHost(url.hostname)) {
      return Promise.reject(
        new Error(
          `Eliza keep-alive host gate: refused ${url.hostname} (only ${ELIZA_FE_HOST})`,
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
    keepAliveFetch = elizaKeepAliveHttpsFetch as FetchLike;
  }
  return keepAliveFetch;
}

/**
 * Default Eliza transport:
 * - canary OFF → global `fetch`
 * - canary ON → shared keep-alive FetchLike (www.elizawashere.be only)
 */
export function getElizaTransportFetch(
  env: Record<string, string | undefined> = process.env,
): FetchLike {
  if (!isElizaKeepAliveCanaryEnabled(env)) {
    return fetch;
  }
  return getOrCreateKeepAliveFetch();
}

/**
 * Resolve FetchLike for Eliza clients.
 * Explicit non-global inject (tests/mocks) wins; global `fetch` defers to canary transport.
 */
export function resolveElizaFetchImpl(override?: FetchLike): FetchLike {
  if (override && override !== fetch) {
    return override;
  }
  return getElizaTransportFetch();
}

export function getElizaKeepAliveAgentForTests(): HttpsAgent | null {
  return agent;
}

export function getElizaKeepAliveStatsForTests(): Readonly<PoolStats> {
  return { ...stats };
}

export function resetElizaKeepAliveForTests(): void {
  if (agent) {
    agent.destroy();
  }
  agent = null;
  agentMaxSockets = null;
  keepAliveFetch = null;
  stats.httpRequests = 0;
  stats.createConnectionCalls = 0;
  stats.reusedSocketTrue = 0;
  stats.connectTimeoutErrors = 0;
  stats.abortTimeoutErrors = 0;
  stats.networkErrors = 0;
}

/** Snapshot for canary observability (cheap counters). */
export function getElizaKeepAliveObservability(): {
  canaryEnabled: boolean;
  host: string;
  maxSockets: number;
  httpRequests: number;
  newTcpHandshakes: number;
  reusedSocketTrue: number;
  connectTimeoutErrors: number;
  abortTimeoutErrors: number;
  networkErrors: number;
} {
  return {
    canaryEnabled: isElizaKeepAliveCanaryEnabled(),
    host: ELIZA_FE_HOST,
    maxSockets: agentMaxSockets ?? resolveElizaKeepAliveMaxSockets(),
    httpRequests: stats.httpRequests,
    newTcpHandshakes: stats.createConnectionCalls,
    reusedSocketTrue: stats.reusedSocketTrue,
    connectTimeoutErrors: stats.connectTimeoutErrors,
    abortTimeoutErrors: stats.abortTimeoutErrors,
    networkErrors: stats.networkErrors,
  };
}

export function assertElizaKeepAliveHostOrThrow(hostname: string): void {
  if (!isElizaKeepAliveHost(hostname)) {
    throw new Error(
      `Eliza keep-alive host gate: refused ${hostname} (only ${ELIZA_FE_HOST})`,
    );
  }
}

/** Exported for tests that need to inspect hostname parsing without fetching. */
export function elizaKeepAliveHostnameFromInput(input: RequestInfo | URL): string | null {
  return hostnameFromInput(input);
}

export function isElizaAbortTransportCode(code: string | undefined): boolean {
  return isAbortOrTimeoutName(code);
}
