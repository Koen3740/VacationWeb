import type { TravelOffer } from '../feeds/canonical/travel-offer';
import type { SearchParams } from '../../types/travel';
import { CORENDON_PROVIDER_NAME } from '../providers/corendon/constants';
import {
  corendonListingCacheKey,
  rankCorendonListings,
} from '../providers/corendon/listing-selection';

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
  return entry ? toOverlay(entry) : undefined;
}

export function hasResultsLivePriceOverlay(offerId: string, params: LivePriceCacheParams): boolean {
  if (readEntry(offerId, params)) {
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
    return true;
  }
  return false;
}

export function setResultsLivePriceOverlay(
  offerId: string,
  params: LivePriceCacheParams,
  overlay: ResultsLivePriceOverlay,
  options?: { cachedAtMs?: number; ttlMs?: number },
): void {
  cache.set(livePriceCacheKey(offerId, params), {
    ...overlay,
    cachedAtMs: options?.cachedAtMs ?? nowMs(),
    ...(options?.ttlMs != null ? { ttlMs: options.ttlMs } : {}),
  });
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
