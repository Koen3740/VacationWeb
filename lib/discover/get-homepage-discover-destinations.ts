import { loadHomepageDiscoverSlotState } from './homepage-discover-slot-state-io';
import { resolveHomepageDiscoverSlots } from './resolve-homepage-discover-slots';
import {
  HOMEPAGE_DISCOVER_LIMIT,
  type DiscoverDestination,
  type DiscoverHomepageSlotState,
} from './types';

export type GetHomepageDiscoverDestinationsOptions = {
  /** Max destinations to return (homepage capacity = 5). Default 5. */
  limit?: number;
  /** Optional slot state override (tests / callers). */
  state?: DiscoverHomepageSlotState;
};

/**
 * Returns homepage Discover destinations via slot resolve + failsafe.
 * Default state source: persisted JSON via loadHomepageDiscoverSlotState().
 * API stable for page.tsx: getHomepageDiscoverDestinations({ limit: 5 }).
 * NO auto-rotation / scheduler.
 */
export function getHomepageDiscoverDestinations(
  options: GetHomepageDiscoverDestinationsOptions = {
    limit: HOMEPAGE_DISCOVER_LIMIT,
  },
): DiscoverDestination[] {
  const rawLimit = options.limit ?? HOMEPAGE_DISCOVER_LIMIT;
  const limit = Math.max(0, Math.min(rawLimit, HOMEPAGE_DISCOVER_LIMIT));
  const state = options.state ?? loadHomepageDiscoverSlotState();

  return resolveHomepageDiscoverSlots(state).slice(0, limit);
}
