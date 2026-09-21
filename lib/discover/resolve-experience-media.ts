/**
 * Resolve Active Experience Set slots from Destination Media Pool FINAL only.
 */
import { ensureVerifiedWebPath } from '../destination-media/ensure-verified-web-path';
import { listFinalVerifiedUsableAssets } from '../destination-media/list-final-verified-usable';
import { loadDestinationMediaPool } from '../destination-media/load-destination-media-pool';
import type { DestinationMediaPoolAsset } from '../destination-media/types';
import { destinationPlaceLabel } from './destination-place-labels';
import type { ExperienceMediaSlot } from './destination-experience-types';

export function finalsByDestinationId(
  destinationId: string,
): Map<string, DestinationMediaPoolAsset> {
  const pool = loadDestinationMediaPool(destinationId);
  const finals = pool ? listFinalVerifiedUsableAssets(pool) : [];
  return new Map(finals.map((a) => [a.assetId, a]));
}

export function resolveExperienceSlot(
  byId: Map<string, DestinationMediaPoolAsset>,
  assetId: string,
  role: string,
  excludeIds: ReadonlySet<string>,
): ExperienceMediaSlot | null {
  if (excludeIds.has(assetId)) return null;
  const asset = byId.get(assetId);
  if (!asset) return null;
  const src = ensureVerifiedWebPath(asset);
  if (!src) return null;
  return {
    assetId,
    src,
    placeId: asset.placeId,
    placeLabel: destinationPlaceLabel(asset.placeId),
    role,
  };
}

export function firstAvailableSlot(
  byId: Map<string, DestinationMediaPoolAsset>,
  ids: readonly string[],
  role: string,
  excludeIds: ReadonlySet<string>,
): ExperienceMediaSlot | null {
  for (const id of ids) {
    const slot = resolveExperienceSlot(byId, id, role, excludeIds);
    if (slot) return slot;
  }
  return null;
}