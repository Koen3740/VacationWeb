/** Local fallback used when an offer has no usable image URL. */
export const OFFER_IMAGE_PLACEHOLDER = '/images/results-card-placeholder.png';

/**
 * Returns true only for values that are safe to pass to next/image.
 * Rejects feed mistakes such as USP copy prefixed with "https://".
 */
export function isValidOfferImageUrl(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const src = value.trim();
  if (!src) {
    return false;
  }

  // App-local assets (placeholder, static images).
  if (src.startsWith('/')) {
    return !src.includes(' ') && !src.includes(';') && src.length < 512;
  }

  let parsed: URL;
  try {
    parsed = new URL(src);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const host = parsed.hostname;
  if (!host || host.includes(' ') || !host.includes('.')) {
    return false;
  }

  // USP dumps often keep semicolons; real CDN URLs virtually never do.
  if (src.includes(';')) {
    return false;
  }

  // Prijsvrij feed dummy (not a real accommodation photo). Exact host+path only.
  if (
    host === 'cdn.prijsvrij.be' &&
    parsed.pathname === '/upload/images/na.jpg'
  ) {
    return false;
  }

  return true;
}
