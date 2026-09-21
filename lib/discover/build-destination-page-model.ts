/**
 * Destination Page view-model — reusable for all Discover destinationIds.
 * Media: Destination Media Pool FINAL_VERIFIED_USABLE only (via existing loaders).
 */
import { ensureVerifiedWebPath } from '../destination-media/ensure-verified-web-path';
import {
  meetsGalleryResolution,
  readImageDimensions,
  truncateToFullRows,
} from '../destination-media/image-dimensions';
import { listFinalVerifiedUsableAssets } from '../destination-media/list-final-verified-usable';
import { loadDestinationMediaPool } from '../destination-media/load-destination-media-pool';
import { masterAbsolutePath } from '../destination-media/paths';
import { resolveDiscoverImageSrc } from '../destination-media/resolve-discover-image-src';
import { selectDestinationHeroAsset } from '../destination-media/select-discover-teaser-asset';
import { buildDiscoverResultsHref } from './discover-destination-href';
import { curateDiscoverGallery } from './discover-gallery-assets';
import { getDiscoverGalleryIntro } from './discover-gallery-intros';
import { getDiscoverDestinationById } from './discover-pool';
import { getDestinationHighlights } from './destination-highlights';
import { destinationPlaceLabel } from './destination-place-labels';
import type { DiscoverDestination } from './types';

export const DESTINATION_GALLERY_COLUMNS = 3;

export type DestinationGalleryItem = {
  assetId: string;
  src: string;
  masterPath: string;
  placeId?: string;
  placeLabel: string;
  width: number;
  height: number;
};

export type DestinationPlaceCard = {
  placeId: string;
  label: string;
  src: string;
};

export type DestinationPageModel = {
  destination: DiscoverDestination;
  heroSrc: string;
  intro: string;
  highlights: readonly string[];
  places: DestinationPlaceCard[];
  gallery: DestinationGalleryItem[];
  resultsHref: string;
};

function buildGalleryItems(
  destinationId: string,
  finals: ReturnType<typeof listFinalVerifiedUsableAssets>,
  heroAssetId: string | undefined,
  heroMasterPath: string | undefined,
): DestinationGalleryItem[] {
  const galleryRaw: DestinationGalleryItem[] = [];
  for (const asset of finals) {
    const abs = masterAbsolutePath(asset.masterPath);
    const dims = readImageDimensions(abs);
    if (!meetsGalleryResolution(dims) || !dims) continue;
    const src = ensureVerifiedWebPath(asset);
    if (!src) continue;
    galleryRaw.push({
      assetId: asset.assetId,
      src,
      masterPath: asset.masterPath,
      placeId: asset.placeId,
      placeLabel: destinationPlaceLabel(asset.placeId),
      width: dims.width,
      height: dims.height,
    });
  }

  const curated = curateDiscoverGallery(destinationId, galleryRaw, {
    excludeAssetIds: heroAssetId ? [heroAssetId] : [],
    excludeMasterPaths: heroMasterPath ? [heroMasterPath] : [],
  });

  return truncateToFullRows(curated, DESTINATION_GALLERY_COLUMNS);
}

/** Unique places from the visible curated gallery (media-safe, no invented places). */
function buildPlacesFromGallery(gallery: DestinationGalleryItem[]): DestinationPlaceCard[] {
  const seen = new Set<string>();
  const places: DestinationPlaceCard[] = [];
  for (const item of gallery) {
    if (!item.placeId || seen.has(item.placeId)) continue;
    seen.add(item.placeId);
    places.push({
      placeId: item.placeId,
      label: item.placeLabel || destinationPlaceLabel(item.placeId),
      src: item.src,
    });
  }
  return places;
}

/**
 * Build Destination Page model for one destinationId.
 * Returns null when destination is unknown (caller → notFound).
 */
export function buildDestinationPageModel(destinationId: string): DestinationPageModel | null {
  const destination = getDiscoverDestinationById(destinationId);
  if (!destination) return null;

  const pool = loadDestinationMediaPool(destination.destinationId);
  const finals = pool ? listFinalVerifiedUsableAssets(pool) : [];
  const heroAsset = selectDestinationHeroAsset(destination.destinationId);

  const gallery = buildGalleryItems(
    destination.destinationId,
    finals,
    heroAsset?.assetId,
    heroAsset?.masterPath,
  );

  const heroSrc = heroAsset
    ? ensureVerifiedWebPath(heroAsset) ??
      resolveDiscoverImageSrc(destination.destinationId, destination.imageSrc)
    : resolveDiscoverImageSrc(destination.destinationId, destination.imageSrc);

  return {
    destination,
    heroSrc,
    intro: getDiscoverGalleryIntro(destination.destinationId),
    highlights: getDestinationHighlights(destination.destinationId),
    places: buildPlacesFromGallery(gallery),
    gallery,
    resultsHref: buildDiscoverResultsHref(destination.destinationId),
  };
}
