/**
 * Extract Undici/Node transport codes from fetch/HTTPS failures.
 * Observability only — does not change fail-closed live-price classification.
 */
export function extractTransportErrorCode(error: unknown): string | undefined {
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
