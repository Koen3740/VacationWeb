/**
 * GO10: repair stale URL `page1Ids` against the current presentable (B) pool.
 *
 * Page-1 freeze keeps relative order of still-valid frozen ids. Missing/stale
 * ids are dropped; remaining slots are filled from the current ranked B pool.
 * If no frozen id remains valid, the freeze is dropped entirely.
 *
 * Never returns an empty page-1 slice when the presentable pool is non-empty.
 */
import type { TravelOffer } from '@/types/travel';

export type Page1FreezeRepairResult = {
  offers: TravelOffer[];
  page1Ids: string[];
  /** True when at least one frozen id was kept. */
  usedFreeze: boolean;
  keptFrozenCount: number;
  filledCount: number;
};

export function repairPage1FreezeOrder(args: {
  presentableOrdered: readonly TravelOffer[];
  frozenIds: readonly string[] | undefined;
  pageSize: number;
}): Page1FreezeRepairResult {
  const pageSize =
    Number.isFinite(args.pageSize) && args.pageSize > 0
      ? Math.floor(args.pageSize)
      : 0;
  const pool = args.presentableOrdered.filter(Boolean);
  if (pageSize <= 0 || pool.length === 0) {
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
  for (const id of frozenIds) {
    if (seen.has(id)) continue;
    const hit = byId.get(id);
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
  };
}
