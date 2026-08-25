import type { TravelOffer } from '@/types/travel';
import { isResultsListableOffer } from '@/lib/search/presentable-price';

export type Page1RenderSlot =
  | { kind: 'immediate'; offer: TravelOffer }
  | { kind: 'pending'; settledOffer?: TravelOffer | null; catalogOffer?: TravelOffer };

/**
 * Visible TravelCards for a Results page.
 *
 * Catalog offers are listable without a proven live price.
 * Provider-confirmed unavailable settled offers are not listable and must not
 * fall back to the catalog card. Technical live failures remain listable.
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
    push(slot.settledOffer);
    if (slot.settledOffer == null) {
      push(slot.catalogOffer);
    }
  }

  for (const offer of args.trailingOffers ?? []) {
    push(offer);
  }

  return visible;
}

/** Pending live overlay uses the catalog TravelCard, not an empty hole. */
export function page1PendingSlotUsesCardFallback(): boolean {
  return true;
}
