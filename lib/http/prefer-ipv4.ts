import dns from 'node:dns';
import https from 'node:https';

const CORENDON_API_HOST = 'api-fe.corendonresources.com';
const CORENDON_IMAGE_HOST = 'images.corendonresources.com';

/** Hosts whose Node/undici IPv6 connect times out; same IPv4 + SNI path. */
export const CORENDON_IPV4_FETCH_HOSTS = new Set([
  CORENDON_API_HOST,
  CORENDON_IMAGE_HOST,
]);

/**
 * Shared keep-alive agent for Corendon IPv4 HTTPS (Fase B4).
 * One TCP pool for api-fe + images hosts instead of a new connect per request.
 */
export const corendonIpv4HttpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 30_000,
  maxSockets: 32,
  maxFreeSockets: 8,
  scheduling: 'lifo',
});

export function shouldPreferIpv4Fetch(hostname: string | null): boolean {
  return hostname != null && CORENDON_IPV4_FETCH_HOSTS.has(hostname);
}

let applied = false;

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

/** Fetch forbids a body on 204/205/304. A thrown Response() here is an uncaught crash. */
export function nodeHttpToFetchResponse(
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

function ipv4HttpsFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = typeof Request !== 'undefined' && input instanceof Request && init == null
    ? input
    : new Request(input, init);
  const url = new URL(request.url);

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
        family: 4,
        servername: url.hostname,
        agent: corendonIpv4HttpsAgent,
      },
      (incoming) => {
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
      reject(request.signal.reason ?? new DOMException('This operation was aborted', 'AbortError'));
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
}

/**
 * Native Node/undici fetch to Corendon API/image hosts times out on IPv6.
 * IPv4 HTTPS with the same hostname SNI/Host is proven. Keep existing fetch()
 * callers and URLs; only the connect family is IPv4 for those hosts.
 * Fase B4: keep-alive agent reuses TCP sockets across Corendon calls in-process.
 */
export function preferIpv4DnsOrder(): void {
  if (applied || typeof process === 'undefined' || !process.versions?.node) {
    return;
  }
  applied = true;

  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (shouldPreferIpv4Fetch(hostnameFromInput(input))) {
      return ipv4HttpsFetch(input, init);
    }
    return originalFetch(input, init);
  }) as typeof fetch;
}

preferIpv4DnsOrder();
