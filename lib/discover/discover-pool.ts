import { resolveDiscoverImageSrc } from '../destination-media/resolve-discover-image-src';
import { HOMEPAGE_DISCOVER_DESTINATIONS } from './homepage-discover-destinations';
import type { DiscoverDestination } from './types';

/**
 * Managed Discover destination pool (Build 02 + P3).
 * Source = static seed (same 4 WOW cards) with imageSrc overlaid from
 * Destination Media Pool FINAL_VERIFIED_USABLE when a verified web path exists.
 * Seed wow-ssot imageSrc remains the per-destination fallback.
 * NO auto-scheduler / research / Ops Center / 5th destination.
 */

/** Returns the active pool source with Destination Media teaser images when available. */
export function getDiscoverPool(): readonly DiscoverDestination[] {
  return HOMEPAGE_DISCOVER_DESTINATIONS.map((d) => ({
    ...d,
    imageSrc: resolveDiscoverImageSrc(d.destinationId, d.imageSrc),
  }));
}

/** Lookup by id in pool (defaults to getDiscoverPool()). */
export function getDiscoverDestinationById(
  id: string,
  pool: readonly DiscoverDestination[] = getDiscoverPool(),
): DiscoverDestination | undefined {
  return pool.find((d) => d.destinationId === id);
}

/**
 * Whether a destination is safe to render as a homepage card:
 * active status + non-empty imageSrc + non-empty name.
 */
export function isDiscoverDestinationRenderable(
  d: DiscoverDestination | null | undefined,
): d is DiscoverDestination {
  if (!d) return false;
  const status = d.status ?? 'active';
  if (status !== 'active') return false;
  if (typeof d.imageSrc !== 'string' || d.imageSrc.trim() === '') return false;
  if (typeof d.name !== 'string' || d.name.trim() === '') return false;
  return true;
}

