/**
 * Isolate-local Results live-pricing admission:
 * - pricingRunId / pricingRunKey (not catalogGen)
 * - shared Corendon HTTP capacity (max 8 total)
 * - P0/P1/P2 lane priority + P0 reserve while Page-1 unsettled
 *
 * Scope: process/isolate memory only (same class as L1 + breaker). L2 remains
 * the cross-instance reuse path. No AbortController cancel in v1.
 */

import { CORENDON_LIVE_PAGE1_CONCURRENCY } from '@/lib/providers/corendon/constants';
import type { SearchParams } from '@/types/travel';

/** Authoritative Corendon in-flight HTTP ceiling (all lanes / generations). */
export const CORENDON_SHARED_MAX_IN_FLIGHT = CORENDON_LIVE_PAGE1_CONCURRENCY; // 8

/** Slots held for P0 while Page-1 of the active run is unsettled. */
export const CORENDON_P0_RESERVE_SLOTS = 2;

/** Max offers one priceExactBatch / P2 select may take (≤ shared Corendon cap). */
export const LIVE_PRICE_EXACT_BATCH_MAX = CORENDON_SHARED_MAX_IN_FLIGHT;

export type PricingLane = 'P0' | 'P1' | 'P2';

export type PricingRunHandle = {
  runId: number;
  pricingRunKey: string;
  /** True when this call created a new run (previous superseded if any). */
  isNew: boolean;
};

type RunRecord = {
  runId: number;
  pricingRunKey: string;
  superseded: boolean;
  page1Settled: boolean;
};

type Waiter = {
  runId: number;
  lane: PricingLane;
  resolve: () => void;
};

let nextRunId = 1;
let activeRun: RunRecord | null = null;
const runs = new Map<number, RunRecord>();

let corendonInFlight = 0;
let peakCorendonInFlight = 0;
const waiters: Waiter[] = [];

function lanePriority(lane: PricingLane): number {
  if (lane === 'P0') return 0;
  if (lane === 'P1') return 1;
  return 2;
}

/**
 * Pricing-relevant stable key (aligned with prepare stableFilterKey).
 * Excludes page / page1Ids / catalogGen.
 */
export function buildPricingRunKey(params: SearchParams): string {
  return JSON.stringify({
    country: params.country ?? null,
    countries: params.countries ?? null,
    region: params.region ?? null,
    city: params.city ?? null,
    nights: params.nights ?? null,
    nightsMin: params.nightsMin ?? null,
    nightsMax: params.nightsMax ?? null,
    adults: params.adults ?? null,
    children: params.children ?? null,
    babies: params.babies ?? null,
    departureStart: params.departureStart ?? null,
    departureEnd: params.departureEnd ?? null,
    flexibilityDays: params.flexibilityDays ?? null,
    departureAirport: params.departureAirport ?? null,
    boardTypes: params.boardTypes ?? null,
    accommodationTypes: params.accommodationTypes ?? null,
    stars: params.stars ?? null,
    vacationTypes: params.vacationTypes ?? null,
    beachLocation: params.beachLocation ?? null,
    centerLocation: params.centerLocation ?? null,
    coast: params.coast ?? null,
    urban: params.urban ?? null,
    rural: params.rural ?? null,
    centerDistance: params.centerDistance ?? null,
    beachDistance: params.beachDistance ?? null,
    amenities: params.amenities ?? null,
    hasCarRental: params.hasCarRental ?? null,
    budgetMin: params.budgetMin ?? null,
    budgetMax: params.budgetMax ?? null,
    sort: params.sort ?? null,
    party: params.party ?? null,
    rooms: params.rooms ?? null,
    provider: params.provider ?? null,
    siteMarket: (params as { siteMarket?: string }).siteMarket ?? null,
  });
}

function supersedeActiveLocked(): void {
  if (!activeRun) return;
  activeRun.superseded = true;
  // Drop waiters for superseded runs so they do not hold capacity forever.
  for (let i = waiters.length - 1; i >= 0; i -= 1) {
    const w = waiters[i]!;
    if (w.runId === activeRun.runId || runs.get(w.runId)?.superseded) {
      waiters.splice(i, 1);
      w.resolve();
    }
  }
}

/**
 * Begin or continue a pricing run for this Results request.
 * Same key (e.g. page-only nav) → same runId. Different key → supersede + new run.
 */
export function beginOrContinuePricingRun(pricingRunKey: string): PricingRunHandle {
  if (activeRun && !activeRun.superseded && activeRun.pricingRunKey === pricingRunKey) {
    return { runId: activeRun.runId, pricingRunKey, isNew: false };
  }
  supersedeActiveLocked();
  const runId = nextRunId;
  nextRunId += 1;
  const record: RunRecord = {
    runId,
    pricingRunKey,
    superseded: false,
    page1Settled: false,
  };
  runs.set(runId, record);
  activeRun = record;
  return { runId, pricingRunKey, isNew: true };
}

export function getActivePricingRunId(): number | null {
  return activeRun && !activeRun.superseded ? activeRun.runId : null;
}

export function isPricingRunActive(runId: number): boolean {
  const run = runs.get(runId);
  return Boolean(run && !run.superseded && activeRun?.runId === runId);
}

/** True when the run may receive new HTTP admits (not superseded). */
export function assertCanAdmit(runId: number): boolean {
  return isPricingRunActive(runId);
}

export function markPricingRunPage1Settled(runId: number): void {
  const run = runs.get(runId);
  if (!run) return;
  run.page1Settled = true;
  // Cap for P1/P2 rises to 8 — wake all waiters; each acquire retries canStartNow.
  const pending = waiters.splice(0, waiters.length);
  for (const w of pending) {
    w.resolve();
  }
}

export function isPricingRunPage1Settled(runId: number): boolean {
  return runs.get(runId)?.page1Settled === true;
}

function maxAllowedInFlightForLane(lane: PricingLane, runId: number): number {
  const run = runs.get(runId);
  const page1Settled = run?.page1Settled === true;
  if (lane === 'P0' || page1Settled || !run || run.superseded) {
    return CORENDON_SHARED_MAX_IN_FLIGHT;
  }
  // P1/P2 while Page-1 unsettled: leave reserve for P0.
  return CORENDON_SHARED_MAX_IN_FLIGHT - CORENDON_P0_RESERVE_SLOTS;
}

function canStartNow(lane: PricingLane, runId: number): boolean {
  if (!assertCanAdmit(runId)) {
    return false;
  }
  const cap = maxAllowedInFlightForLane(lane, runId);
  return corendonInFlight < cap && corendonInFlight < CORENDON_SHARED_MAX_IN_FLIGHT;
}

function sortWaiters(): void {
  waiters.sort((a, b) => {
    const pa = lanePriority(a.lane);
    const pb = lanePriority(b.lane);
    if (pa !== pb) return pa - pb;
    const aActive = isPricingRunActive(a.runId) ? 0 : 1;
    const bActive = isPricingRunActive(b.runId) ? 0 : 1;
    return aActive - bActive;
  });
}

/**
 * Wake waiters after a release / page1 settle. Each woken acquire retries
 * `canStartNow` and increments inFlight itself (single-threaded loop-safe).
 * Only wake one eligible waiter per call to avoid over-grant races.
 */
function wakeNextCorendonWaiter(): void {
  sortWaiters();
  while (waiters.length > 0) {
    const next = waiters[0]!;
    if (!assertCanAdmit(next.runId)) {
      waiters.shift();
      next.resolve();
      continue;
    }
    waiters.shift();
    next.resolve();
    return;
  }
}

/**
 * Acquire one Corendon HTTP slot. Returns false if the run was superseded
 * before a slot could be granted (caller must not start HTTP / must not
 * cache circuit_open for that skip).
 */
export async function acquireCorendonSlot(args: {
  runId: number;
  lane: PricingLane;
}): Promise<boolean> {
  const { runId, lane } = args;
  while (true) {
    if (!assertCanAdmit(runId)) {
      return false;
    }
    if (canStartNow(lane, runId)) {
      corendonInFlight += 1;
      peakCorendonInFlight = Math.max(peakCorendonInFlight, corendonInFlight);
      return true;
    }
    await new Promise<void>((resolve) => {
      waiters.push({ runId, lane, resolve });
      sortWaiters();
    });
  }
}

export function releaseCorendonSlot(): void {
  if (corendonInFlight > 0) {
    corendonInFlight -= 1;
  }
  wakeNextCorendonWaiter();
}

/**
 * Run Corendon provider work under the shared capacity pool.
 * If superseded before acquire → work is skipped (no HTTP, no circuit_open).
 */
export async function withCorendonProviderSlot<T>(
  args: { runId: number; lane: PricingLane },
  work: () => Promise<T>,
): Promise<{ status: 'ran'; value: T } | { status: 'skipped_superseded' }> {
  const acquired = await acquireCorendonSlot(args);
  if (!acquired) {
    return { status: 'skipped_superseded' };
  }
  try {
    const value = await work();
    return { status: 'ran', value };
  } finally {
    releaseCorendonSlot();
  }
}

export function getCorendonAdmissionSnapshotForTests(): {
  inFlight: number;
  peakInFlight: number;
  waiting: number;
  activeRunId: number | null;
  page1Settled: boolean;
  nonP0CapWhileUnsettled: number;
} {
  return {
    inFlight: corendonInFlight,
    peakInFlight: peakCorendonInFlight,
    waiting: waiters.length,
    activeRunId: getActivePricingRunId(),
    page1Settled: activeRun?.page1Settled === true,
    nonP0CapWhileUnsettled: CORENDON_SHARED_MAX_IN_FLIGHT - CORENDON_P0_RESERVE_SLOTS,
  };
}

/** Test helper: reset isolate-local admission state. */
export function resetLivePricingAdmissionForTests(): void {
  nextRunId = 1;
  activeRun = null;
  runs.clear();
  corendonInFlight = 0;
  peakCorendonInFlight = 0;
  while (waiters.length > 0) {
    waiters.shift()?.resolve();
  }
}
