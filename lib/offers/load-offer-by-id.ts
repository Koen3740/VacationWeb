import fs from 'node:fs';
import path from 'node:path';
import { FEED_PATHS } from '@/lib/feeds/feed-paths';
import {
  mergeOfferDetail,
  type OfferDetailRecord,
} from '@/lib/offers/compact-runtime';
import {
  loadRuntimeDataset,
  readGenerationDetailObject,
  resetRuntimeDatasetCacheForTests,
} from '@/lib/offers/load-runtime-dataset';
import { getStorageObject } from '@/lib/storage/object-storage-client';
import type { TravelOffer } from '@/types/travel';

let cachedDetails: Record<string, OfferDetailRecord> | null = null;

export function resetOfferDetailCacheForTests(): void {
  cachedDetails = null;
  resetRuntimeDatasetCacheForTests();
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

function parseDetailRecord(raw: string, offerId: string): OfferDetailRecord {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Offer detail object for ${offerId} is not a JSON object`);
  }
  return parsed as OfferDetailRecord;
}

/**
 * Legacy two-file sidecar loader. Not used for versioned generations.
 * Compact catalog omits long copy / extra gallery. Local disk sidecar is used
 * when present; Vercel must not fetch the remote mega-object.
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
  // Runtime card galleries are capped for Results; never skip the detail sidecar merge
  // just because `offer.images` already has multiple URLs.
  return Boolean(
    offer.descriptionLong?.trim()
    || offer.feedDescription?.trim()
    || offer.accommodation?.trim(),
  );
}

export async function loadOfferById(offerId: string): Promise<TravelOffer | undefined> {
  const dataset = await loadRuntimeDataset();
  const offer = dataset.offers.find((item) => item.id === offerId);
  if (!offer) {
    return undefined;
  }

  if (offerAlreadyHasDetailFields(offer)) {
    return offer;
  }

  if (dataset.mode === 'generation') {
    const raw = await readGenerationDetailObject(dataset, offer);
    return mergeOfferDetail(offer, parseDetailRecord(raw, offerId));
  }

  const details = await loadOfferDetailMap();
  return mergeOfferDetail(offer, details[offerId]);
}
