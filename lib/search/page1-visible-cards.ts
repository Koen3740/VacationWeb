import type { TravelOffer } from '@/types/travel';
import { isResultsListableOffer } from '@/lib/search/presentable-price';

export type Page1RenderSlot =
  | { kind: 'immediate'; offer: TravelOffer }
  | { kind: 'pending'; settledOffer?: TravelOffer | null; catalogOffer?: TravelOffer };

/**
 * Visible TravelCards for a Results page.
 *
 * Presentable pool = B only. Pending catalog shells and settled A/C must not
 * count as visible cards. Matchset membership is separate from this paint set.
 */
export function collectPage1VisibleTravelCards(args: {
  slots: readonly Page1RenderSlot[];
  trailingOffers?: readonly TravelOffer[];
}): TravelOffer[] {
  const visible: TravelOffer[] = [];
  const seen = new Set<string>();

  const push = (offer: TravelOffer | null | undefined): void => {
    if (!offer || seen.has(offer.id) || !isResultsListableOffer(offer)) {
      return;
    }
    visible.push(offer);
    seen.add(offer.id);
  };

  for (const slot of args.slots) {
    if (slot.kind === 'immediate') {
      push(slot.offer);
      continue;
    }
    // Pending: only a settled presentable B counts — never the catalog shell.
    push(slot.settledOffer);
  }

  for (const offer of args.trailingOffers ?? []) {
    push(offer);
  }

  return visible;
}

/** Pending live overlay must not paint a provisional Results card. */
export function page1PendingSlotUsesCardFallback(): boolean {
  return false;
}
