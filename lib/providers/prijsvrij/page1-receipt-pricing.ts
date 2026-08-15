import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import type { SearchParams } from '../../../types/travel';
import { paginateResults } from '../../search/pagination';
import {
  PRIJSVRIJ_PAGE1_MAX_SLOTS,
  PRIJSVRIJ_PROVIDER_NAME,
  PRIJSVRIJ_RECEIPT_PAGE1_SAFETY_CAP,
} from './constants';
import type { FetchLike } from './auth';
import { buildPrijsvrijReceiptContext } from './receipt-context';
import { fetchPrijsvrijReceiptPrice } from './receipt-client';

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
 * After local page-1 selection: Receipt only for needed Prijsvrij candidates.
 * Bounded concurrency C=5 (capacity primary). Safety cap ≤10 total Receipt HTTP calls.
 * No feed/Search/Matrix fallback.
 */
export async function pricePage1WithPrijsvrijReceipts(
  sortedOffers: TravelOffer[],
  params: SearchParams,
  options: {
    fetchImpl?: FetchLike;
    pageSize?: number;
    safetyCap?: number;
    maxPrijsvrijSlots?: number;
    concurrency?: number;
    stats?: Page1ReceiptPricingStats;
  } = {},
): Promise<TravelOffer[]> {
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

  const plannedPvSlots = selected.filter(isPrijsvrij).length;
  let receiptCalls = 0;
  let receiptSuccesses = 0;
  let receiptFailures = 0;
  let prijsvrijSlotsFilled = 0;
  let reserveIndex = 0;
  let inFlight = 0;
  let maxInFlight = 0;

  async function tryReceipt(candidate: TravelOffer): Promise<TravelOffer | null> {
    if (receiptCalls >= safetyCap) {
      return null;
    }

    const ctx = buildPrijsvrijReceiptContext(candidate, params);
    if (!ctx) {
      // Missing reproducible context — not a Receipt HTTP call.
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
        return withReceiptPrice(candidate, result.price.pricePerPerson);
      }
      receiptFailures += 1;
      return null;
    } finally {
      inFlight -= 1;
    }
  }

  // Preserve selected order: non-PV filled immediately; PV slots filled after concurrent pricing.
  const slotResults: Array<TravelOffer | null> = selected.map((offer) =>
    isPrijsvrij(offer)
      ? null
      : {
          ...offer,
          livePriceStatus: 'catalog' as const,
          livePriceSource: 'feed' as const,
        },
  );

  type PvSlot = { selectedIndex: number; primary: TravelOffer };
  const pvSlots: PvSlot[] = [];
  for (let i = 0; i < selected.length; i += 1) {
    const offer = selected[i];
    if (isPrijsvrij(offer)) {
      pvSlots.push({ selectedIndex: i, primary: offer });
    }
  }

  // Phase 1: price all primary PV candidates concurrently (C=5).
  const primaryResults = await mapWithConcurrency(
    pvSlots,
    concurrency,
    async (slot) => tryReceipt(slot.primary),
  );

  const openSlots: number[] = [];
  for (let i = 0; i < pvSlots.length; i += 1) {
    const priced = primaryResults[i];
    if (priced) {
      slotResults[pvSlots[i].selectedIndex] = priced;
    } else {
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
      async (item) => tryReceipt(item.reserve),
    );

    for (let i = 0; i < batch.length; i += 1) {
      const priced = batchResults[i];
      if (priced) {
        slotResults[batch[i].selectedIndex] = priced;
      } else {
        openSlots.push(batch[i].selectedIndex);
      }
    }
  }

  const finalOffers: TravelOffer[] = [];
  for (const slot of slotResults) {
    if (slot) {
      finalOffers.push(slot);
    }
  }

  // If page under-filled after PV failures, add remaining non-PV from sorted list.
  if (finalOffers.length < pageSize) {
    const usedIds = new Set(finalOffers.map((o) => o.id));
    for (const offer of sortedOffers) {
      if (finalOffers.length >= pageSize) {
        break;
      }
      if (usedIds.has(offer.id) || isPrijsvrij(offer)) {
        continue;
      }
      finalOffers.push({
        ...offer,
        livePriceStatus: 'catalog',
        livePriceSource: 'feed',
      });
      usedIds.add(offer.id);
    }
  }

  if (options.stats) {
    options.stats.receiptCalls = receiptCalls;
    options.stats.receiptSuccesses = receiptSuccesses;
    options.stats.receiptFailures = receiptFailures;
    options.stats.prijsvrijSlotsFilled = prijsvrijSlotsFilled;
    options.stats.stoppedEarlyBecauseEnoughPv =
      receiptCalls < safetyCap && prijsvrijSlotsFilled >= plannedPvSlots && plannedPvSlots > 0;
    options.stats.maxInFlightReceiptCalls = maxInFlight;
  }

  return finalOffers.slice(0, pageSize);
}

/** Mark Prijsvrij offers on later pages as not proven live (no Package-1 Receipt). */
export function markPrijsvrijLivePriceUnavailable(offers: TravelOffer[]): TravelOffer[] {
  return offers.map((offer) =>
    isPrijsvrij(offer)
      ? withCatalogPriceHidden(offer)
      : {
          ...offer,
          livePriceStatus: offer.livePriceStatus ?? 'catalog',
          livePriceSource: offer.livePriceSource ?? 'feed',
        },
  );
}
