import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import type { SearchParams } from '../../../types/travel';
import { paginateResults } from '../../search/pagination';
import {
  applyResultsLivePriceOverlay,
  getResultsLivePriceOverlay,
  setResultsLivePriceOverlay,
} from '../../search/results-live-price-cache';
import {
  PRIJSVRIJ_PAGE1_MAX_SLOTS,
  PRIJSVRIJ_PROVIDER_NAME,
  PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP,
} from './constants';
import type { FetchLike } from './auth';
import { buildPrijsvrijReceiptContext } from './receipt-context';
import { fetchPrijsvrijReceiptPrice } from './receipt-client';
import {
  CORENDON_LIVE_PAGE1_CONCURRENCY,
  buildCorendonLiveContext,
  fetchCorendonLowestpricesaccoPrice,
  isCorendon,
} from '../corendon';

/** Product page size for Results (Master Plan §8.1a). */
export const RESULTS_PRODUCT_PAGE_SIZE = 10;

/**
 * Max concurrent Prijsvrij Receipt HTTP calls for page-1 pricing.
 * Matches capacity-harness primary reference C=5.
 */
export const PRIJSVRIJ_RECEIPT_PAGE1_CONCURRENCY = 5;

export type Page1ReceiptPricingStats = {
  receiptCalls: number;
  receiptSuccesses: number;
  receiptFailures: number;
  prijsvrijSlotsFilled: number;
  stoppedEarlyBecauseEnoughPv: boolean;
  /** Peak in-flight Receipt HTTP calls observed during this run (tests). */
  maxInFlightReceiptCalls?: number;
};

export type Page1ReceiptPricingOptions = {
  fetchImpl?: FetchLike;
  pageSize?: number;
  safetyCap?: number;
  maxPrijsvrijSlots?: number;
  concurrency?: number;
  stats?: Page1ReceiptPricingStats;
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

function withCorendonLivePrice(offer: TravelOffer, pricePerPerson: number): TravelOffer {
  const nights = offer.nights > 0 ? offer.nights : 0;
  return {
    ...offer,
    price: pricePerPerson,
    pricePerDay: nights > 0 ? Math.round(pricePerPerson / nights) : pricePerPerson,
    livePriceStatus: 'proven',
    livePriceSource: 'lowestpricesacco',
  };
}

function cacheLiveOverlay(offer: TravelOffer, params: SearchParams): void {
  setResultsLivePriceOverlay(offer.id, params, {
    price: offer.price,
    pricePerDay: offer.pricePerDay,
    livePriceStatus: offer.livePriceStatus,
    livePriceSource: offer.livePriceSource,
  });
}

function cacheUnavailableLivePrice(offer: TravelOffer, params: SearchParams): TravelOffer {
  const hidden = withCatalogPriceHidden(offer);
  cacheLiveOverlay(hidden, params);
  return hidden;
}

function isReusableProvenLivePrice(offer: TravelOffer): boolean {
  if (offer.livePriceStatus !== 'proven') {
    return false;
  }
  if (typeof offer.price !== 'number' || !Number.isFinite(offer.price) || offer.price <= 0) {
    return false;
  }
  if (isPrijsvrij(offer)) {
    return offer.livePriceSource === 'receipt';
  }
  if (isCorendon(offer)) {
    return offer.livePriceSource === 'lowestpricesacco';
  }
  return true;
}

/**
 * Cache lookup before any live HTTP.
 * - TravelOffer: reusable proven live price
 * - null: cached unavailable / fail-closed — do not HTTP
 * - undefined: miss
 */
function cachedLivePriceResult(
  offer: TravelOffer,
  params: SearchParams,
): TravelOffer | null | undefined {
  const overlay = getResultsLivePriceOverlay(offer.id, params);
  if (!overlay) {
    return undefined;
  }
  const merged = applyResultsLivePriceOverlay(offer, params);
  if (isReusableProvenLivePrice(merged)) {
    return merged;
  }
  return null;
}

/**
 * Run async work over items with a hard concurrency ceiling.
 * Does not start more than `concurrency` workers at once.
 */
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
 * Does not change C=5, cap ≤10, selection, ranking, or fallback rules.
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

  const { selected, prijsvrijReserves } = selectPage1Candidates(
    sortedOffers,
    pageSize,
    maxPrijsvrijSlots,
  );

  const slotResults: Array<TravelOffer | null> = selected.map((offer) => {
    if (isPrijsvrij(offer)) {
      const cached = cachedLivePriceResult(offer, params);
      if (cached) {
        return cached;
      }
      return null;
    }
    if (isCorendon(offer)) {
      const cached = cachedLivePriceResult(offer, params);
      if (cached) {
        return cached;
      }
      if (cached === null) {
        return withCatalogPriceHidden(offer);
      }
      // Missing hash/id/occupancy: no live call — hide catalog, do not Suspense.
      if (!buildCorendonLiveContext(offer, params)) {
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
  const slotDeferreds = new Map<number, ReturnType<typeof createDeferred<TravelOffer | null>>>();
  for (let i = 0; i < selected.length; i += 1) {
    const offer = selected[i];
    if (isPrijsvrij(offer) && slotResults[i] === null) {
      pvSlots.push({ selectedIndex: i, primary: offer });
      slotDeferreds.set(i, createDeferred<TravelOffer | null>());
    } else if (isCorendon(offer) && slotResults[i] === null) {
      corendonSlots.push({ selectedIndex: i, offer });
      slotDeferreds.set(i, createDeferred<TravelOffer | null>());
    }
  }

  const slots: Page1StreamSlot[] = selected.map((offer, selectedIndex) => {
    if (
      (isPrijsvrij(offer) && slotResults[selectedIndex] === null) ||
      (isCorendon(offer) && slotResults[selectedIndex] === null)
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
      const cached = cachedLivePriceResult(candidate, params);
      if (cached) {
        prijsvrijSlotsFilled += 1;
        return cached;
      }
      if (cached === null) {
        return null;
      }

      if (receiptCalls >= safetyCap) {
        return null;
      }

      const ctx = buildPrijsvrijReceiptContext(candidate, params);
      if (!ctx) {
        // Missing reproducible context — not a Receipt HTTP call.
        cacheUnavailableLivePrice(candidate, params);
        return null;
      }

      // Claim slot synchronously before await (safe under JS single-thread).
      if (receiptCalls >= safetyCap) {
        return null;
      }
      receiptCalls += 1;

      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      try {
        const result = await fetchPrijsvrijReceiptPrice(ctx, { fetchImpl });
        if (result.ok) {
          receiptSuccesses += 1;
          prijsvrijSlotsFilled += 1;
          const priced = withReceiptPrice(candidate, result.price.pricePerPerson);
          cacheLiveOverlay(priced, params);
          return priced;
        }
        receiptFailures += 1;
        cacheUnavailableLivePrice(candidate, params);
        return null;
      } finally {
        inFlight -= 1;
      }
    }

    async function priceCorendonSlot(offer: TravelOffer): Promise<TravelOffer> {
      const cached = cachedLivePriceResult(offer, params);
      if (cached) {
        return cached;
      }
      if (cached === null) {
        return withCatalogPriceHidden(offer);
      }
      const ctx = buildCorendonLiveContext(offer, params);
      if (!ctx) {
        return cacheUnavailableLivePrice(offer, params);
      }
      const result = await fetchCorendonLowestpricesaccoPrice(ctx, { fetchImpl });
      if (result.ok) {
        const priced = withCorendonLivePrice(offer, result.pricePerPerson);
        cacheLiveOverlay(priced, params);
        return priced;
      }
      return cacheUnavailableLivePrice(offer, params);
    }

    // Phase 1: PV Receipts (C=5) and Corendon lowestpricesacco in parallel.
    // Settle each successful slot as soon as its own live call returns.
    const [, primaryResults] = await Promise.all([
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
      if (slot) {
        finalOffers.push(slot);
      }
    }

    const filledIds = new Set(finalOffers.map((offer) => offer.id));

    // If page under-filled after PV failures, add remaining non-PV from sorted list.
    if (finalOffers.length < pageSize) {
      for (const offer of sortedOffers) {
        if (finalOffers.length >= pageSize) {
          break;
        }
        if (filledIds.has(offer.id) || isPrijsvrij(offer)) {
          continue;
        }
        finalOffers.push(
          isCorendon(offer)
            ? withCatalogPriceHidden(offer)
            : {
                ...offer,
                livePriceStatus: 'catalog',
                livePriceSource: 'feed',
              },
        );
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

    return {
      page1,
      remaining: buildRemainingFromPresentedPage1(sortedOffers, page1),
      page1Ids: page1.map((offer) => offer.id),
      trailingOffers,
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
): Promise<{ page1: TravelOffer[]; remaining: TravelOffer[] }> {
  const page1 = await pricePage1WithPrijsvrijReceipts(sortedOffers, params, options);
  const remaining = buildRemainingFromPresentedPage1(sortedOffers, page1);
  return { page1, remaining };
}

export type ResolveResultsPageSliceOptions = {
  fetchImpl?: FetchLike;
  pageSize?: number;
  safetyCap?: number;
  maxPrijsvrijSlots?: number;
  concurrency?: number;
  stats?: Page1ReceiptPricingStats;
};

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
 * FILTER→SORT input assumed. Single entry for Results pagination.
 *
 * - page 1: selection → Receipt (at most once) → definitive page1 + remaining
 * - page 2+ with usable page1Ids: NEVER runs Receipt; remaining from presented IDs
 * - page 2+ without usable page1Ids: run page-1 Receipt pipeline once, then caller
 *   redirects to the same page with definitive page1Ids (fast path on next request)
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
}> {
  const page = params.page ?? 1;
  const pageSize = options.pageSize ?? RESULTS_PRODUCT_PAGE_SIZE;
  const safePage = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;

  if (safePage === 1) {
    const { page1, remaining } = await pricePage1AndBuildRemaining(
      sortedOffers,
      params,
      options,
    );
    return {
      visibleOffers: page1,
      remaining,
      page1Ids: page1.map((offer) => offer.id),
    };
  }

  if (isUsablePage1IdsParam(params.page1Ids, sortedOffers)) {
    const remaining = buildRemainingFromPresentedPage1Ids(sortedOffers, params.page1Ids!);
    return {
      visibleOffers: markPrijsvrijLivePriceUnavailable(
        paginateResults(remaining, safePage - 1, pageSize),
      ),
      remaining,
      page1Ids: params.page1Ids,
    };
  }

  // Cold page 2+: establish definitive presented IDs via existing page-1 pipeline once.
  const { page1, remaining } = await pricePage1AndBuildRemaining(
    sortedOffers,
    params,
    options,
  );
  return {
    visibleOffers: markPrijsvrijLivePriceUnavailable(
      paginateResults(remaining, safePage - 1, pageSize),
    ),
    remaining,
    page1Ids: page1.map((offer) => offer.id),
    needsPage1IdsRedirect: true,
  };
}

/** Mark page-2+ offers that require a page-1 live call as not proven. */
export function markPrijsvrijLivePriceUnavailable(offers: TravelOffer[]): TravelOffer[] {
  return offers.map((offer) =>
    isPrijsvrij(offer) || isCorendon(offer)
      ? withCatalogPriceHidden(offer)
      : {
          ...offer,
          livePriceStatus: offer.livePriceStatus ?? 'catalog',
          livePriceSource: offer.livePriceSource ?? 'feed',
        },
  );
}
