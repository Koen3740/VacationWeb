import type { TravelOffer } from '../feeds/canonical/travel-offer';
import type { SearchParams } from '../../types/travel';
import { CORENDON_PROVIDER_NAME } from '../providers/corendon/constants';
import {
  corendonListingCacheKey,
  rankCorendonListings,
} from '../providers/corendon/listing-selection';
import {
  isLivePriceL2Enabled,
  readLivePriceL2Record,
  writeLivePriceL2Record,
} from './live-price-l2-store';
import { noteLivePriceL2Event } from './live-price-l2-observability';

export type ResultsLivePriceOverlay = Pick<
  TravelOffer,
  'price' | 'pricePerDay' | 'livePriceStatus' | 'livePriceSource'
> &
  Partial<
    Pick<
      TravelOffer,
      | 'deepLink'
      | 'listingHost'
      | 'feedSourceId'
      | 'affiliateCampaignId'
      | 'liveTotalPrice'
      | 'liveTotalPriceField'
      | 'livePriceFailureReason'
    >
  >;

export type LivePriceCacheParams = Pick<
  SearchParams,
  'adults' | 'children' | 'babies' | 'rooms' | 'party' | 'departureAirport' | 'siteMarket'
> & {
  listingKey?: string;
};

type CacheEntry = ResultsLivePriceOverlay & {
  cachedAtMs: number;
  /** When set, overrides {@link RESULTS_LIVE_PRICE_TTL_MS} for this entry. */
  ttlMs?: number;
};

/**
 * Reuse window for a proven / confirmed-unavailable live result in the current
 * Node process.
 *
 * No provider quote TTL exists. Receipt JWT (~1h) is auth, not price validity.
 * Product requirement is session-length reuse without minute/hourly re-pricing.
 * 8h is the conservative end of the 8–10h hypothesis: a user who leaves for a
 * workday-plus-commute gets a refresh; filter/sort within a visit does not.
 */
export const RESULTS_LIVE_PRICE_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * Technical (C) failures are not “unavailable for 8h”.
 * Short TTL keeps the current request / price-sort terminal (same isolate) while
 * allowing a later search to retry. Not a cooldown — only a soft same-burst mark.
 */
export const RESULTS_LIVE_PRICE_TECHNICAL_FAILURE_TTL_MS = 2 * 60 * 1000;

const cache = new Map<string, CacheEntry>();
let nowMsOverride: number | null = null;

function nowMs(): number {
  return nowMsOverride ?? Date.now();
}

/** Test helper — freeze/advance cache time. Pass null to restore Date.now(). */
export function setResultsLivePriceNowMsForTests(nowMsValue: number | null): void {
  nowMsOverride = nowMsValue;
}

function entryTtlMs(entry: CacheEntry): number {
  return entry.ttlMs ?? RESULTS_LIVE_PRICE_TTL_MS;
}

function partyFingerprint(params: LivePriceCacheParams): string {
  if (!params.party?.length) {
    return '';
  }
  return params.party
    .map((traveller) => `${traveller.dateOfBirth ?? ''}@${traveller.roomIndex}`)
    .join(',');
}

function occupancyOfferPrefix(offerId: string, params: LivePriceCacheParams): string {
  const base = `${params.adults ?? 2}|${params.children ?? 0}|${params.babies ?? 0}|${params.rooms ?? 1}|${offerId}`;
  const party = partyFingerprint(params);
  return party ? `${base}|p:${party}` : base;
}

function isFresh(entry: CacheEntry): boolean {
  return nowMs() - entry.cachedAtMs <= entryTtlMs(entry);
}

export function livePriceCacheKey(offerId: string, params: LivePriceCacheParams): string {
  const prefix = occupancyOfferPrefix(offerId, params);
  return params.listingKey ? `${prefix}|l:${params.listingKey}` : prefix;
}

function readEntry(offerId: string, params: LivePriceCacheParams): CacheEntry | undefined {
  const key = livePriceCacheKey(offerId, params);
  const entry = cache.get(key);
  if (!entry) {
    return undefined;
  }
  if (!isFresh(entry)) {
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
    liveTotalPrice: entry.liveTotalPrice,
    liveTotalPriceField: entry.liveTotalPriceField,
    livePriceFailureReason: entry.livePriceFailureReason,
    deepLink: entry.deepLink,
    listingHost: entry.listingHost,
    feedSourceId: entry.feedSourceId,
    affiliateCampaignId: entry.affiliateCampaignId,
  };
}

export function clearResultsLivePriceCache(): void {
  cache.clear();
}

export function getResultsLivePriceOverlay(
  offerId: string,
  params: LivePriceCacheParams,
): ResultsLivePriceOverlay | undefined {
  const entry = readEntry(offerId, params);
  if (entry) {
    noteLivePriceL2Event('L1_HIT');
    return toOverlay(entry);
  }
  return undefined;
}

export function hasResultsLivePriceOverlay(offerId: string, params: LivePriceCacheParams): boolean {
  if (readEntry(offerId, params)) {
    noteLivePriceL2Event('L1_HIT');
    return true;
  }
  if (params.listingKey) {
    return false;
  }
  const prefix = `${occupancyOfferPrefix(offerId, params)}|l:`;
  for (const [key, entry] of cache) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    if (!isFresh(entry)) {
      cache.delete(key);
      continue;
    }
    noteLivePriceL2Event('L1_HIT');
    return true;
  }
  return false;
}

/**
 * Apply an L2 record into L1 only (no write-back to L2).
 * Used after hydrate / lock-wait hit.
 */
export function seedResultsLivePriceOverlayFromL2(
  offerId: string,
  params: LivePriceCacheParams,
  overlay: ResultsLivePriceOverlay,
  options: { cachedAtMs: number; ttlMs: number },
): void {
  cache.set(livePriceCacheKey(offerId, params), {
    ...overlay,
    cachedAtMs: options.cachedAtMs,
    ttlMs: options.ttlMs,
  });
}

/**
 * Batch L2 → L1 hydrate for offer ids under the given occupancy params.
 * Keeps existing sync get/has/apply paths unchanged after this await.
 */
export async function hydrateResultsLivePriceOverlaysFromL2(
  offerIds: readonly string[],
  params: LivePriceCacheParams,
  options: { concurrency?: number } = {},
): Promise<{ hydrated: number; checked: number }> {
  if (!isLivePriceL2Enabled() || offerIds.length === 0) {
    return { hydrated: 0, checked: 0 };
  }

  const uniqueIds = [...new Set(offerIds.filter(Boolean))];
  const pending = uniqueIds.filter((id) => !readEntry(id, params));
  if (pending.length === 0) {
    return { hydrated: 0, checked: uniqueIds.length };
  }

  const concurrency = Math.max(1, Math.min(options.concurrency ?? 12, pending.length));
  let hydrated = 0;
  let cursor = 0;

  async function worker(): Promise<void> {
    while (cursor < pending.length) {
      const index = cursor;
      cursor += 1;
      const offerId = pending[index]!;
      const cacheKey = livePriceCacheKey(offerId, params);
      const record = await readLivePriceL2Record(cacheKey);
      if (!record) {
        continue;
      }
      seedResultsLivePriceOverlayFromL2(offerId, params, record.overlay as ResultsLivePriceOverlay, {
        cachedAtMs: record.cachedAtMs,
        ttlMs: record.ttlMs,
      });
      hydrated += 1;
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { hydrated, checked: uniqueIds.length };
}

export function setResultsLivePriceOverlay(
  offerId: string,
  params: LivePriceCacheParams,
  overlay: ResultsLivePriceOverlay,
  options?: { cachedAtMs?: number; ttlMs?: number },
): void {
  const cachedAtMs = options?.cachedAtMs ?? nowMs();
  const ttlMs = options?.ttlMs ?? RESULTS_LIVE_PRICE_TTL_MS;
  const key = livePriceCacheKey(offerId, params);
  cache.set(key, {
    ...overlay,
    cachedAtMs,
    ...(options?.ttlMs != null ? { ttlMs: options.ttlMs } : {}),
  });

  // Write-through to L2 (best-effort, non-blocking). Soft-fail on store errors.
  if (isLivePriceL2Enabled()) {
    void writeLivePriceL2Record(key, overlay, { cachedAtMs, ttlMs }).catch(() => {
      noteLivePriceL2Event('STORE_ERROR');
    });
  }
}

function applyOverlay(offer: TravelOffer, overlay: ResultsLivePriceOverlay): TravelOffer {
  return { ...offer, ...overlay };
}

export function applyResultsLivePriceOverlay(
  offer: TravelOffer,
  params: LivePriceCacheParams,
): TravelOffer {
  if (offer.provider === CORENDON_PROVIDER_NAME && !params.listingKey) {
    const ranked = rankCorendonListings(offer, params);
    for (const listing of ranked) {
      const overlay = getResultsLivePriceOverlay(offer.id, {
        ...params,
        listingKey: corendonListingCacheKey(listing),
      });
      if (overlay?.livePriceStatus === 'proven') {
        return applyOverlay(offer, {
          ...overlay,
          deepLink: overlay.deepLink ?? listing.deepLink,
          listingHost: overlay.listingHost ?? listing.host,
          feedSourceId: overlay.feedSourceId ?? listing.feedId,
          affiliateCampaignId: overlay.affiliateCampaignId ?? listing.campaignId,
        });
      }
    }
    const baseOverlay = getResultsLivePriceOverlay(offer.id, params);
    if (baseOverlay?.livePriceStatus === 'unpriced') {
      return applyOverlay(offer, baseOverlay);
    }
    for (const listing of ranked) {
      const overlay = getResultsLivePriceOverlay(offer.id, {
        ...params,
        listingKey: corendonListingCacheKey(listing),
      });
      if (overlay) {
        return applyOverlay(offer, overlay);
      }
    }
    if (baseOverlay) {
      return applyOverlay(offer, baseOverlay);
    }
    return offer;
  }

  const overlay = getResultsLivePriceOverlay(offer.id, params);
  if (!overlay) {
    return offer;
  }
  return applyOverlay(offer, overlay);
}

export function applyResultsLivePriceOverlays(
  offers: readonly TravelOffer[],
  params: LivePriceCacheParams,
): TravelOffer[] {
  return offers.map((offer) => applyResultsLivePriceOverlay(offer, params));
}
