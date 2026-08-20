import fs from 'node:fs';
import path from 'node:path';
import { FEED_PATHS } from '@/lib/feeds/feed-paths';
import {
  mergeOfferDetail,
  type OfferDetailRecord,
} from '@/lib/offers/compact-runtime';
import { loadOffers } from '@/lib/offers/load-offers';
import { getStorageObject } from '@/lib/storage/object-storage-client';
import type { TravelOffer } from '@/types/travel';

let cachedDetails: Record<string, OfferDetailRecord> | null = null;

export function resetOfferDetailCacheForTests(): void {
  cachedDetails = null;
}

function resolveLocalDetailsPath(): string {
  const override = process.env.VACATIONWEB_OFFER_DETAILS_FILE?.trim();
  if (!override) {
    return FEED_PATHS.offerDetails;
  }

  return path.isAbsolute(override) ? override : path.join(process.cwd(), override);
}

function parseDetailMap(raw: string): Record<string, OfferDetailRecord> {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Offer detail sidecar must be a JSON object keyed by offer id');
  }

  return parsed as Record<string, OfferDetailRecord>;
}

/**
 * Compact catalog omits long copy / extra gallery (sidecar ~300MB).
 * JSON.parse of that map after loadOffers exceeds Vercel's default 1024MB heap.
 * Local disk sidecar is still used; Vercel must not fetch the remote object.
 */
export async function loadOfferDetailMap(): Promise<Record<string, OfferDetailRecord>> {
  if (cachedDetails !== null) {
    return cachedDetails;
  }

  const localPath = resolveLocalDetailsPath();
  if (fs.existsSync(localPath)) {
    cachedDetails = parseDetailMap(fs.readFileSync(localPath, 'utf8'));
    return cachedDetails;
  }

  if (process.env.VERCEL) {
    cachedDetails = {};
    return cachedDetails;
  }

  try {
    const raw = await getStorageObject(FEED_PATHS.offerDetailsObjectKey);
    cachedDetails = parseDetailMap(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to load offer-detail sidecar from Object Storage (${FEED_PATHS.offerDetailsObjectKey}): ${message}`,
    );
  }

  return cachedDetails;
}

function offerAlreadyHasDetailFields(offer: TravelOffer): boolean {
  return Boolean(
    offer.descriptionLong?.trim()
    || offer.feedDescription?.trim()
    || offer.accommodation?.trim()
    || (offer.images && offer.images.length > 1),
  );
}

export async function loadOfferById(offerId: string): Promise<TravelOffer | undefined> {
  const offers = await loadOffers();
  const offer = offers.find((item) => item.id === offerId);
  if (!offer) {
    return undefined;
  }

  if (offerAlreadyHasDetailFields(offer)) {
    return offer;
  }

  const details = await loadOfferDetailMap();
  return mergeOfferDetail(offer, details[offerId]);
}
