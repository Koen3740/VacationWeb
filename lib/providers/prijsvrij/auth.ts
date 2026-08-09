import {
  PRIJSVRIJ_REQUEST_TIMEOUT_MS,
  PRIJSVRIJ_TOKEN_REFRESH_SKEW_MS,
  PRIJSVRIJ_TOKEN_URL,
} from './constants';

export type FetchLike = typeof fetch;

type CachedToken = {
  token: string;
  expiresAtMs: number;
};

let cachedToken: CachedToken | null = null;

/** Test helper — clears in-memory token cache. */
export function clearPrijsvrijTokenCache(): void {
  cachedToken = null;
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
 * Fetches a Prijsvrij service JWT from the public token bootstrap endpoint.
 * Never logs token values.
 */
export async function getPrijsvrijServiceToken(
  fetchImpl: FetchLike = fetch,
  nowMs: number = Date.now(),
): Promise<string> {
  if (cachedToken && isUsable(cachedToken, nowMs)) {
    return cachedToken.token;
  }

  const response = await fetchImpl(PRIJSVRIJ_TOKEN_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(PRIJSVRIJ_REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Prijsvrij token endpoint returned HTTP ${response.status}`);
  }

  const body = (await response.json()) as { token?: unknown };
  if (typeof body.token !== 'string' || body.token.length < 20) {
    throw new Error('Prijsvrij token endpoint response missing token');
  }

  const expiresAtMs = readJwtExpiryMs(body.token) ?? nowMs + 5 * 60_000;
  cachedToken = { token: body.token, expiresAtMs };
  return body.token;
}
