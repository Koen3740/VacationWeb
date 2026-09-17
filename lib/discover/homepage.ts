import { HOMEPAGE_DISCOVER_SLOT_COUNT } from './constants';
import { DISCOVER_DESTINATIONS } from './destinations';
import type { DiscoverDestination } from './types';

export { HOMEPAGE_DISCOVER_SLOT_COUNT };

/**
 * Homepage Discover selection.
 * Returns up to five active destinations from the central dataset.
 * Does not rotate, rank, or invent destinations.
 */
export function getHomepageDiscoverDestinations(
  source: readonly DiscoverDestination[] = DISCOVER_DESTINATIONS,
): DiscoverDestination[] {
  return source
    .filter((destination) => destination.status === 'active')
    .slice(0, HOMEPAGE_DISCOVER_SLOT_COUNT);
}
