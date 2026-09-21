import { ensureVerifiedWebPath } from './ensure-verified-web-path';
import { selectDiscoverTeaserAsset } from './select-discover-teaser-asset';
import type { SelectDiscoverTeaserOptions } from './select-discover-teaser-asset';

export type ResolveDiscoverImageSrcOptions = SelectDiscoverTeaserOptions & {
  copyIfMissing?: boolean;
};

/**
 * Discover teaser imageSrc from Destination Media Pool when possible.
 * Falls back to seedImageSrc (destination-specific wow-ssot) — never another destination.
 */
export function resolveDiscoverImageSrc(
  destinationId: string,
  seedImageSrc: string,
  options: ResolveDiscoverImageSrcOptions = {},
): string {
  const asset = selectDiscoverTeaserAsset(destinationId, options);
  if (!asset) return seedImageSrc;

  const web = ensureVerifiedWebPath(asset, {
    root: options.root,
    copyIfMissing: options.copyIfMissing,
  });

  return web ?? seedImageSrc;
}
