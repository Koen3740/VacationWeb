import type { TravelOffer } from '../feeds/canonical/travel-offer';
import type { SearchParams } from '../../types/travel';

export type ResultsLivePriceOverlay = Pick<
  TravelOffer,
  'price' | 'pricePerDay' | 'livePriceStatus' | 'livePriceSource'
>;

type OccupancyKey = Pick<SearchParams, 'adults' | 'children' | 'babies' | 'rooms'>;

type CacheEntry = ResultsLivePriceOverlay & {
  cachedAtMs: number;
};

/**
 * Reuse window for a live price in the current Node process.
 *
 * No provider quote TTL exists. Receipt JWT (~1h) is auth, not price validity.
 * Product requirement is session-length reuse without minute/hourly re-pricing.
 * 8h is the conservative end of the 8–10h hypothesis: a user who leaves for a
 * workday-plus-commute gets a refresh; filter/sort within a visit does not.
 */
export const RESULTS_LIVE_PRICE_TTL_MS = 8 * 60 * 60 * 1000;

const cache = new Map<string, CacheEntry>();
let nowMsOverride: number | null = null;

function nowMs(): number {
  return nowMsOverride ?? Date.now();
}

/** Test helper — freeze/advance cache time. Pass null to restore Date.now(). */
export function setResultsLivePriceNowMsForTests(nowMsValue: number | null): void {
  nowMsOverride = nowMsValue;
}

export function livePriceCacheKey(offerId: string, params: OccupancyKey): string {
  return `${params.adults ?? 2}|${params.children ?? 0}|${params.babies ?? 0}|${params.rooms ?? 1}|${offerId}`;
}

function readEntry(offerId: string, params: OccupancyKey): CacheEntry | undefined {
  const key = livePriceCacheKey(offerId, params);
  const entry = cache.get(key);
  if (!entry) {
    return undefined;
  }
  if (nowMs() - entry.cachedAtMs > RESULTS_LIVE_PRICE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry;
}

function toOverlay(entry: CacheEntry): ResultsLivePriceOverlay {
  return {
    price: entry.price,
    pricePerDay: entry.pricePerDay,
    livePriceStatus: entry.livePriceStatus,
    livePriceSource: entry.livePriceSource,
  };
}

export function clearResultsLivePriceCache(): void {
  cache.clear();
}

export function getResultsLivePriceOverlay(
  offerId: string,
  params: OccupancyKey,
): ResultsLivePriceOverlay | undefined {
  const entry = readEntry(offerId, params);
  return entry ? toOverlay(entry) : undefined;
}

export function hasResultsLivePriceOverlay(offerId: string, params: OccupancyKey): boolean {
  return readEntry(offerId, params) !== undefined;
}

export function setResultsLivePriceOverlay(
  offerId: string,
  params: OccupancyKey,
  overlay: ResultsLivePriceOverlay,
  options?: { cachedAtMs?: number },
): void {
  cache.set(livePriceCacheKey(offerId, params), {
    ...overlay,
    cachedAtMs: options?.cachedAtMs ?? nowMs(),
  });
}

export function applyResultsLivePriceOverlay(offer: TravelOffer, params: OccupancyKey): TravelOffer {
  const overlay = getResultsLivePriceOverlay(offer.id, params);
  if (!overlay) {
    return offer;
  }
  return { ...offer, ...overlay };
}

export function applyResultsLivePriceOverlays(
  offers: readonly TravelOffer[],
  params: OccupancyKey,
): TravelOffer[] {
  return offers.map((offer) => applyResultsLivePriceOverlay(offer, params));
}
