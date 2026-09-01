/**
 * Fase B1 / L3 — per-accommodation contextItemId cache (Sunweb / Eliza).
 *
 * Evidence: contextItemId stable across dual-fetch and live windows (≥1h, n=12).
 * L3 A/B (2s vs 10s): Sunweb landings −47.8%, correctness unchanged → TTL = 10s.
 * Expired entries are never served; stale_context still forces landing fallback.
 *
 * promotedPriceId / bookingGateId are site-wide Sitecore config (not per-acco
 * cache entries). They are learned from landing HTML into process-local config.
 *
 * Never caches prices. A live PromotedPrice call remains mandatory for display.
 */

export const CONTEXT_ITEM_ID_CACHE_TTL_MS = 10_000;

export type SitecoreBrand = 'sunweb' | 'eliza';

export type SitecoreSiteGuidConfig = {
  promotedPriceId: string;
  /** Sunweb BookingGate only; Eliza does not use this. */
  bookingGateId?: string;
};

type ContextEntry = {
  contextItemId: string;
  cachedAtMs: number;
};

const contextCache = new Map<string, ContextEntry>();
const siteConfig = new Map<SitecoreBrand, SitecoreSiteGuidConfig>();

let nowMsOverride: number | null = null;
let hits = 0;
let misses = 0;
let landingFallbacks = 0;

function nowMs(): number {
  return nowMsOverride ?? Date.now();
}

export function contextItemIdCacheKey(
  brand: SitecoreBrand,
  feHost: string,
  accoId: string,
): string {
  return `${brand}|${feHost}|${accoId}`;
}

function isFresh(entry: ContextEntry): boolean {
  return nowMs() - entry.cachedAtMs <= CONTEXT_ITEM_ID_CACHE_TTL_MS;
}

export function getCachedContextItemId(
  brand: SitecoreBrand,
  feHost: string,
  accoId: string,
): string | undefined {
  const key = contextItemIdCacheKey(brand, feHost, accoId);
  const entry = contextCache.get(key);
  if (!entry) {
    misses += 1;
    return undefined;
  }
  if (!isFresh(entry)) {
    contextCache.delete(key);
    misses += 1;
    return undefined;
  }
  hits += 1;
  return entry.contextItemId;
}

export function setCachedContextItemId(
  brand: SitecoreBrand,
  feHost: string,
  accoId: string,
  contextItemId: string,
): void {
  if (!contextItemId) {
    return;
  }
  contextCache.set(contextItemIdCacheKey(brand, feHost, accoId), {
    contextItemId,
    cachedAtMs: nowMs(),
  });
}

export function invalidateCachedContextItemId(
  brand: SitecoreBrand,
  feHost: string,
  accoId: string,
): void {
  contextCache.delete(contextItemIdCacheKey(brand, feHost, accoId));
}

export function getSitecoreSiteGuidConfig(brand: SitecoreBrand): SitecoreSiteGuidConfig | undefined {
  return siteConfig.get(brand);
}

/**
 * Site-wide PDP ids — configuration, not per-accommodation cache.
 * Overwrites with the latest successful landing extract.
 */
export function setSitecoreSiteGuidConfig(
  brand: SitecoreBrand,
  config: SitecoreSiteGuidConfig,
): void {
  if (!config.promotedPriceId) {
    return;
  }
  siteConfig.set(brand, {
    promotedPriceId: config.promotedPriceId,
    ...(config.bookingGateId ? { bookingGateId: config.bookingGateId } : {}),
  });
}

export function recordContextItemLandingFallback(): void {
  landingFallbacks += 1;
}

export function getContextItemIdCacheStats(): {
  hits: number;
  misses: number;
  landingFallbacks: number;
  size: number;
  ttlMs: number;
} {
  return {
    hits,
    misses,
    landingFallbacks,
    size: contextCache.size,
    ttlMs: CONTEXT_ITEM_ID_CACHE_TTL_MS,
  };
}

export function resetContextItemIdCacheForTests(): void {
  contextCache.clear();
  siteConfig.clear();
  nowMsOverride = null;
  hits = 0;
  misses = 0;
  landingFallbacks = 0;
}

/** Test helper — freeze/advance cache time. Pass null to restore Date.now(). */
export function setContextItemIdCacheNowMsForTests(nowMsValue: number | null): void {
  nowMsOverride = nowMsValue;
}
