/**
 * Client-side ops auth for cockpit fetches.
 * Reads `?token=` from a querystring (typically window.location.search)
 * and maps it to an Authorization Bearer header already accepted by
 * {@link extractOpsTokenFromRequest}. Does not set cookies or log tokens.
 */

export function buildOpsClientAuthHeaders(search: string): Record<string, string> {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  let token: string | null = null;
  try {
    token = new URLSearchParams(raw).get('token');
  } catch {
    return {};
  }
  const trimmed = token?.trim() ?? '';
  if (!trimmed) {
    return {};
  }
  return { Authorization: `Bearer ${trimmed}` };
}
