import {
  getDiscoverDestinationById,
  getDiscoverPool,
  isDiscoverDestinationRenderable,
} from './discover-pool';
import type {
  DiscoverDestination,
  DiscoverHomepageSlotState,
} from './types';

/**
 * Resolve homepage slot state → renderable DiscoverDestination[].
 * Per slot (in order):
 * 1. Try current destinationId if renderable in pool
 * 2. Else try previousDestinationId (failsafe)
 * 3. Else skip (no ghost / placeholder card)
 *
 * Returns length 0..HOMEPAGE_DISCOVER_LIMIT. No invented filler.
 */
export function resolveHomepageDiscoverSlots(
  state: DiscoverHomepageSlotState,
  pool: readonly DiscoverDestination[] = getDiscoverPool(),
): DiscoverDestination[] {
  const result: DiscoverDestination[] = [];

  for (const slot of state.slots) {
    const current =
      slot.destinationId != null
        ? getDiscoverDestinationById(slot.destinationId, pool)
        : undefined;
    if (isDiscoverDestinationRenderable(current)) {
      result.push(current);
      continue;
    }

    const previous =
      slot.previousDestinationId != null
        ? getDiscoverDestinationById(slot.previousDestinationId, pool)
        : undefined;
    if (isDiscoverDestinationRenderable(previous)) {
      result.push(previous);
      continue;
    }

    // Both missing/inactive/non-renderable → skip slot
  }

  return result;
}
