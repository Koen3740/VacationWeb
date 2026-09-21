/**
 * Owner-only gate for live-pricing ops cockpit.
 *
 * Requires LIVE_PRICING_OPS_TOKEN (or ADMIN_OPS_TOKEN) in env.
 * Accepts Authorization: Bearer <token> or ?token= / cookie live_pricing_ops_token.
 */

export function getConfiguredOpsToken(): string | null {
  const token =
    process.env.LIVE_PRICING_OPS_TOKEN?.trim() ||
    process.env.ADMIN_OPS_TOKEN?.trim() ||
    '';
  return token.length > 0 ? token : null;
}

export function extractOpsTokenFromRequest(req: {
  headers: Headers | { get(name: string): string | null };
  url?: string;
  cookies?: { get(name: string): { value: string } | undefined };
}): string | null {
  const headerBag =
    typeof req.headers.get === 'function'
      ? req.headers.get('authorization')
      : null;
  if (headerBag?.toLowerCase().startsWith('bearer ')) {
    return headerBag.slice(7).trim() || null;
  }
  const xToken =
    typeof req.headers.get === 'function' ? req.headers.get('x-ops-token') : null;
  if (xToken?.trim()) {
    return xToken.trim();
  }
  if (req.url) {
    try {
      const u = new URL(req.url, 'http://localhost');
      const q = u.searchParams.get('token');
      if (q?.trim()) {
        return q.trim();
      }
    } catch {
      // ignore
    }
  }
  const cookie = req.cookies?.get('live_pricing_ops_token')?.value;
  return cookie?.trim() || null;
}

export function assertOpsAuthorized(req: {
  headers: Headers | { get(name: string): string | null };
  url?: string;
  cookies?: { get(name: string): { value: string } | undefined };
}): { ok: true } | { ok: false; status: number; message: string } {
  const configured = getConfiguredOpsToken();
  if (!configured) {
    // Dev convenience: allow when NODE_ENV=development and no token configured.
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return { ok: true };
    }
    return {
      ok: false,
      status: 503,
      message:
        'Ops cockpit locked: set LIVE_PRICING_OPS_TOKEN (or ADMIN_OPS_TOKEN) in environment.',
    };
  }
  const provided = extractOpsTokenFromRequest(req);
  if (!provided || provided !== configured) {
    return { ok: false, status: 401, message: 'Unauthorized — owner token required.' };
  }
  return { ok: true };
}
