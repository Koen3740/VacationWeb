import {
  PRIJSVRIJ_RECEIPT_TOKEN_URL,
  PRIJSVRIJ_REQUEST_TIMEOUT_MS,
  PRIJSVRIJ_TOKEN_REFRESH_SKEW_MS,
} from './constants';
import type { FetchLike } from './auth';

export type { FetchLike };

type CachedToken = {
  token: string;
  expiresAtMs: number;
};

let cachedReceiptToken: CachedToken | null = null;

/** Test helper — clears in-memory Receipt token cache. */
export function clearPrijsvrijReceiptTokenCache(): void {
  cachedReceiptToken = null;
}

function readJwtExpiryMs(token: string): number | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const json = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isUsable(cached: CachedToken, nowMs: number): boolean {
  return cached.expiresAtMs - PRIJSVRIJ_TOKEN_REFRESH_SKEW_MS > nowMs;
}

/**
 * JWT for Receipt via GET /token (not /token/service).
 * Never logs token values.
 */
export async function getPrijsvrijReceiptToken(
  fetchImpl: FetchLike = fetch,
  nowMs: number = Date.now(),
  forceRefresh: boolean = false,
): Promise<string> {
  if (!forceRefresh && cachedReceiptToken && isUsable(cachedReceiptToken, nowMs)) {
    return cachedReceiptToken.token;
  }

  const response = await fetchImpl(PRIJSVRIJ_RECEIPT_TOKEN_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(PRIJSVRIJ_REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Prijsvrij Receipt token endpoint returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as { token?: unknown };
  if (typeof body.token !== 'string' || body.token.length < 20) {
    throw new Error('Prijsvrij Receipt token endpoint response missing token');
  }

  const expiresAtMs = readJwtExpiryMs(body.token) ?? nowMs + 5 * 60_000;
  cachedReceiptToken = { token: body.token, expiresAtMs };
  return body.token;
}
