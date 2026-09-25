/**
 * D-v2 S3: pure Page-1 selection / settle helper.
 * D-v2 S4 (owner GO 25-09 16:49, option d): wired into the Page-1 Results flow via
 * `createPage1SettleController` + `resolvePage1SettleOutput` (see bottom of this file).
 *
 * Input is a snapshot of the page candidates in the existing catalog/rank order,
 * using the existing `Page1RenderSlot` shape:
 * - `{ kind: 'immediate', offer }`                 settled; outcome = `offer`
 * - `{ kind: 'pending', settledOffer: offer }`      settled; outcome = `offer`
 * - `{ kind: 'pending', settledOffer: null }`       settled without a card (e.g. timeout / compacted)
 * - `{ kind: 'pending' }` (settledOffer undefined)  NOT settled yet (live outcome unknown)
 *
 * Admission reuses the existing owner A/B/C rule: only B (`isResultsListableOffer`) is a
 * presentable card; A / C / unpriced / catalog / pending never are. The caller may pass a
 * stricter predicate (S4: B + budget filter as one shared function).
 *
 * Pure: no I/O, no timers, no global state, inputs are never mutated. The deadline is an
 * explicit input (the 8 s from D-v2 is a measurement parameter owned by the caller).
 */
import type { SearchParams, TravelOffer } from '@/types/travel';
import { RESULTS_PAGE_SIZE_DEFAULT, resultsHasMore } from '@/lib/search/pagination';
import type { Page1RenderSlot } from '@/lib/search/page1-visible-cards';
import { offerMatchesBudget } from '@/lib/search/filtering';
import { repairPage1FreezeOrder } from '@/lib/search/page1-freeze-repair';
import {
  hasValidPresentablePrice,
  isResultsListableOffer,
} from '@/lib/search/presentable-price';

/**
 * COLLECTING = not final yet (caller keeps waiting / streaming).
 * READY = `pageSize` B selected definitively (no unsettled rank before the last of them).
 * EXHAUSTED = every candidate settled and fewer than `pageSize` B (including 0).
 * DEADLINE = deadline reached, an unsettled rank blocks READY, and >= 1 settled B
 *   (1..pageSize-1 B, or pageSize+ B behind an earlier unsettled rank; S4 owner rule).
 * DEADLINE_EMPTY = deadline reached with unsettled candidates left and 0 B.
 */
export type PageSettleStatus =
  | 'COLLECTING'
  | 'READY'
  | 'EXHAUSTED'
  | 'DEADLINE'
  | 'DEADLINE_EMPTY';

/** Per-rank state derived from the slot: B card, settled non-card (A/C/unpriced/catalog/null/duplicate), or unsettled. */
export type PageSettleRankState = 'B' | 'NOT_PRESENTABLE' | 'PENDING';

export type PageSettleInput = {
  /** All candidates for this page in existing catalog/rank order (index = rank). */
  slots: readonly Page1RenderSlot[];
  /** Explicit deadline signal from the caller (see `isPageSettleDeadlineReached`). */
  deadlineReached: boolean;
  /** Cards per page. Default `RESULTS_PAGE_SIZE_DEFAULT` (10). */
  pageSize?: number;
  /** Card admission. Default `isResultsListableOffer` (B only). */
  isPresentable?: (offer: TravelOffer) => boolean;
};

export type PageSettleResult = {
  status: PageSettleStatus;
  /** True for every status except COLLECTING. */
  final: boolean;
  /**
   * Selected B offers in rank order (max `pageSize`).
   * COLLECTING: the definitive prefix only (B before the first unsettled rank).
   * READY / EXHAUSTED / DEADLINE: the page-1 cards (the anchor ids for DEADLINE).
   */
  selectedOffers: TravelOffer[];
  selectedIds: string[];
  /** Rank index of each selected offer (same order as `selectedIds`). */
  selectedRanks: number[];
  /** State per rank, same length/order as `slots`. */
  rankStates: PageSettleRankState[];
  /** All unsettled ranks, ascending. */
  pendingRanks: number[];
  /**
   * Unsettled ranks that lie before the last selected rank (gaps inside the selection).
   * Non-empty only for DEADLINE.
   */
  pendingRanksBeforeLastSelected: number[];
  /** Number of settled B across all ranks (duplicates counted once). */
  settledPresentableCount: number;
};

/** Pure deadline check for callers that own a clock: reached when now >= deadline. */
export function isPageSettleDeadlineReached(nowMs: number, deadlineAtMs: number): boolean {
  return nowMs >= deadlineAtMs;
}

function slotOutcome(slot: Page1RenderSlot): TravelOffer | null | undefined {
  if (slot.kind === 'immediate') {
    return slot.offer;
  }
  return slot.settledOffer;
}

/**
 * Decide Page-1 selection for one snapshot.
 *
 * Rules:
 * - B only, rank order kept, never re-sorted; duplicate ids count once (first rank wins).
 * - READY when `pageSize` B are found and no unsettled rank precedes the last of them.
 * - An unsettled rank before that point blocks READY/EXHAUSTED until it settles or the
 *   deadline is reached.
 *
 * Precedence (highest first; owner correction 25-09 14:28, A-19 withdrawn):
 * 1. READY: `pageSize` B with no earlier unsettled rank (incl. all settled and >= pageSize B).
 *    A deadline never turns a blocked selection into READY.
 * 2. EXHAUSTED: every rank settled and fewer than `pageSize` B (also empty input).
 * 3. DEADLINE: deadline reached, an unsettled rank blocks READY, >= 1 settled B.
 *    Selection = settled B in rank order capped at `pageSize` (the cards shown).
 *    Owner 25-09 16:49 option (d): with pageSize+ settled B behind an earlier unsettled
 *    rank these max-pageSize cards are shown but NO page1Ids are written (not a
 *    definitive freeze); with 1..pageSize-1 B the ids are written as anchor
 *    (see `page1UrlIdsForSettle`).
 * 4. DEADLINE_EMPTY: deadline reached, unsettled ranks left, 0 settled B.
 * 5. COLLECTING otherwise.
 */
export function settlePageSelection(input: PageSettleInput): PageSettleResult {
  const pageSize = input.pageSize ?? RESULTS_PAGE_SIZE_DEFAULT;
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError(`page-settle: pageSize must be a positive integer, got ${pageSize}`);
  }
  const isPresentable = input.isPresentable ?? isResultsListableOffer;

  const rankStates: PageSettleRankState[] = [];
  const pendingRanks: number[] = [];
  const settledB: Array<{ offer: TravelOffer; rank: number }> = [];
  const seenIds = new Set<string>();
  let firstPendingRank = -1;

  input.slots.forEach((slot, rank) => {
    const outcome = slotOutcome(slot);
    if (outcome === undefined) {
      rankStates.push('PENDING');
      pendingRanks.push(rank);
      if (firstPendingRank < 0) {
        firstPendingRank = rank;
      }
      return;
    }
    if (outcome && !seenIds.has(outcome.id) && isPresentable(outcome)) {
      seenIds.add(outcome.id);
      settledB.push({ offer: outcome, rank });
      rankStates.push('B');
      return;
    }
    rankStates.push('NOT_PRESENTABLE');
  });

  const definitiveB =
    firstPendingRank < 0 ? settledB : settledB.filter((entry) => entry.rank < firstPendingRank);

  let status: PageSettleStatus;
  let selected: Array<{ offer: TravelOffer; rank: number }>;
  if (definitiveB.length >= pageSize) {
    status = 'READY';
    selected = definitiveB.slice(0, pageSize);
  } else if (firstPendingRank < 0) {
    status = 'EXHAUSTED';
    selected = settledB;
  } else if (input.deadlineReached) {
    selected = settledB.slice(0, pageSize);
    status = settledB.length > 0 ? 'DEADLINE' : 'DEADLINE_EMPTY';
  } else {
    status = 'COLLECTING';
    selected = definitiveB;
  }

  const lastSelectedRank = selected.length > 0 ? selected[selected.length - 1]!.rank : -1;
  return {
    status,
    final: status !== 'COLLECTING',
    selectedOffers: selected.map((entry) => entry.offer),
    selectedIds: selected.map((entry) => entry.offer.id),
    selectedRanks: selected.map((entry) => entry.rank),
    rankStates,
    pendingRanks,
    pendingRanksBeforeLastSelected: pendingRanks.filter((rank) => rank < lastSelectedRank),
    settledPresentableCount: settledB.length,
  };
}

// ---------------------------------------------------------------------------
// D-v2 S4: Page-1 wiring helpers (owner GO 25-09 16:49, option d).
// Default Results sort stays catalogue order: the slot list is the catalogue/rank
// order and live arrival order never re-ranks it.
// ---------------------------------------------------------------------------

/** Page-1 settle deadline, counted from overlay start (D-v2 plan; 8 s = measurement parameter, owner 13:44). */
export const PAGE1_SETTLE_DEADLINE_MS = 8000;

/**
 * Shared Page-1 card predicate: presentable B (`isResultsListableOffer`) and, when the
 * offer has a presentable price and params are known, inside the budget filter.
 * Identical to what `Page1ResultsStream` paints, so selection == visible cards.
 */
export function isPage1VisibleOffer(offer: TravelOffer, searchParams?: SearchParams): boolean {
  if (!isResultsListableOffer(offer)) {
    return false;
  }
  if (hasValidPresentablePrice(offer) && searchParams && !offerMatchesBudget(offer, searchParams)) {
    return false;
  }
  return true;
}

/**
 * Page-1 slot offers in catalogue/rank order.
 *
 * - No (valid) freeze: the page-1 overlay candidate window (existing
 *   `selectPage1OverlayCandidates`, ranked matchset order) followed by at most
 *   `pageSize` browse B that lie beyond that window (every B before the last window
 *   rank is already a window candidate, so the concatenation stays in rank order).
 *   The current B snapshot is NOT put first: a cold/partial snapshot must not decide
 *   Page 1 (catalogue order is the base for selection and recomposition).
 * - Valid freeze (`page1Ids` with >= 1 id still in the B pool): existing GO10
 *   `repairPage1FreezeOrder` result first (kept frozen ids in frozen order, then fill
 *   from the B pool in rank order), then the remaining window candidates in rank order.
 *   Once page1Ids are definitive they are therefore never re-ordered by later live data.
 */
export function buildPage1SlotOffers(args: {
  browsable: readonly TravelOffer[];
  overlayCandidates: readonly TravelOffer[];
  frozenIds: readonly string[] | undefined;
  pageSize: number;
  /**
   * D-v2 S5: frozen ids still in the matchset whose live status is unknown (not yet
   * settled; e.g. R2 timeout / cold process). Kept at their frozen position as pending
   * anchors (GO10 amendment, review C); the caller must also give them a live overlay.
   */
  pendingFrozen?: ReadonlyMap<string, TravelOffer>;
}): { slotOffers: TravelOffer[]; usedFreeze: boolean; pendingFrozenIds: string[] } {
  const pageSize = Math.max(1, Math.floor(args.pageSize) || RESULTS_PAGE_SIZE_DEFAULT);
  const out: TravelOffer[] = [];
  const seen = new Set<string>();
  const push = (offer: TravelOffer | undefined) => {
    if (!offer || seen.has(offer.id)) return;
    seen.add(offer.id);
    out.push(offer);
  };

  const repaired = repairPage1FreezeOrder({
    presentableOrdered: args.browsable,
    frozenIds: args.frozenIds,
    pageSize,
    pendingFrozen: args.pendingFrozen,
  });
  if (repaired.usedFreeze) {
    repaired.offers.forEach(push);
    args.overlayCandidates.forEach(push);
    return {
      slotOffers: out,
      usedFreeze: true,
      pendingFrozenIds: [...(repaired.pendingFrozenIds ?? [])],
    };
  }

  args.overlayCandidates.forEach(push);
  let extraB = 0;
  for (const offer of args.browsable) {
    if (extraB >= pageSize) break;
    if (seen.has(offer.id)) continue;
    push(offer);
    extraB += 1;
  }
  return { slotOffers: out, usedFreeze: false, pendingFrozenIds: [] };
}

/** Minimal overlay shape (structurally `CatalogPageLiveOverlay`). */
export type PageSettleLiveOverlay = {
  catalog: TravelOffer;
  live: Promise<TravelOffer>;
  pending: boolean;
};

export type Page1SettleController = {
  /** Cards per page used for the selection (and the anchor threshold). */
  pageSize: number;
  /** Slot offers in rank order (render order of Page1ResultsStream). */
  slotOffers: readonly TravelOffer[];
  /** Resolves once with the final selection (READY / EXHAUSTED / DEADLINE / DEADLINE_EMPTY). */
  selection: Promise<PageSettleResult>;
  /** Latest evaluation (COLLECTING until final). */
  current(): PageSettleResult;
  /**
   * Outcome for one slot: the live offer when it settles before the selection is final,
   * otherwise `null` once the selection is final (CUT: no card, no late re-ranking).
   * Non-pending slots resolve with their settled offer immediately.
   */
  slotOutcome(offerId: string): Promise<TravelOffer | null>;
};

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; done: boolean };

function deferred<T>(): Deferred<T> {
  let resolveFn: (value: T) => void = () => {};
  const d = {
    promise: new Promise<T>((resolve) => {
      resolveFn = resolve;
    }),
    resolve: (value: T) => {
      if (d.done) return;
      d.done = true;
      resolveFn(value);
    },
    done: false,
  };
  return d;
}

function defaultScheduleDeadline(onDeadline: () => void, ms: number): () => void {
  const timer = setTimeout(onDeadline, ms);
  (timer as { unref?: () => void }).unref?.();
  return () => clearTimeout(timer);
}

/**
 * Stateful Page-1 settle: tracks each slot's live outcome, re-runs
 * `settlePageSelection` on every settle and at the deadline, and resolves `selection`
 * exactly once when final. A rejected live promise counts as settled without a card.
 * Deterministic for tests via `scheduleDeadline`.
 */
export function createPage1SettleController(args: {
  slotOffers: readonly TravelOffer[];
  overlays: readonly PageSettleLiveOverlay[];
  pageSize?: number;
  deadlineMs?: number;
  isPresentable?: (offer: TravelOffer) => boolean;
  scheduleDeadline?: (onDeadline: () => void, ms: number) => () => void;
}): Page1SettleController {
  const pageSize = args.pageSize ?? RESULTS_PAGE_SIZE_DEFAULT;
  const overlayById = new Map(args.overlays.map((overlay) => [overlay.catalog.id, overlay]));
  const slotOffers: TravelOffer[] = [];
  const seen = new Set<string>();
  for (const offer of args.slotOffers) {
    if (seen.has(offer.id)) continue;
    seen.add(offer.id);
    slotOffers.push(offer);
  }

  const slots: Page1RenderSlot[] = [];
  const slotDeferred = new Map<string, Deferred<TravelOffer | null>>();
  const selectionDeferred = deferred<PageSettleResult>();
  let deadlineReached = false;
  let final = false;
  let cancelDeadline: (() => void) | undefined;
  let latest!: PageSettleResult;

  const evaluate = (): void => {
    if (final) return;
    latest = settlePageSelection({
      slots,
      deadlineReached,
      pageSize,
      isPresentable: args.isPresentable,
    });
    if (!latest.final) return;
    final = true;
    cancelDeadline?.();
    // CUT: unresolved slots get no card after the selection is final.
    for (const d of slotDeferred.values()) d.resolve(null);
    selectionDeferred.resolve(latest);
  };

  slotOffers.forEach((offer, index) => {
    const overlay = overlayById.get(offer.id);
    const d = deferred<TravelOffer | null>();
    slotDeferred.set(offer.id, d);
    if (!overlay || !overlay.pending) {
      const settled = overlay?.catalog ?? offer;
      slots.push({ kind: 'immediate', offer: settled });
      d.resolve(settled);
      return;
    }
    slots.push({ kind: 'pending', catalogOffer: overlay.catalog });
    const settle = (outcome: TravelOffer | null) => {
      if (final) return;
      slots[index] = { kind: 'pending', settledOffer: outcome, catalogOffer: overlay.catalog };
      d.resolve(outcome);
      evaluate();
    };
    overlay.live.then(
      (priced) => settle(priced ?? null),
      () => settle(null),
    );
  });

  evaluate();
  if (!final) {
    const schedule = args.scheduleDeadline ?? defaultScheduleDeadline;
    cancelDeadline = schedule(() => {
      deadlineReached = true;
      evaluate();
    }, args.deadlineMs ?? PAGE1_SETTLE_DEADLINE_MS);
  }

  return {
    pageSize,
    slotOffers,
    selection: selectionDeferred.promise,
    current: () => latest,
    slotOutcome: (offerId: string) =>
      slotDeferred.get(offerId)?.promise ?? Promise.resolve(null),
  };
}

/** DEFINITIVE = page1Ids fixed; ANCHOR = 1..pageSize-1 deadline ids; NONE = nothing written. */
export type Page1FreezeKind = 'DEFINITIVE' | 'ANCHOR' | 'NONE';

/**
 * Which page1Ids may be written to the URL for a final selection (owner 25-09 16:49):
 * - READY (exactly pageSize B) / EXHAUSTED (all available B): definitive.
 * - DEADLINE with 1..pageSize-1 B: those ids as anchor (existing rule, owner 13:44).
 * - DEADLINE with pageSize+ settled B behind an earlier pending rank (option d): none;
 *   not a definitive freeze, the next render may recompose Page 1.
 * - DEADLINE_EMPTY / COLLECTING / empty selection: none.
 */
export function page1UrlIdsForSettle(
  result: PageSettleResult,
  pageSize: number = RESULTS_PAGE_SIZE_DEFAULT,
): { ids: string[]; freeze: Page1FreezeKind } {
  if (result.selectedIds.length === 0) {
    return { ids: [], freeze: 'NONE' };
  }
  switch (result.status) {
    case 'READY':
    case 'EXHAUSTED':
      return { ids: [...result.selectedIds], freeze: 'DEFINITIVE' };
    case 'DEADLINE':
      return result.selectedIds.length < pageSize
        ? { ids: [...result.selectedIds], freeze: 'ANCHOR' }
        : { ids: [], freeze: 'NONE' };
    default:
      return { ids: [], freeze: 'NONE' };
  }
}

export type Page1SettleOutput = {
  status: PageSettleStatus;
  /** Ids to write to the URL (`[]` = write nothing). */
  page1Ids: string[];
  freeze: Page1FreezeKind;
  /** page1Ids carried on pagination links (written ids, else the unchanged URL ids). */
  paginationPage1Ids: string[];
  showPagination: boolean;
  paginationTotal: number;
  /** DEADLINE_EMPTY status line (D-v2 plan section 3); no auto-refresh in S4. */
  showStatusLine: boolean;
};

/** Plan section 3 copy for DEADLINE_EMPTY (not the "Geen vakanties gevonden" empty state). */
export const PAGE1_DEADLINE_EMPTY_STATUS_TEXT = 'We halen nog actuele prijzen op';

/**
 * Page-1 URL + pagination output for a final selection. `browseTotal` must be computed
 * at settle time (current B state), so a temporary cold B=0 at request start never
 * becomes a permanent paginationTotal=0 / page1Ids=[] (GO11: total may grow).
 */
export function resolvePage1SettleOutput(args: {
  result: PageSettleResult;
  browseTotal: number;
  existingPage1Ids?: readonly string[];
  pageSize?: number;
  /**
   * D-v2 S5 (review C): slot ids still unsettled at final. When an existing URL page1Id
   * is still pending (unknown anchor), nothing is written: a pending anchor never causes
   * a shorter / re-ordered page1Ids rewrite.
   */
  pendingIds?: readonly string[];
}): Page1SettleOutput {
  const pageSize = args.pageSize ?? RESULTS_PAGE_SIZE_DEFAULT;
  const settleIds = page1UrlIdsForSettle(args.result, pageSize);
  const pendingSet = new Set(args.pendingIds ?? []);
  const existingPending = (args.existingPage1Ids ?? []).some((id) => pendingSet.has(id));
  const { ids, freeze } = existingPending
    ? { ids: [] as string[], freeze: 'NONE' as Page1FreezeKind }
    : settleIds;
  const shown = args.result.final ? args.result.selectedIds.length : 0;
  const showPagination =
    args.result.final && args.result.status !== 'DEADLINE_EMPTY' && shown > 0;
  const total = Math.max(
    Number.isFinite(args.browseTotal) ? Math.max(0, Math.floor(args.browseTotal)) : 0,
    shown,
  );
  return {
    status: args.result.status,
    page1Ids: ids,
    freeze,
    paginationPage1Ids: ids.length > 0 ? ids : [...(args.existingPage1Ids ?? [])],
    showPagination,
    paginationTotal: showPagination ? total : 0,
    showStatusLine: args.result.status === 'DEADLINE_EMPTY',
  };
}

/**
 * D-v2 hasMore on Page 1 (owner 25-09 18:50): more B in the current presentable pool
 * (the B-only `paginationTotal` computed at settle) than the page shows. No pagination
 * (COLLECTING / DEADLINE_EMPTY / no cards) -> false.
 */
export function page1HasMore(
  output: Page1SettleOutput,
  pageSize: number = RESULTS_PAGE_SIZE_DEFAULT,
): boolean {
  if (!output.showPagination) return false;
  return resultsHasMore({ presentableCount: output.paginationTotal, windowEnd: pageSize, page: 1 });
}

/** D-v2 S5: ids of the slots that are still unsettled in `result` (pending anchors). */
export function pendingSlotIdsForSettle(
  result: PageSettleResult,
  slotOffers: readonly TravelOffer[],
): string[] {
  const ids: string[] = [];
  for (const rank of result.pendingRanks) {
    const id = slotOffers[rank]?.id;
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * D-v2 S5 (Master Plan v1.10 r.706): cold Page 2+ (no page1Ids in the URL) runs the
 * page-1 pipeline once; when that yields writable page1Ids (definitive, or a 1..9
 * deadline anchor) the caller redirects to the same page with those ids. Returns `[]`
 * when nothing may be written (option d / DEADLINE_EMPTY): no redirect, no URL write.
 */
export function coldPage2RedirectPage1Ids(
  result: PageSettleResult,
  pageSize: number = RESULTS_PAGE_SIZE_DEFAULT,
): string[] {
  if (!result.final) return [];
  return page1UrlIdsForSettle(result, pageSize).ids;
}

/**
 * D-v2 A-38 fix (option d on cold Page 2+; Package 1 + Master Plan r.706): when nothing
 * may be written (no redirect, no page1Ids), Page 2+ still excludes the page-1 selection
 * recomputed by the same pipeline: its cards plus its pending ranks before the last card
 * (the option-d page-1 positions; the caller excludes those only once they are B in the
 * pool). `[]` when the selection has no cards (DEADLINE_EMPTY): existing browse slice.
 */
export function coldPage2FallbackPage1Ids(
  result: PageSettleResult,
  slotOffers: readonly TravelOffer[],
): string[] {
  if (!result.final || result.selectedIds.length === 0) return [];
  const ids = [...result.selectedIds];
  for (const rank of result.pendingRanksBeforeLastSelected) {
    const id = slotOffers[rank]?.id;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
