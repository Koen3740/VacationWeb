import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import type { SearchParams } from '../../../types/travel';
import {
  limitRankedResultsForPagination,
  paginateResults,
  RESULTS_USER_PAGINATION_CAP,
} from '../../search/pagination';
import {
  applyResultsLivePriceOverlay,
  applyResultsLivePriceOverlays,
  getResultsLivePriceOverlay,
  hasResultsLivePriceOverlay,
  livePriceCacheKey,
  setResultsLivePriceOverlay,
} from '../../search/results-live-price-cache';
import {
  filterToResultsVisibleOffers,
  hasValidPresentablePrice,
  isResultsVisibleOffer,
  isUnpricedResultsOffer,
} from '../../search/presentable-price';
import { recordResultsPriceEligibility } from '../../search/results-price-eligibility';
import {
  LIVE_PRICE_ATTEMPT_REASON,
  LIVE_PRICE_ATTEMPT_STATUS,
  classifyLivePriceFailure,
  recordOfferLivePriceAttempt,
  type LivePriceFailureInput,
} from '../../search/live-price-observability';
import {
  PRIJSVRIJ_PAGE1_MAX_SLOTS,
  PRIJSVRIJ_PROVIDER_NAME,
  PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP,
} from './constants';
import type { FetchLike } from './auth';
import { buildPrijsvrijReceiptContext, resolvePrijsvrijReceiptOccupancy } from './receipt-context';
import { fetchPrijsvrijReceiptPrice } from './receipt-client';
import {
  CORENDON_LIVE_PAGE1_CONCURRENCY,
  buildCorendonLiveContext,
  fetchCorendonLivePrice,
  isCorendon,
  resolveCorendonLiveOccupancy,
} from '../corendon';
import {
  bindCorendonListing,
  corendonListingCacheKey,
  rankCorendonListings,
} from '../corendon/listing-selection';
import {
  ELIZA_LIVE_PAGE1_CONCURRENCY,
  buildElizaLiveContext,
  fetchElizaPromotedPrice,
  isEliza,
  resolveElizaLiveOccupancy,
} from '../eliza';
import {
  SUNWEB_LIVE_PAGE1_CONCURRENCY,
  buildSunwebLiveContext,
  fetchSunwebPromotedPrice,
  isSunweb,
  isSunwebFourTravellerTwoRoomSearch,
  resolveSunwebLiveOccupancy,
} from '../sunweb';

/** Product page size for Results (Master Plan §8.1a). */
export const RESULTS_PRODUCT_PAGE_SIZE = 10;

/**
 * Max concurrent Prijsvrij Receipt HTTP calls for page-1 pricing.
 * Matches capacity-harness primary reference C=5.
 */
export const PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY = 5;

/**
 * In-flight throttle for full-matchset live pricing. Not the page-1 safety cap.
 * Same width as page-1 C=5; separate binding so matchset never uses cap ≤10.
 */
export const PRIJSVRIJ_RECEIPT_MATCHSET_CONCURRENCY = 5;
const CORENDON_LIVE_MATCHSET_CONCURRENCY = 5;
const ELIZA_LIVE_MATCHSET_CONCURRENCY = 5;
const SUNWEB_LIVE_MATCHSET_CONCURRENCY = 5;

export type Page1ReceiptPricingStats = {
  receiptCalls: number;
  receiptSuccesses: number;
  receiptFailures: number;
  prijsvrijSlotsFilled: number;
  stoppedEarlyBecauseEnoughPv: boolean;
  /** Peak in-flight Receipt HTTP calls observed during this run (tests). */
  maxInFlightReceiptCalls?: number;
  /**
   * Receipt HTTP calls for the rest of the matchset after page-1 slot filling.
   * Not counted toward the page-1 safety cap.
   */
  matchsetReceiptCalls?: number;
  /** Peak in-flight matchset Receipt HTTP calls (tests). */
  maxInFlightMatchsetReceiptCalls?: number;
};

export type Page1ReceiptPricingOptions = {
  fetchImpl?: FetchLike;
  pageSize?: number;
  safetyCap?: number;
  maxPrijsvrijSlots?: number;
  concurrency?: number;
  /** Full-matchset in-flight throttle. Defaults to PRIJSVRIJ_RECEIPT_MATCHSET_CONCURRENCY. */
  matchsetConcurrency?: number;
  stats?: Page1ReceiptPricingStats;
  /**
   * Already-ranked user-pagination pool. Defaults to the first 150 of sortedOffers.
   * Live pricing still runs over the full sortedOffers matchset.
   */
  paginationPool?: TravelOffer[];
  userPaginationCap?: number;
};

/** Non-PV card can render immediately; PV card waits on its own Receipt/reserve promise. */
export type Page1StreamSlot =
  | { kind: 'immediate'; selectedIndex: number; offer: TravelOffer }
  | { kind: 'pending'; selectedIndex: number; offer: Promise<TravelOffer | null> };

export type Page1PresentedSlice = {
  page1: TravelOffer[];
  remaining: TravelOffer[];
  page1Ids: string[];
  /** Non-PV backfill appended after failed PV slots were compacted — not in the original slots. */
  trailingOffers: TravelOffer[];
  /** Visible offers in the user-pagination pool (≤150). Presentable live price or occupancy-unpriced. Not the raw match count. */
  paginationTotal: number;
};

export type Page1ReceiptStream = {
  slots: Page1StreamSlot[];
  presented: Promise<Page1PresentedSlice>;
};

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function isPrijsvrij(offer: TravelOffer): boolean {
  return offer.provider === PRIJSVRIJ_PROVIDER_NAME;
}

function withCatalogPriceHidden(offer: TravelOffer): TravelOffer {
  return {
    ...offer,
    livePriceStatus: 'unavailable',
    livePriceSource: undefined,
  };
}

function withUnpricedOffer(offer: TravelOffer): TravelOffer {
  return {
    ...offer,
    livePriceStatus: 'unpriced',
    livePriceSource: undefined,
  };
}

function withReceiptPrice(offer: TravelOffer, pricePerPerson: number): TravelOffer {
  const nights = offer.nights > 0 ? offer.nights : 0;
  return {
    ...offer,
    price: pricePerPerson,
    pricePerDay: nights > 0 ? Math.round(pricePerPerson / nights) : pricePerPerson,
    livePriceStatus: 'proven',
    livePriceSource: 'receipt',
  };
}

function withCorendonLivePrice(
  offer: TravelOffer,
  pricePerPerson: number,
  listing: { deepLink: string; host: string; feedId: string; campaignId?: string } | undefined,
  source: 'lowestpricesacco' | 'upsales',
): TravelOffer {
  const nights = offer.nights > 0 ? offer.nights : 0;
  const priced: TravelOffer = {
    ...offer,
    price: pricePerPerson,
    pricePerDay: nights > 0 ? Math.round(pricePerPerson / nights) : pricePerPerson,
    livePriceStatus: 'proven',
    livePriceSource: source,
  };
  return listing ? bindCorendonListing(priced, listing) : priced;
}

function withElizaLivePrice(offer: TravelOffer, pricePerPerson: number): TravelOffer {
  const nights = offer.nights > 0 ? offer.nights : 0;
  return {
    ...offer,
    price: pricePerPerson,
    pricePerDay: nights > 0 ? Math.round(pricePerPerson / nights) : pricePerPerson,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
  };
}

function withSunwebLivePrice(offer: TravelOffer, pricePerPerson: number): TravelOffer {
  const nights = offer.nights > 0 ? offer.nights : 0;
  return {
    ...offer,
    price: pricePerPerson,
    pricePerDay: nights > 0 ? Math.round(pricePerPerson / nights) : pricePerPerson,
    livePriceStatus: 'proven',
    livePriceSource: 'getPromotedPrice',
  };
}

function requiresPage1LivePrice(offer: TravelOffer, params?: SearchParams): boolean {
  if (isPrijsvrij(offer) || isCorendon(offer) || isEliza(offer)) {
    return true;
  }
  return Boolean(isSunweb(offer) && params && isSunwebFourTravellerTwoRoomSearch(params));
}

function isLivePriceOccupancySupported(offer: TravelOffer, params: SearchParams): boolean {
  if (isPrijsvrij(offer)) {
    return resolvePrijsvrijReceiptOccupancy(params).ok;
  }
  if (isCorendon(offer)) {
    return resolveCorendonLiveOccupancy(params).ok;
  }
  if (isEliza(offer)) {
    return resolveElizaLiveOccupancy(params).ok;
  }
  if (isSunweb(offer)) {
    return resolveSunwebLiveOccupancy(params).ok;
  }
  return true;
}

/** Page-1 may only select offers that can receive a proven live p.p. price. */
function canEnterResultsLivePipeline(offer: TravelOffer, params: SearchParams): boolean {
  if (hasValidPresentablePrice(offer)) {
    return true;
  }
  if (isUnpricedResultsOffer(offer) || offer.livePriceStatus === 'unavailable') {
    return false;
  }
  return requiresPage1LivePrice(offer, params) && isLivePriceOccupancySupported(offer, params);
}

function resolvePaginationPool(
  sortedOffers: TravelOffer[],
  options: Pick<Page1ReceiptPricingOptions, 'paginationPool' | 'userPaginationCap'>,
): TravelOffer[] {
  if (options.paginationPool) {
    return options.paginationPool;
  }
  return limitRankedResultsForPagination(
    sortedOffers,
    options.userPaginationCap ?? RESULTS_USER_PAGINATION_CAP,
  );
}

const pvReceiptInflight = new Map<string, Promise<void>>();
const corendonLiveInflight = new Map<string, Promise<void>>();
const elizaLiveInflight = new Map<string, Promise<void>>();
const sunwebLiveInflight = new Map<string, Promise<void>>();

async function joinOrStartInflight(
  map: Map<string, Promise<void>>,
  key: string,
  work: () => Promise<void>,
): Promise<'joined' | 'started'> {
  const existing = map.get(key);
  if (existing) {
    await existing;
    return 'joined';
  }
  const started = work().finally(() => {
    if (map.get(key) === started) {
      map.delete(key);
    }
  });
  map.set(key, started);
  await started;
  return 'started';
}

async function runPrijsvrijReceiptIntoCache(
  offer: TravelOffer,
  params: SearchParams,
  fetchImpl: FetchLike,
): Promise<'http' | 'joined' | 'cached' | 'unavailable'> {
  if (hasResultsLivePriceOverlay(offer.id, params)) {
    return 'cached';
  }
  if (!resolvePrijsvrijReceiptOccupancy(params).ok) {
    cacheUnpricedLivePrice(offer, params);
    return 'cached';
  }
  const key = livePriceCacheKey(offer.id, params);
  let didHttp = false;
  const mode = await joinOrStartInflight(pvReceiptInflight, key, async () => {
    if (hasResultsLivePriceOverlay(offer.id, params)) {
      return;
    }
    const ctx = buildPrijsvrijReceiptContext(offer, params);
    if (!ctx) {
      cacheUnavailableLivePrice(offer, params, { reason: 'missing_context' });
      return;
    }
    didHttp = true;
    try {
      const result = await fetchPrijsvrijReceiptPrice(ctx, { fetchImpl });
      if (result.ok) {
        cacheLiveOverlay(withReceiptPrice(offer, result.price.pricePerPerson), params);
      } else {
        cacheUnavailableLivePrice(offer, params, result);
      }
    } catch {
      cacheUnavailableLivePrice(offer, params, { reason: 'exception' });
    }
  });
  if (mode === 'joined') {
    return 'joined';
  }
  if (didHttp) {
    return 'http';
  }
  return hasResultsLivePriceOverlay(offer.id, params) ? 'cached' : 'unavailable';
}

function listingCacheParams(params: SearchParams, listing: { host: string; feedId: string }): SearchParams & { listingKey: string } {
  return { ...params, listingKey: corendonListingCacheKey(listing) };
}

async function runCorendonLiveIntoCache(
  offer: TravelOffer,
  params: SearchParams,
  fetchImpl: FetchLike,
): Promise<void> {
  if (!resolveCorendonLiveOccupancy(params).ok) {
    cacheUnpricedLivePrice(offer, params);
    return;
  }

  const listings = rankCorendonListings(offer, params);
  if (listings.length === 0) {
    cacheUnavailableLivePrice(offer, params, { reason: 'no_listings' });
    return;
  }

  for (const listing of listings) {
    const listingParams = listingCacheParams(params, listing);
    const cached = getResultsLivePriceOverlay(offer.id, listingParams);
    if (cached?.livePriceStatus === 'proven') {
      return;
    }
    if (cached) {
      continue;
    }

    const ctx = buildCorendonLiveContext(offer, params, listing);
    if (!ctx) {
      cacheUnavailableLivePrice(bindCorendonListing(offer, listing), listingParams, {
        reason: 'missing_context',
      });
      continue;
    }

    const key = livePriceCacheKey(offer.id, listingParams);
    await joinOrStartInflight(corendonLiveInflight, key, async () => {
      if (hasResultsLivePriceOverlay(offer.id, listingParams)) {
        return;
      }
      try {
        const result = await fetchCorendonLivePrice(ctx, { fetchImpl });
        if (result.ok) {
          cacheLiveOverlay(withCorendonLivePrice(offer, result.pricePerPerson, listing, result.source), listingParams);
        } else {
          cacheUnavailableLivePrice(bindCorendonListing(offer, listing), listingParams, result);
        }
      } catch {
        cacheUnavailableLivePrice(bindCorendonListing(offer, listing), listingParams, {
          reason: 'exception',
        });
      }
    });

    const after = getResultsLivePriceOverlay(offer.id, listingParams);
    if (after?.livePriceStatus === 'proven') {
      return;
    }
  }
}

async function runElizaLiveIntoCache(
  offer: TravelOffer,
  params: SearchParams,
  fetchImpl: FetchLike,
): Promise<void> {
  if (hasResultsLivePriceOverlay(offer.id, params)) {
    return;
  }
  if (!resolveElizaLiveOccupancy(params).ok) {
    cacheUnpricedLivePrice(offer, params);
    return;
  }
  const key = livePriceCacheKey(offer.id, params);
  await joinOrStartInflight(elizaLiveInflight, key, async () => {
    if (hasResultsLivePriceOverlay(offer.id, params)) {
      return;
    }
    const ctx = buildElizaLiveContext(offer, params);
    if (!ctx) {
      cacheUnavailableLivePrice(offer, params, { reason: 'missing_context' });
      return;
    }
    try {
      const result = await fetchElizaPromotedPrice(ctx, { fetchImpl });
      if (result.ok) {
        cacheLiveOverlay(withElizaLivePrice(offer, result.pricePerPerson), params);
      } else {
        cacheUnavailableLivePrice(offer, params, result);
      }
    } catch {
      cacheUnavailableLivePrice(offer, params, { reason: 'exception' });
    }
  });
}

async function runSunwebLiveIntoCache(
  offer: TravelOffer,
  params: SearchParams,
  fetchImpl: FetchLike,
): Promise<void> {
  if (hasResultsLivePriceOverlay(offer.id, params)) {
    return;
  }
  if (!resolveSunwebLiveOccupancy(params).ok) {
    cacheUnpricedLivePrice(offer, params);
    return;
  }
  const key = livePriceCacheKey(offer.id, params);
  await joinOrStartInflight(sunwebLiveInflight, key, async () => {
    if (hasResultsLivePriceOverlay(offer.id, params)) {
      return;
    }
    const ctx = buildSunwebLiveContext(offer, params);
    if (!ctx) {
      cacheUnavailableLivePrice(offer, params, { reason: 'missing_context' });
      return;
    }
    try {
      const result = await fetchSunwebPromotedPrice(ctx, { fetchImpl });
      if (result.ok) {
        cacheLiveOverlay(withSunwebLivePrice(offer, result.pricePerPerson), params);
      } else {
        cacheUnavailableLivePrice(offer, params, result);
      }
    } catch {
      cacheUnavailableLivePrice(offer, params, { reason: 'exception' });
    }
  });
}

function cacheLiveOverlay(offer: TravelOffer, params: SearchParams & { listingKey?: string }): void {
  const existing = getResultsLivePriceOverlay(offer.id, params);
  setResultsLivePriceOverlay(offer.id, params, {
    price: offer.price,
    pricePerDay: offer.pricePerDay,
    livePriceStatus: offer.livePriceStatus,
    livePriceSource: offer.livePriceSource,
    deepLink: offer.deepLink,
    listingHost: offer.listingHost,
    feedSourceId: offer.feedSourceId,
    affiliateCampaignId: offer.affiliateCampaignId,
  });
  if (!existing && offer.livePriceStatus === 'proven') {
    recordOfferLivePriceAttempt(offer, params, {
      status: LIVE_PRICE_ATTEMPT_STATUS.SUCCESS,
      reason: LIVE_PRICE_ATTEMPT_REASON.proven_live_price,
    });
  }
}

function cacheUnavailableLivePrice(
  offer: TravelOffer,
  params: SearchParams & { listingKey?: string },
  failure: LivePriceFailureInput,
): TravelOffer {
  const existing = getResultsLivePriceOverlay(offer.id, params);
  const hidden = withCatalogPriceHidden(offer);
  cacheLiveOverlay(hidden, params);
  if (!existing) {
    recordOfferLivePriceAttempt(offer, params, classifyLivePriceFailure(failure));
  }
  return hidden;
}

function cacheUnpricedLivePrice(
  offer: TravelOffer,
  params: SearchParams & { listingKey?: string },
): TravelOffer {
  const existing = getResultsLivePriceOverlay(offer.id, params);
  if (existing?.livePriceStatus === 'unpriced') {
    return applyResultsLivePriceOverlay(offer, params);
  }
  const unpriced = withUnpricedOffer(offer);
  cacheLiveOverlay(unpriced, params);
  if (!existing) {
    recordOfferLivePriceAttempt(unpriced, params, {
      status: LIVE_PRICE_ATTEMPT_STATUS.UNPRICED,
      reason: LIVE_PRICE_ATTEMPT_REASON.occupancy_unsupported,
    });
  }
  return unpriced;
}

/**
 * Stamp occupancy-unpriced overlays without live HTTP.
 * Live occupancy outside the proven route is not the same as live unavailability.
 */
export function stampUnpricedWhenLiveOccupancyUnsupported(
  offers: readonly TravelOffer[],
  params: SearchParams,
): void {
  for (const offer of offers) {
    if (!requiresPage1LivePrice(offer, params)) {
      continue;
    }
    if (isLivePriceOccupancySupported(offer, params)) {
      continue;
    }
    if (hasResultsLivePriceOverlay(offer.id, params)) {
      continue;
    }
    cacheUnpricedLivePrice(offer, params);
  }
}

/**
 * Cache lookup before any live HTTP.
 * - TravelOffer: reusable proven live price, or occupancy-unpriced (excluded from Results)
 * - null: cached unavailable / fail-closed — do not HTTP, do not present catalog price
 * - undefined: miss (expired or never stored)
 */
function cachedLivePriceResult(
  offer: TravelOffer,
  params: SearchParams,
): TravelOffer | null | undefined {
  if (isCorendon(offer)) {
    const merged = applyResultsLivePriceOverlay(offer, params);
    if (hasValidPresentablePrice(merged) || isUnpricedResultsOffer(merged)) {
      return merged;
    }
    const listings = rankCorendonListings(offer, params);
    if (listings.length === 0) {
      const overlay = getResultsLivePriceOverlay(offer.id, params);
      if (!overlay) {
        return undefined;
      }
      return isUnpricedResultsOffer({ ...offer, ...overlay }) ? { ...offer, ...overlay } : null;
    }
    const overlays = listings.map((listing) =>
      getResultsLivePriceOverlay(offer.id, listingCacheParams(params, listing)),
    );
    if (overlays.some((overlay) => !overlay)) {
      return undefined;
    }
    return null;
  }

  const overlay = getResultsLivePriceOverlay(offer.id, params);
  if (!overlay) {
    return undefined;
  }
  const merged = applyResultsLivePriceOverlay(offer, params);
  if (hasValidPresentablePrice(merged) || isUnpricedResultsOffer(merged)) {
    return merged;
  }
  return null;
}

/**
 * Run async work over items with a hard concurrency ceiling.
 * Does not start more than `concurrency` workers at once.
 */
/** Test-only: drop in-flight coalescing so parallel files cannot share HTTP work. */
export function clearLivePriceInflightForTests(): void {
  pvReceiptInflight.clear();
  corendonLiveInflight.clear();
  elizaLiveInflight.clear();
  sunwebLiveInflight.clear();
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}

/**
 * Live-price every Prijsvrij / Corendon / Eliza / Sunweb-4p-2r offer that does
 * not yet have an occupancy overlay. Uses existing clients and matchset
 * concurrency (not the page-1 safety cap). No product cap of 3 or 10.
 */
export async function priceLiveRequiredMatchset(
  offers: TravelOffer[],
  params: SearchParams,
  options: Pick<
    Page1ReceiptPricingOptions,
    'fetchImpl' | 'concurrency' | 'matchsetConcurrency' | 'stats'
  > = {},
): Promise<TravelOffer[]> {
  stampUnpricedWhenLiveOccupancyUnsupported(offers, params);
  const fetchImpl = options.fetchImpl ?? fetch;
  const concurrency =
    options.matchsetConcurrency ??
    options.concurrency ??
    PRIJSVRIJ_RECEIPT_MATCHSET_CONCURRENCY;
  const pv: TravelOffer[] = [];
  const corendon: TravelOffer[] = [];
  const eliza: TravelOffer[] = [];
  const sunweb: TravelOffer[] = [];

  for (const offer of offers) {
    if (!isCorendon(offer) && hasResultsLivePriceOverlay(offer.id, params)) {
      continue;
    }
    if (isPrijsvrij(offer)) {
      if (!resolvePrijsvrijReceiptOccupancy(params).ok) {
        continue;
      }
      pv.push(offer);
    } else if (isCorendon(offer)) {
      if (!resolveCorendonLiveOccupancy(params).ok) {
        continue;
      }
      corendon.push(offer);
    } else if (isEliza(offer)) {
      if (!resolveElizaLiveOccupancy(params).ok) {
        continue;
      }
      eliza.push(offer);
    } else if (isSunweb(offer)) {
      if (!resolveSunwebLiveOccupancy(params).ok) {
        continue;
      }
      sunweb.push(offer);
    }
  }

  let matchsetReceiptCalls = 0;
  let inFlight = 0;
  let maxInFlight = 0;

  await Promise.all([
    mapWithConcurrency(pv, concurrency, async (offer) => {
      if (hasResultsLivePriceOverlay(offer.id, params)) {
        return;
      }
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        const outcome = await runPrijsvrijReceiptIntoCache(offer, params, fetchImpl);
        if (outcome === 'http') {
          matchsetReceiptCalls += 1;
        }
      } finally {
        inFlight -= 1;
      }
    }),
    mapWithConcurrency(corendon, CORENDON_LIVE_MATCHSET_CONCURRENCY, async (offer) => {
      await runCorendonLiveIntoCache(offer, params, fetchImpl);
    }),
    mapWithConcurrency(eliza, ELIZA_LIVE_MATCHSET_CONCURRENCY, async (offer) => {
      await runElizaLiveIntoCache(offer, params, fetchImpl);
    }),
    mapWithConcurrency(sunweb, SUNWEB_LIVE_MATCHSET_CONCURRENCY, async (offer) => {
      await runSunwebLiveIntoCache(offer, params, fetchImpl);
    }),
  ]);

  if (options.stats) {
    options.stats.matchsetReceiptCalls =
      (options.stats.matchsetReceiptCalls ?? 0) + matchsetReceiptCalls;
    options.stats.maxInFlightMatchsetReceiptCalls = Math.max(
      options.stats.maxInFlightMatchsetReceiptCalls ?? 0,
      maxInFlight,
    );
  }

  return applyResultsLivePriceOverlays(offers, params);
}

function overlaidPaginationSlice(
  sortedOffers: TravelOffer[],
  page1: TravelOffer[],
  options: Pick<Page1ReceiptPricingOptions, 'paginationPool' | 'userPaginationCap'>,
  params: SearchParams,
): Pick<Page1PresentedSlice, 'remaining' | 'paginationTotal'> {
  const pool = applyResultsLivePriceOverlays(resolvePaginationPool(sortedOffers, options), params);
  return {
    remaining: buildRemainingFromPresentedPage1(pool, page1),
    paginationTotal: filterToResultsVisibleOffers(pool).length,
  };
}

/**
 * Local page-1 composition from already filtered/sorted offers.
 * Prefer non-Prijsvrij until soft max PV slots; allow more PV when alternatives lack.
 * Does not call Receipt.
 */
export function selectPage1Candidates(
  sortedOffers: TravelOffer[],
  pageSize: number = RESULTS_PRODUCT_PAGE_SIZE,
  maxPrijsvrijSlots: number = PRIJSVRIJ_PAGE1_MAX_SLOTS,
): { selected: TravelOffer[]; prijsvrijReserves: TravelOffer[] } {
  const selected: TravelOffer[] = [];
  const selectedIds = new Set<string>();
  let pvCount = 0;

  for (const offer of sortedOffers) {
    if (selected.length >= pageSize) {
      break;
    }
    if (isPrijsvrij(offer)) {
      if (pvCount >= maxPrijsvrijSlots) {
        continue;
      }
      selected.push(offer);
      selectedIds.add(offer.id);
      pvCount += 1;
      continue;
    }
    selected.push(offer);
    selectedIds.add(offer.id);
  }

  // Fill remaining slots (may add extra Prijsvrij when alternatives are insufficient).
  if (selected.length < pageSize) {
    for (const offer of sortedOffers) {
      if (selected.length >= pageSize) {
        break;
      }
      if (selectedIds.has(offer.id)) {
        continue;
      }
      selected.push(offer);
      selectedIds.add(offer.id);
    }
  }

  const prijsvrijReserves = sortedOffers.filter(
    (offer) => isPrijsvrij(offer) && !selectedIds.has(offer.id),
  );

  return { selected, prijsvrijReserves };
}

function isProvenSunwebGetPromotedPrice(offer: TravelOffer): boolean {
  return (
    isSunweb(offer) &&
    offer.livePriceStatus === 'proven' &&
    offer.livePriceSource === 'getPromotedPrice' &&
    hasValidPresentablePrice(offer)
  );
}

function isSunwebFourPaxLivePage1Candidate(offer: TravelOffer, params: SearchParams): boolean {
  return (
    isSunweb(offer) &&
    isSunwebFourTravellerTwoRoomSearch(params) &&
    resolveSunwebLiveOccupancy(params).ok &&
    Boolean(buildSunwebLiveContext(offer, params))
  );
}

/**
 * Page-1 selection prefers non-Prijsvrij in rank order, so Corendon/Eliza can
 * fill all 10 slots and Sunweb 4p/2r never becomes a pending GetPromotedPrice
 * slot. The 150-offer pagination pool can also omit Sunweb entirely on a large
 * matchset. Underfill skipped live-required Sunweb, so proven live € never
 * reached a card. Keep 2A catalog selection unchanged; splice live-capable
 * Sunweb from the full ranked matchset into 4p/2r page-1.
 */
function ensureSunwebFourPaxLivePage1Slots(
  selected: TravelOffer[],
  pool: TravelOffer[],
  params: SearchParams,
  pageSize: number,
): TravelOffer[] {
  if (!isSunwebFourTravellerTwoRoomSearch(params) || !resolveSunwebLiveOccupancy(params).ok) {
    return selected;
  }

  const next = selected.slice(0, pageSize);
  const selectedIds = new Set(next.map((offer) => offer.id));
  const extras = pool.filter(
    (offer) => isSunwebFourPaxLivePage1Candidate(offer, params) && !selectedIds.has(offer.id),
  );
  if (extras.length === 0) {
    return next;
  }

  const liveCount = (): number =>
    next.filter((offer) => isSunwebFourPaxLivePage1Candidate(offer, params)).length;
  const want = Math.min(SUNWEB_LIVE_PAGE1_CONCURRENCY, pageSize, liveCount() + extras.length);
  let extraIndex = 0;

  for (let i = next.length - 1; i >= 0 && liveCount() < want && extraIndex < extras.length; i -= 1) {
    if (isSunwebFourPaxLivePage1Candidate(next[i], params) || isPrijsvrij(next[i])) {
      continue;
    }
    next[i] = extras[extraIndex];
    extraIndex += 1;
  }

  while (next.length < pageSize && extraIndex < extras.length && liveCount() < want) {
    next.push(extras[extraIndex]);
    extraIndex += 1;
  }

  return next;
}

/**
 * Explicit page-1 selection + remaining resultset for pagination.
 *
 * - page1: diversity selection (max 3 Prijsvrij soft cap; fill from ranking).
 * - remaining: original filtered/sorted order minus **only** offers actually
 *   selected for page 1 (skipped Prijsvrij stay in remaining for page 2+).
 *
 * Does not call Receipt. Does not re-rank.
 *
 * NOTE: After Receipt reserve/backfill, remaining MUST be rebuilt from the
 * presented page-1 IDs via {@link buildRemainingFromPresentedPage1} — otherwise
 * a reserve that replaced a failed primary can still appear on page 2+.
 */
export function splitPage1AndRemaining(
  sortedOffers: TravelOffer[],
  pageSize: number = RESULTS_PRODUCT_PAGE_SIZE,
  maxPrijsvrijSlots: number = PRIJSVRIJ_PAGE1_MAX_SLOTS,
): {
  page1: TravelOffer[];
  remaining: TravelOffer[];
  prijsvrijReserves: TravelOffer[];
} {
  const { selected, prijsvrijReserves } = selectPage1Candidates(
    sortedOffers,
    pageSize,
    maxPrijsvrijSlots,
  );
  const selectedIds = new Set(selected.map((offer) => offer.id));
  const remaining = sortedOffers.filter((offer) => !selectedIds.has(offer.id));
  return { page1: selected, remaining, prijsvrijReserves };
}

/**
 * Remaining after page-1 Presentation (post-Receipt).
 * Excludes every offer ID actually shown on page 1 (primaries, reserves, non-PV fill).
 * Guarantees: presented ∩ remaining = ∅ and (by id) original = presented ∪ remaining.
 */
export function buildRemainingFromPresentedPage1(
  sortedOffers: TravelOffer[],
  presentedPage1: TravelOffer[],
): TravelOffer[] {
  return buildRemainingFromPresentedPage1Ids(
    sortedOffers,
    presentedPage1.map((offer) => offer.id),
  );
}

/**
 * Remaining after page-1 presentation, from definitive presented IDs only.
 * Used by page 2+ when those IDs are carried from the page-1 request (no Receipt).
 */
export function buildRemainingFromPresentedPage1Ids(
  sortedOffers: TravelOffer[],
  presentedIds: readonly string[],
): TravelOffer[] {
  const presentedIdSet = new Set(presentedIds);
  return sortedOffers.filter((offer) => !presentedIdSet.has(offer.id));
}

/**
 * Site page → visible slice after page-1 split.
 * page 1 = selected page1; page 2+ = paginate(remaining) with no diversity rule.
 */
export function getResultsPageOffers(
  sortedOffers: TravelOffer[],
  page: number,
  pageSize: number = RESULTS_PRODUCT_PAGE_SIZE,
  maxPrijsvrijSlots: number = PRIJSVRIJ_PAGE1_MAX_SLOTS,
): TravelOffer[] {
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const { page1, remaining } = splitPage1AndRemaining(
    sortedOffers,
    pageSize,
    maxPrijsvrijSlots,
  );

  if (safePage === 1) {
    return page1;
  }

  // Site page 2 → remaining index 1 → slice(0, pageSize)
  return paginateResults(remaining, safePage - 1, pageSize);
}

/**
 * Starts the existing page-1 Receipt pipeline without awaiting it.
 *
 * Non-PV selected cards are returned immediately. Each PV slot gets its own
 * promise that resolves as soon as that slot is filled (primary success, or
 * later reserve). `presented` resolves only after success/failure/reserve/
 * backfill — page1Ids must be read from there, never earlier.
 *
 * Page-1 display still uses max 3 Prijsvrij + slot-fill safety cap ≤10.
 * Full-matchset live pricing is launched separately and is not awaited here.
 */
export function startPage1ReceiptStream(
  sortedOffers: TravelOffer[],
  params: SearchParams,
  options: Page1ReceiptPricingOptions = {},
): Page1ReceiptStream {
  const pageSize = options.pageSize ?? RESULTS_PRODUCT_PAGE_SIZE;
  const safetyCap = options.safetyCap ?? PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP;
  const maxPrijsvrijSlots = options.maxPrijsvrijSlots ?? PRIJSVRIJ_PAGE1_MAX_SLOTS;
  const concurrency = options.concurrency ?? PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY;
  const fetchImpl = options.fetchImpl ?? fetch;
  const paginationPool = resolvePaginationPool(sortedOffers, options);
  stampUnpricedWhenLiveOccupancyUnsupported(sortedOffers, params);
  recordResultsPriceEligibility(
    applyResultsLivePriceOverlays(sortedOffers, params),
    params,
    { phase: 'before-live' },
  );

  const liveSelectable = paginationPool.filter((offer) => canEnterResultsLivePipeline(offer, params));
  const { selected: rankedSelected, prijsvrijReserves } = selectPage1Candidates(
    liveSelectable,
    pageSize,
    maxPrijsvrijSlots,
  );
  const selected = ensureSunwebFourPaxLivePage1Slots(
    rankedSelected,
    sortedOffers,
    params,
    pageSize,
  );

  const slotResults: Array<TravelOffer | null> = selected.map((offer) => {
    if (isPrijsvrij(offer)) {
      if (!resolvePrijsvrijReceiptOccupancy(params).ok) {
        return cacheUnpricedLivePrice(offer, params);
      }
      const cached = cachedLivePriceResult(offer, params);
      if (cached) {
        return cached;
      }
      return null;
    }
    if (isCorendon(offer)) {
      if (!resolveCorendonLiveOccupancy(params).ok) {
        return cacheUnpricedLivePrice(offer, params);
      }
      const cached = cachedLivePriceResult(offer, params);
      if (cached) {
        return cached;
      }
      if (cached === null) {
        return withCatalogPriceHidden(offer);
      }
      const canAttempt = rankCorendonListings(offer, params).some((listing) =>
        Boolean(buildCorendonLiveContext(offer, params, listing)),
      );
      if (!canAttempt) {
        return withCatalogPriceHidden(offer);
      }
      return null;
    }
    if (isEliza(offer)) {
      if (!resolveElizaLiveOccupancy(params).ok) {
        return cacheUnpricedLivePrice(offer, params);
      }
      const cached = cachedLivePriceResult(offer, params);
      if (cached) {
        return cached;
      }
      if (cached === null) {
        return withCatalogPriceHidden(offer);
      }
      if (!buildElizaLiveContext(offer, params)) {
        return withCatalogPriceHidden(offer);
      }
      return null;
    }
    if (isSunweb(offer) && requiresPage1LivePrice(offer, params)) {
      if (!resolveSunwebLiveOccupancy(params).ok) {
        return cacheUnpricedLivePrice(offer, params);
      }
      const cached = cachedLivePriceResult(offer, params);
      if (cached) {
        return cached;
      }
      if (cached === null) {
        return withCatalogPriceHidden(offer);
      }
      if (!buildSunwebLiveContext(offer, params)) {
        return withCatalogPriceHidden(offer);
      }
      return null;
    }
    return {
      ...offer,
      livePriceStatus: 'catalog' as const,
      livePriceSource: 'feed' as const,
    };
  });

  type PvSlot = { selectedIndex: number; primary: TravelOffer };
  const pvSlots: PvSlot[] = [];
  const corendonSlots: Array<{ selectedIndex: number; offer: TravelOffer }> = [];
  const elizaSlots: Array<{ selectedIndex: number; offer: TravelOffer }> = [];
  const sunwebSlots: Array<{ selectedIndex: number; offer: TravelOffer }> = [];
  const slotDeferreds = new Map<number, ReturnType<typeof createDeferred<TravelOffer | null>>>();
  for (let i = 0; i < selected.length; i += 1) {
    const offer = selected[i];
    if (isPrijsvrij(offer) && slotResults[i] === null) {
      pvSlots.push({ selectedIndex: i, primary: offer });
      slotDeferreds.set(i, createDeferred<TravelOffer | null>());
    } else if (isCorendon(offer) && slotResults[i] === null) {
      corendonSlots.push({ selectedIndex: i, offer });
      slotDeferreds.set(i, createDeferred<TravelOffer | null>());
    } else if (isEliza(offer) && slotResults[i] === null) {
      elizaSlots.push({ selectedIndex: i, offer });
      slotDeferreds.set(i, createDeferred<TravelOffer | null>());
    } else if (isSunweb(offer) && slotResults[i] === null) {
      sunwebSlots.push({ selectedIndex: i, offer });
      slotDeferreds.set(i, createDeferred<TravelOffer | null>());
    }
  }

  const slots: Page1StreamSlot[] = selected.map((offer, selectedIndex) => {
    if (
      (isPrijsvrij(offer) && slotResults[selectedIndex] === null) ||
      (isCorendon(offer) && slotResults[selectedIndex] === null) ||
      (isEliza(offer) && slotResults[selectedIndex] === null) ||
      (isSunweb(offer) && slotResults[selectedIndex] === null)
    ) {
      return {
        kind: 'pending',
        selectedIndex,
        offer: slotDeferreds.get(selectedIndex)!.promise,
      };
    }
    return {
      kind: 'immediate',
      selectedIndex,
      offer: slotResults[selectedIndex] as TravelOffer,
    };
  });

  const presented = (async (): Promise<Page1PresentedSlice> => {
    const plannedPvSlots = pvSlots.length;
    let receiptCalls = 0;
    let receiptSuccesses = 0;
    let receiptFailures = 0;
    let prijsvrijSlotsFilled = 0;
    let reserveIndex = 0;
    let inFlight = 0;
    let maxInFlight = 0;

    function settleSlot(selectedIndex: number, offer: TravelOffer | null): void {
      slotResults[selectedIndex] = offer;
      slotDeferreds.get(selectedIndex)?.resolve(offer);
    }

    async function tryReceipt(candidate: TravelOffer): Promise<TravelOffer | null> {
      if (!resolvePrijsvrijReceiptOccupancy(params).ok) {
        const unpriced = cacheUnpricedLivePrice(candidate, params);
        prijsvrijSlotsFilled += 1;
        return unpriced;
      }
      const cached = cachedLivePriceResult(candidate, params);
      if (cached) {
        prijsvrijSlotsFilled += 1;
        return cached;
      }
      if (cached === null) {
        return null;
      }

      const inflightKey = livePriceCacheKey(candidate.id, params);
      const joining = pvReceiptInflight.has(inflightKey);
      if (!joining) {
        if (receiptCalls >= safetyCap) {
          return null;
        }
        const ctx = buildPrijsvrijReceiptContext(candidate, params);
        if (!ctx) {
          cacheUnavailableLivePrice(candidate, params, { reason: 'missing_context' });
          return null;
        }
        if (receiptCalls >= safetyCap) {
          return null;
        }
        receiptCalls += 1;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
      }

      try {
        const outcome = await runPrijsvrijReceiptIntoCache(candidate, params, fetchImpl);
        const after = cachedLivePriceResult(candidate, params);
        if (after) {
          if (!joining && outcome === 'http') {
            receiptSuccesses += 1;
          }
          prijsvrijSlotsFilled += 1;
          return after;
        }
        if (!joining && outcome === 'http') {
          receiptFailures += 1;
        }
        return null;
      } finally {
        if (!joining) {
          inFlight -= 1;
        }
      }
    }

    async function priceCorendonSlot(offer: TravelOffer): Promise<TravelOffer | null> {
      if (!resolveCorendonLiveOccupancy(params).ok) {
        return cacheUnpricedLivePrice(offer, params);
      }
      const cached = cachedLivePriceResult(offer, params);
      if (cached) {
        return cached;
      }
      if (cached === null) {
        return null;
      }
      await runCorendonLiveIntoCache(offer, params, fetchImpl);
      return cachedLivePriceResult(offer, params) ?? null;
    }

    async function priceElizaSlot(offer: TravelOffer): Promise<TravelOffer | null> {
      if (!resolveElizaLiveOccupancy(params).ok) {
        return cacheUnpricedLivePrice(offer, params);
      }
      const cached = cachedLivePriceResult(offer, params);
      if (cached) {
        return cached;
      }
      if (cached === null) {
        return null;
      }
      await runElizaLiveIntoCache(offer, params, fetchImpl);
      return cachedLivePriceResult(offer, params) ?? null;
    }

    async function priceSunwebSlot(offer: TravelOffer): Promise<TravelOffer | null> {
      if (!resolveSunwebLiveOccupancy(params).ok) {
        return cacheUnpricedLivePrice(offer, params);
      }
      const cached = cachedLivePriceResult(offer, params);
      if (cached) {
        return cached;
      }
      if (cached === null) {
        return null;
      }
      await runSunwebLiveIntoCache(offer, params, fetchImpl);
      return cachedLivePriceResult(offer, params) ?? null;
    }

    // Phase 1: PV Receipts (C=5), Corendon, Eliza PromotedPrice, and Sunweb PromotedPrice in parallel.
    // Settle each successful slot as soon as its own live call returns.
    const [, , , primaryResults] = await Promise.all([
      mapWithConcurrency(
        corendonSlots,
        CORENDON_LIVE_PAGE1_CONCURRENCY,
        async (slot) => {
          const priced = await priceCorendonSlot(slot.offer);
          settleSlot(slot.selectedIndex, priced);
          return priced;
        },
      ),
      mapWithConcurrency(
        elizaSlots,
        ELIZA_LIVE_PAGE1_CONCURRENCY,
        async (slot) => {
          const priced = await priceElizaSlot(slot.offer);
          settleSlot(slot.selectedIndex, priced);
          return priced;
        },
      ),
      mapWithConcurrency(
        sunwebSlots,
        SUNWEB_LIVE_PAGE1_CONCURRENCY,
        async (slot) => {
          const priced = await priceSunwebSlot(slot.offer);
          settleSlot(slot.selectedIndex, priced);
          return priced;
        },
      ),
      mapWithConcurrency(
        pvSlots,
        concurrency,
        async (slot) => {
          const priced = await tryReceipt(slot.primary);
          if (priced) {
            settleSlot(slot.selectedIndex, priced);
          }
          return priced;
        },
      ),
    ]);

    const openSlots: number[] = [];
    for (let i = 0; i < pvSlots.length; i += 1) {
      if (!primaryResults[i]) {
        openSlots.push(pvSlots[i].selectedIndex);
      }
    }

    // Phase 2: fill failed slots from reserves, still under C=5 and safety cap.
    while (
      openSlots.length > 0 &&
      reserveIndex < prijsvrijReserves.length &&
      receiptCalls < safetyCap
    ) {
      const batchSize = Math.min(
        concurrency,
        openSlots.length,
        prijsvrijReserves.length - reserveIndex,
        safetyCap - receiptCalls,
      );
      if (batchSize <= 0) {
        break;
      }

      const batch = Array.from({ length: batchSize }, () => {
        const selectedIndex = openSlots.shift()!;
        const reserve = prijsvrijReserves[reserveIndex];
        reserveIndex += 1;
        return { selectedIndex, reserve };
      });

      const batchResults = await mapWithConcurrency(
        batch,
        concurrency,
        async (item) => {
          const priced = await tryReceipt(item.reserve);
          if (priced) {
            settleSlot(item.selectedIndex, priced);
          }
          return priced;
        },
      );

      for (let i = 0; i < batch.length; i += 1) {
        if (!batchResults[i]) {
          openSlots.push(batch[i].selectedIndex);
        }
      }
    }

    for (const selectedIndex of openSlots) {
      settleSlot(selectedIndex, null);
    }

    const finalOffers: TravelOffer[] = [];
    for (const slot of slotResults) {
      if (slot && isResultsVisibleOffer(slot)) {
        finalOffers.push(slot);
      }
    }

    const filledIds = new Set(finalOffers.map((offer) => offer.id));

    // Sunweb 4p/2r is live-required: do not skip it in underfill. Only proven
    // GetPromotedPrice may fill — never catalog/feed €.
    if (
      finalOffers.length < pageSize &&
      isSunwebFourTravellerTwoRoomSearch(params) &&
      resolveSunwebLiveOccupancy(params).ok
    ) {
      const sunwebCandidates = sortedOffers.filter((offer) => {
        if (filledIds.has(offer.id) || !isSunweb(offer)) {
          return false;
        }
        const cached = cachedLivePriceResult(offer, params);
        if (cached && isProvenSunwebGetPromotedPrice(cached)) {
          return true;
        }
        if (cached === null) {
          return false;
        }
        return isSunwebFourPaxLivePage1Candidate(offer, params);
      });

      const sunwebPriced = await mapWithConcurrency(
        sunwebCandidates.slice(0, pageSize),
        SUNWEB_LIVE_PAGE1_CONCURRENCY,
        async (offer) => {
          const cached = cachedLivePriceResult(offer, params);
          if (cached && isProvenSunwebGetPromotedPrice(cached)) {
            return cached;
          }
          await runSunwebLiveIntoCache(offer, params, fetchImpl);
          const after = cachedLivePriceResult(offer, params);
          return after && isProvenSunwebGetPromotedPrice(after) ? after : null;
        },
      );

      for (const priced of sunwebPriced) {
        if (finalOffers.length >= pageSize) {
          break;
        }
        if (!priced || filledIds.has(priced.id)) {
          continue;
        }
        finalOffers.push(priced);
        filledIds.add(priced.id);
      }
    }

    // If page under-filled after PV/Corendon failures, add remaining presentable non-PV.
    if (finalOffers.length < pageSize) {
      for (const offer of paginationPool) {
        if (finalOffers.length >= pageSize) {
          break;
        }
        if (filledIds.has(offer.id) || requiresPage1LivePrice(offer, params)) {
          continue;
        }
        const candidate = {
          ...offer,
          livePriceStatus: offer.livePriceStatus ?? ('catalog' as const),
          livePriceSource: offer.livePriceSource ?? ('feed' as const),
        };
        if (!isResultsVisibleOffer(candidate)) {
          continue;
        }
        finalOffers.push(candidate);
        filledIds.add(offer.id);
      }
    }

    const page1 = finalOffers.slice(0, pageSize);
    const trailingOffers = page1.filter((offer) => !slotResults.some((slot) => slot?.id === offer.id));

    if (options.stats) {
      options.stats.receiptCalls = receiptCalls;
      options.stats.receiptSuccesses = receiptSuccesses;
      options.stats.receiptFailures = receiptFailures;
      options.stats.prijsvrijSlotsFilled = prijsvrijSlotsFilled;
      options.stats.stoppedEarlyBecauseEnoughPv =
        receiptCalls < safetyCap && prijsvrijSlotsFilled >= plannedPvSlots && plannedPvSlots > 0;
      options.stats.maxInFlightReceiptCalls = maxInFlight;
    }

    const { remaining, paginationTotal } = overlaidPaginationSlice(
      sortedOffers,
      page1,
      options,
      params,
    );

    recordResultsPriceEligibility(
      applyResultsLivePriceOverlays(sortedOffers, params),
      params,
      { phase: 'after-page1' },
    );

    return {
      page1,
      remaining,
      page1Ids: page1.map((offer) => offer.id),
      trailingOffers,
      paginationTotal,
    };
  })();

  return { slots, presented };
}

/**
 * After local page-1 selection: Receipt only for needed Prijsvrij candidates.
 * Bounded concurrency C=5 (capacity primary). Safety cap ≤10 total Receipt HTTP calls.
 * No feed/Search/Matrix fallback.
 */
export async function pricePage1WithPrijsvrijReceipts(
  sortedOffers: TravelOffer[],
  params: SearchParams,
  options: Page1ReceiptPricingOptions = {},
): Promise<TravelOffer[]> {
  const { page1 } = await startPage1ReceiptStream(sortedOffers, params, options).presented;
  return page1;
}

/**
 * FILTER→SORT input assumed. Runs page-1 selection + Receipt, then builds remaining
 * from the **presented** page-1 IDs (not the pre-Receipt selection alone).
 */
export async function pricePage1AndBuildRemaining(
  sortedOffers: TravelOffer[],
  params: SearchParams,
  options: Page1ReceiptPricingOptions = {},
): Promise<{ page1: TravelOffer[]; remaining: TravelOffer[]; paginationTotal: number }> {
  const { page1, remaining, paginationTotal } = await startPage1ReceiptStream(
    sortedOffers,
    params,
    options,
  ).presented;
  return { page1, remaining, paginationTotal };
}

export type ResolveResultsPageSliceOptions = Page1ReceiptPricingOptions;

/**
 * True when page1Ids can drive remaining without re-running Receipt.
 * Empty / missing / no overlap with current resultset → unusable.
 */
export function isUsablePage1IdsParam(
  page1Ids: string[] | undefined,
  sortedOffers: TravelOffer[],
): boolean {
  if (!page1Ids?.length) {
    return false;
  }
  const offerIds = new Set(sortedOffers.map((offer) => offer.id));
  return page1Ids.some((id) => offerIds.has(id));
}

/**
 * Page-1 catalog refine after a completed search (page1Ids already known).
 * Re-filters/sorts the existing resultset without Receipt or Corendon HTTP.
 *
 * `page1Ids` is a skip-live-HTTP hint, not a whitelist. Page 1 is rebuilt from
 * the current filtered presentable pool.
 */
export function presentCatalogPage1WithoutLivePricing(
  sortedOffers: TravelOffer[],
  pageSize: number = RESULTS_PRODUCT_PAGE_SIZE,
): {
  visibleOffers: TravelOffer[];
  remaining: TravelOffer[];
  page1Ids: string[];
  paginationTotal: number;
} {
  const visible = filterToResultsVisibleOffers(sortedOffers);
  const visibleOffers = paginateResults(visible, 1, pageSize);
  const page1Ids = visibleOffers.map((offer) => offer.id);
  return {
    visibleOffers,
    remaining: buildRemainingFromPresentedPage1Ids(visible, page1Ids),
    page1Ids,
    paginationTotal: visible.length,
  };
}

export type CatalogRefinePage1Slice = ReturnType<typeof presentCatalogPage1WithoutLivePricing>;

/**
 * Fast-filter optimization: skip page-1 live HTTP when `page1Ids` is present
 * AND the current filtered pool already has at least one presentable card,
 * or nothing in the pool can enter the live pipeline.
 *
 * Returns null when stale/irrelevant `page1Ids` would otherwise leave a
 * live-priceable matchset with 0 cards. Caller must then run the page-1
 * live pipeline on the current filtered set (filtered-out offers are absent).
 */
export function tryCatalogRefinePage1(
  sortedOffers: TravelOffer[],
  params: SearchParams,
  options: Pick<ResolveResultsPageSliceOptions, 'pageSize' | 'paginationPool' | 'userPaginationCap'> = {},
): CatalogRefinePage1Slice | null {
  if (!params.page1Ids?.length) {
    return null;
  }

  const pageSize = options.pageSize ?? RESULTS_PRODUCT_PAGE_SIZE;
  const pool = resolvePaginationPool(sortedOffers, options);
  const overlaidPool = applyResultsLivePriceOverlays(pool, params);
  const slice = presentCatalogPage1WithoutLivePricing(overlaidPool, pageSize);
  const canLivePriceEmptyPage = overlaidPool.some((offer) =>
    canEnterResultsLivePipeline(offer, params),
  );

  if (slice.visibleOffers.length === 0 && canLivePriceEmptyPage) {
    return null;
  }

  recordResultsPriceEligibility(overlaidPool, params, { phase: 'catalog-refine' });
  return slice;
}

/**
 * FILTER→SORT input assumed. Single entry for Results pagination.
 *
 * - page 1 new search: diversity (max 3 PV) → Receipt slot fill (no matchset await)
 * - page 1 with page1Ids: no max-3; overlay/cache then first 10 presentable
 *   unless that would leave a live-priceable matchset with 0 cards (stale IDs)
 * - page 2+ with usable page1Ids: remaining from presented IDs; cache overlay only
 * - page 2+ without usable page1Ids: run page-1 pipeline once, then caller redirects
 */
export async function resolveResultsPageSlice(
  sortedOffers: TravelOffer[],
  params: SearchParams,
  options: ResolveResultsPageSliceOptions = {},
): Promise<{
  visibleOffers: TravelOffer[];
  remaining: TravelOffer[];
  /** Carry in pagination links so later pages skip Receipt. */
  page1Ids: string[] | undefined;
  /**
   * When true, caller must redirect to the same page with `page1Ids` set.
   * Set only for cold page 2+ (missing/invalid page1Ids) after running Receipt once.
   */
  needsPage1IdsRedirect?: boolean;
  paginationTotal: number;
}> {
  const page = params.page ?? 1;
  const pageSize = options.pageSize ?? RESULTS_PRODUCT_PAGE_SIZE;
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  const pool = resolvePaginationPool(sortedOffers, options);

  if (safePage === 1) {
    const catalogRefine = tryCatalogRefinePage1(sortedOffers, params, options);
    if (catalogRefine) {
      return catalogRefine;
    }

    const { page1, remaining, paginationTotal } = await pricePage1AndBuildRemaining(
      sortedOffers,
      params,
      options,
    );
    return {
      visibleOffers: page1,
      remaining,
      page1Ids: page1.map((offer) => offer.id),
      paginationTotal,
    };
  }

  if (isUsablePage1IdsParam(params.page1Ids, sortedOffers)) {
    const overlaidPool = applyResultsLivePriceOverlays(pool, params);
    recordResultsPriceEligibility(overlaidPool, params, { phase: 'page-n' });
    const remaining = buildRemainingFromPresentedPage1Ids(overlaidPool, params.page1Ids!);
    const visibleRemaining = filterToResultsVisibleOffers(remaining);
    return {
      visibleOffers: paginateResults(visibleRemaining, safePage - 1, pageSize),
      remaining,
      page1Ids: params.page1Ids,
      paginationTotal: filterToResultsVisibleOffers(overlaidPool).length,
    };
  }

  // Cold page 2+: establish definitive presented IDs via existing page-1 pipeline once.
  const { page1, remaining, paginationTotal } = await pricePage1AndBuildRemaining(
    sortedOffers,
    params,
    options,
  );
  return {
    visibleOffers: paginateResults(filterToResultsVisibleOffers(remaining), safePage - 1, pageSize),
    remaining,
    page1Ids: page1.map((offer) => offer.id),
    needsPage1IdsRedirect: true,
    paginationTotal,
  };
}

/** Mark page-2+ offers that require a page-1 live call as not proven. */
export function markPrijsvrijLivePriceUnavailable(offers: TravelOffer[]): TravelOffer[] {
  return offers.map((offer) =>
    isPrijsvrij(offer) || isCorendon(offer) || isEliza(offer)
      ? withCatalogPriceHidden(offer)
      : {
          ...offer,
          livePriceStatus: offer.livePriceStatus ?? 'catalog',
          livePriceSource: offer.livePriceSource ?? 'feed',
        },
  );
}
