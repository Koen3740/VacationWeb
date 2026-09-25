import type { TravelOffer } from '../feeds/canonical/travel-offer';
import type { SearchParams } from '../../types/travel';
import { CORENDON_PROVIDER_NAME } from '../providers/corendon/constants';
import {
  corendonListingCacheKey,
  rankCorendonListings,
} from '../providers/corendon/listing-selection';
import {
  isLivePriceL2Enabled,
  joinInflightLivePriceL2Read,
  readLivePriceL2RecordResult,
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
export type HydrateResultsLivePriceFromL2Options = {
  concurrency?: number;
  /**
   * Optional offer objects for the same ids. When provided, Corendon ids also
   * probe listingKey-scoped L2 records (write path uses listingKey; bare-id
   * hydrate alone cannot hit those objects — GO3).
   */
  offers?: readonly TravelOffer[];
  /**
   * D-v2 S6 (from D-v1): overall time budget (ms). When it elapses the call returns:
   * no new GETs start; GETs already in flight keep running and still seed L1 (not
   * awaited; overlays join them via `awaitInflightL2ReadsForOffer`).
   * Undefined = await every attempt (each read bounded at 2000 ms + circuit).
   */
  budgetMs?: number;
};

export type HydrateResultsLivePriceFromL2Stats = {
  hydrated: number;
  checked: number;
  /** D-v2 S6: L2 keys attempted (ids + Corendon listingKey variants). */
  attempts?: number;
  /** D-v2 S6: attempts not finished when the call returned (budget elapsed). */
  timedOut?: number;
  /** D-v2 S6: attempts whose read ended as 'timeout' before the call returned. */
  getTimeouts?: number;
  budgetHit?: boolean;
};

/**
 * D-v2 S6 (plan: 1-s budget, from D-v1; scope applied in catalog-live-page-state): time budget for the page-window L2 hydrate on
 * an UNFROZEN page 1 only. After it the page state continues (overlays start); reads in
 * flight keep running and seed L1, and each slot joins its own in-flight read before the
 * provider limiter (`awaitInflightL2ReadsForOffer`), so a record within the 2000 ms read
 * bound is still used. Frozen page 1 and page 2+ await the full hydrate (each read
 * bounded at 2000 ms + R2 circuit). Timing mechanism only: no sort / selection rule.
 */
export const RESULTS_PAGE_L2_HYDRATE_BUDGET_MS = 1000;

/** D-v2 S6: hydrate budget scope (T16): unfrozen page 1 only. */
export function resultsPageL2HydrateBudgetMs(
  isPage1: boolean,
  frozenIds: readonly string[] | undefined,
): number | undefined {
  return isPage1 && !(frozenIds?.length ?? 0) ? RESULTS_PAGE_L2_HYDRATE_BUDGET_MS : undefined;
}

type HydrateAttempt = {
  offerId: string;
  params: LivePriceCacheParams;
};

/**
 * Batch L2 → L1 hydrate for offer ids under the given occupancy params.
 * Keeps existing sync get/has/apply paths unchanged after this await.
 *
 * GO3: when `offers` is passed, Corendon entries also try listingKey variants
 * so L2 keys match the write path (`setResultsLivePriceOverlay` + listingKey).
 */
export async function hydrateResultsLivePriceOverlaysFromL2(
  offerIds: readonly string[],
  params: LivePriceCacheParams,
  options: HydrateResultsLivePriceFromL2Options = {},
): Promise<HydrateResultsLivePriceFromL2Stats> {
  if (!isLivePriceL2Enabled() || offerIds.length === 0) {
    return { hydrated: 0, checked: 0 };
  }

  const uniqueIds = [...new Set(offerIds.filter(Boolean))];
  const offerById = new Map(
    (options.offers ?? []).filter((offer) => Boolean(offer?.id)).map((offer) => [offer.id, offer]),
  );

  const attempts: HydrateAttempt[] = [];
  const seenKeys = new Set<string>();
  for (const offerId of uniqueIds) {
    const bare: HydrateAttempt = { offerId, params };
    const bareKey = livePriceCacheKey(offerId, bare.params);
    if (!readEntry(offerId, bare.params) && !seenKeys.has(bareKey)) {
      seenKeys.add(bareKey);
      attempts.push(bare);
    }

    const offer = offerById.get(offerId);
    if (!offer || offer.provider !== CORENDON_PROVIDER_NAME) {
      continue;
    }
    for (const listing of rankCorendonListings(offer, params)) {
      const listingParams: LivePriceCacheParams = {
        ...params,
        listingKey: corendonListingCacheKey(listing),
      };
      if (readEntry(offerId, listingParams)) {
        continue;
      }
      const key = livePriceCacheKey(offerId, listingParams);
      if (seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);
      attempts.push({ offerId, params: listingParams });
    }
  }

  if (attempts.length === 0) {
    return { hydrated: 0, checked: uniqueIds.length };
  }

  const concurrency = Math.max(1, Math.min(options.concurrency ?? 12, attempts.length));
  let hydrated = 0;
  let cursor = 0;
  let completed = 0;
  let getTimeouts = 0;
  let budgetHit = false;
  const budgetMs =
    typeof options.budgetMs === 'number' && Number.isFinite(options.budgetMs) && options.budgetMs > 0
      ? Math.floor(options.budgetMs)
      : null;

  async function worker(): Promise<void> {
    while (!budgetHit && cursor < attempts.length) {
      const index = cursor;
      cursor += 1;
      const attempt = attempts[index]!;
      const cacheKey = livePriceCacheKey(attempt.offerId, attempt.params);
      const result = await readLivePriceL2RecordResult(cacheKey);
      completed += 1;
      if (result.status === 'timeout') {
        getTimeouts += 1;
      }
      const record = result.record;
      if (!record) {
        continue;
      }
      seedResultsLivePriceOverlayFromL2(
        attempt.offerId,
        attempt.params,
        record.overlay as ResultsLivePriceOverlay,
        {
          cachedAtMs: record.cachedAtMs,
          ttlMs: record.ttlMs,
        },
      );
      hydrated += 1;
    }
  }

  const workers = Promise.all(Array.from({ length: concurrency }, () => worker()));
  if (budgetMs == null) {
    await workers;
  } else {
    let budgetTimer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      workers,
      new Promise<void>((resolve) => {
        budgetTimer = setTimeout(() => {
          budgetHit = true;
          resolve();
        }, budgetMs);
      }),
    ]);
    if (budgetTimer) {
      clearTimeout(budgetTimer);
    }
  }
  const stats: HydrateResultsLivePriceFromL2Stats = {
    hydrated,
    checked: uniqueIds.length,
    attempts: attempts.length,
    timedOut: attempts.length - completed,
    getTimeouts,
    budgetHit,
  };
  if (process.env.VACATIONWEB_RESULTS_TIMING === '1' && (budgetHit || getTimeouts > 0)) {
    console.info(
      '[results-timing]',
      JSON.stringify({ phase: 'l2-hydrate-timeout', budgetMs, ...stats }),
    );
  }
  return stats;
}

/**
 * D-v2 S6: wait for L2 record reads that are ALREADY in flight for this offer (same keys
 * as the hydrate: bare key + Corendon listingKey variants) and seed L1 on a hit. Never
 * starts a read, never calls a provider. Used by a Page-1 slot before its provider
 * limiter, so a record that lands after the 1 s page-state budget (but within the 2 s
 * read bound) is still used and the wait occupies no limiter slot.
 */
export async function awaitInflightL2ReadsForOffer(
  offer: TravelOffer,
  params: LivePriceCacheParams,
): Promise<number> {
  if (!isLivePriceL2Enabled() || !offer?.id) {
    return 0;
  }
  const keyParams: LivePriceCacheParams[] = [params];
  if (offer.provider === CORENDON_PROVIDER_NAME && !params.listingKey) {
    for (const listing of rankCorendonListings(offer, params)) {
      keyParams.push({ ...params, listingKey: corendonListingCacheKey(listing) });
    }
  }
  const joins: Array<Promise<boolean>> = [];
  for (const attemptParams of keyParams) {
    const shared = joinInflightLivePriceL2Read(livePriceCacheKey(offer.id, attemptParams));
    if (!shared) {
      continue;
    }
    joins.push(
      shared.then((result) => {
        if (result.status !== 'found' || !result.record) {
          return false;
        }
        seedResultsLivePriceOverlayFromL2(
          offer.id,
          attemptParams,
          result.record.overlay as ResultsLivePriceOverlay,
          { cachedAtMs: result.record.cachedAtMs, ttlMs: result.record.ttlMs },
        );
        return true;
      }),
    );
  }
  if (joins.length === 0) {
    return 0;
  }
  const outcomes = await Promise.all(joins);
  return outcomes.filter(Boolean).length;
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
