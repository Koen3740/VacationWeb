import { HOMEPAGE_DISCOVER_DESTINATIONS } from './homepage-discover-destinations';
import {
  HOMEPAGE_DISCOVER_LIMIT,
  type DiscoverHomepageSlot,
  type DiscoverHomepageSlotState,
  type DiscoverSlotIndex,
} from './types';

/**
 * Default homepage Discover slot state (Build 02/03).
 * Exactly HOMEPAGE_DISCOVER_LIMIT (5) slots:
 * - slots 0..3: seed destinations in order; previousDestinationId = same id (failsafe baseline)
 * - slot 4: empty (null) — capacity explicit, not rendered until filled with a real destination
 *
 * No invented 5th destination.
 */
function buildDefaultSlots(): DiscoverHomepageSlot[] {
  const seed = HOMEPAGE_DISCOVER_DESTINATIONS;
  const slots: DiscoverHomepageSlot[] = [];

  for (let i = 0; i < HOMEPAGE_DISCOVER_LIMIT; i++) {
    const slotIndex = i as DiscoverSlotIndex;
    if (i < seed.length) {
      const id = seed[i].destinationId;
      slots.push({
        slotIndex,
        destinationId: id,
        previousDestinationId: id,
      });
    } else {
      slots.push({
        slotIndex,
        destinationId: null,
        previousDestinationId: null,
      });
    }
  }

  return slots;
}

export const DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE: DiscoverHomepageSlotState = {
  slots: buildDefaultSlots(),
};
