/**
 * GO10: repair stale URL `page1Ids` against the current presentable (B) pool.
 *
 * Page-1 freeze keeps relative order of still-valid frozen ids. Missing/stale
 * ids are dropped; remaining slots are filled from the current ranked B pool.
 * If no frozen id remains valid, the freeze is dropped entirely.
 *
 * Never returns an empty page-1 slice when the presentable pool is non-empty.
 *
 * D-v2 S5 (GO10 amendment per D-v2 review C, owner GO 25-09 17:10): a frozen id whose
 * live status is still UNKNOWN (in the matchset, not yet settled in L1, e.g. after an
 * R2 timeout / cold process) is not dropped: the caller passes it in `pendingFrozen`
 * and it keeps its frozen position as a pending anchor. Only known non-B (A / C /
 * unpriced / parked) or ids no longer in the matchset are dropped (existing behaviour).
 */
import type { TravelOffer } from '@/types/travel';
import {
  hasValidPresentablePrice,
  isResultsLivePriceCandidateOffer,
  isUnpricedResultsOffer,
} from '@/lib/search/presentable-price';

export type Page1FreezeRepairResult = {
  offers: TravelOffer[];
  page1Ids: string[];
  /** True when at least one frozen id was kept. */
  usedFreeze: boolean;
  keptFrozenCount: number;
  filledCount: number;
  /** D-v2 S5: kept frozen ids whose live status is still unknown (pending anchors). */
  pendingFrozenIds?: string[];
};

/**
 * D-v2 S5: true when a (live-overlaid) matchset offer has no settled live outcome yet,
 * i.e. it is neither presentable B nor known non-B (A / C / unpriced / parked).
 */
export function isFrozenPage1StatusUnknown(offer: TravelOffer): boolean {
  if (hasValidPresentablePrice(offer)) return false;
  if (!isResultsLivePriceCandidateOffer(offer)) return false; // parked / provider-confirmed A
  if (offer.livePriceStatus === 'unavailable') return false; // A or C settled
  if (isUnpricedResultsOffer(offer)) return false;
  return true;
}

export function repairPage1FreezeOrder(args: {
  presentableOrdered: readonly TravelOffer[];
  frozenIds: readonly string[] | undefined;
  pageSize: number;
  /** D-v2 S5: frozen ids with unknown live status (kept as pending anchors in place). */
  pendingFrozen?: ReadonlyMap<string, TravelOffer>;
}): Page1FreezeRepairResult {
  const pageSize =
    Number.isFinite(args.pageSize) && args.pageSize > 0
      ? Math.floor(args.pageSize)
      : 0;
  const pool = args.presentableOrdered.filter(Boolean);
  const pendingFrozen = args.pendingFrozen;
  const hasPendingFrozen =
    !!pendingFrozen &&
    (args.frozenIds ?? []).some((id) => pendingFrozen.has(id));
  if (pageSize <= 0 || (pool.length === 0 && !hasPendingFrozen)) {
    return { offers: [], page1Ids: [], usedFreeze: false, keptFrozenCount: 0, filledCount: 0 };
  }

  const frozenIds = (args.frozenIds ?? []).filter((id) => typeof id === 'string' && id.length > 0);
  if (frozenIds.length === 0) {
    const offers = pool.slice(0, pageSize);
    return {
      offers,
      page1Ids: offers.map((offer) => offer.id),
      usedFreeze: false,
      keptFrozenCount: 0,
      filledCount: offers.length,
    };
  }

  const byId = new Map(pool.map((offer) => [offer.id, offer]));
  const kept: TravelOffer[] = [];
  const seen = new Set<string>();
  const pendingFrozenIds: string[] = [];
  for (const id of frozenIds) {
    if (seen.has(id)) continue;
    let hit = byId.get(id);
    if (!hit) {
      hit = pendingFrozen?.get(id);
      if (hit) pendingFrozenIds.push(id);
    }
    if (!hit) continue;
    kept.push(hit);
    seen.add(id);
    if (kept.length >= pageSize) break;
  }

  if (kept.length === 0) {
    // All frozen ids stale/irrelevant — drop freeze, re-seed from current B pool.
    const offers = pool.slice(0, pageSize);
    return {
      offers,
      page1Ids: offers.map((offer) => offer.id),
      usedFreeze: false,
      keptFrozenCount: 0,
      filledCount: offers.length,
    };
  }

  const keptFrozenCount = kept.length;
  for (const offer of pool) {
    if (kept.length >= pageSize) break;
    if (seen.has(offer.id)) continue;
    kept.push(offer);
    seen.add(offer.id);
  }

  return {
    offers: kept,
    page1Ids: kept.map((offer) => offer.id),
    usedFreeze: true,
    keptFrozenCount,
    filledCount: kept.length - keptFrozenCount,
    ...(pendingFrozenIds.length > 0 ? { pendingFrozenIds } : {}),
  };
}

/**
 * D-v2 A-38 fix (Package 1 + GO10 amendment): the page-1 MEMBERSHIP that Page 2+ must
 * exclude. Page 1 shows at most `pageSize` B cards; a pending (unknown) frozen anchor
 * keeps its page-1 place but is not a card, so a page-1 render in the same state shows
 * one more B per pending anchor from the B pool (deterministic recomputation of the same
 * Page-1 selection). Without pending anchors this equals `repairPage1FreezeOrder`.
 */
export function repairPage2Page1Membership(
  args: Parameters<typeof repairPage1FreezeOrder>[0],
): Page1FreezeRepairResult {
  const base = repairPage1FreezeOrder(args);
  const pendingKept = base.pendingFrozenIds?.length ?? 0;
  if (!base.usedFreeze || pendingKept === 0) {
    return base;
  }
  return repairPage1FreezeOrder({ ...args, pageSize: Math.floor(args.pageSize) + pendingKept });
}

/**
 * D-v2 S5 (Package 1, Master Plan r.696-704): Page 2+ with a usable page-1 freeze.
 * remaining = current B browse pool minus the page-1 ids (relative ranking kept);
 * page N (N >= 2) = paginate(remaining, N - 1). Page-1 ids never appear on page 2+.
 * paginationTotal = page-1 ids + remaining, capped at the browse cap (GO11: may grow).
 */
export function selectBrowsePageWithPage1Freeze(args: {
  browsable: readonly TravelOffer[];
  page1Ids: readonly string[];
  page: number;
  pageSize: number;
  browseCap: number;
}): { offers: TravelOffer[]; remaining: TravelOffer[]; paginationTotal: number } {
  const pageSize = Math.max(1, Math.floor(args.pageSize) || 1);
  const page = Number.isFinite(args.page) && args.page >= 2 ? Math.floor(args.page) : 2;
  const page1Set = new Set(args.page1Ids);
  const remaining = args.browsable.filter((offer) => !page1Set.has(offer.id));
  const start = (page - 2) * pageSize;
  const offers = start < remaining.length ? remaining.slice(start, start + pageSize) : [];
  const paginationTotal = Math.min(
    Math.max(0, Math.floor(args.browseCap)),
    page1Set.size + remaining.length,
  );
  return { offers, remaining, paginationTotal };
}
