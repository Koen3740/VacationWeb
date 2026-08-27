import { normalizeOffer } from '../feeds/canonical/normalize-offer';
import type { StoredOffer } from '../feeds/types/stored-offer';
import { ELIZA_PROVIDER_NAME } from '../providers/eliza/constants';
import { collectFeedGalleryImages, collectOrderedOfferImages } from './offer-images';
import { buildCompactSearchText } from '../search/offer-text';
import type { TravelOffer } from '../../types/travel';

/** Max photos kept on the Results runtime catalog for the card mini-gallery. */
export const RESULTS_CARD_GALLERY_MAX = 5;

/** Fields required only by offer-detail (and preserved in the sidecar). */
export type OfferDetailRecord = {
  descriptionLong?: string;
  feedDescription?: string;
  localizedDescriptions?: Record<string, string>;
  accommodation?: string;
  images?: string[];
  imageLarge?: string;
  imageSmall?: string;
  durationType?: string;
  variations?: string;
  latitude?: number | null;
  longitude?: number | null;
};

function hasText(value: string | undefined | null): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function uniqueImageUrls(stored: StoredOffer): string[] {
  return collectOrderedOfferImages(stored);
}

function assignIfPresent<T extends object>(
  target: T,
  key: keyof T,
  value: T[keyof T] | undefined,
): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return;
  }

  if (Array.isArray(value) && value.length === 0) {
    return;
  }

  target[key] = value;
}

/**
 * True when the record already looks like a compact runtime offer
 * (search corpus present, bulky detail fields already stripped).
 */
export function isCompactStoredOffer(offer: StoredOffer): boolean {
  const hasSearchText = hasText(offer.searchText);
  const hasLongCopy = hasText(offer.descriptionLong) || hasText(offer.feedDescription);
  // Card galleries (≤ RESULTS_CARD_GALLERY_MAX) stay on runtime; larger galleries are detail-only.
  const hasFullGallery = (offer.images?.length ?? 0) > RESULTS_CARD_GALLERY_MAX;

  return hasSearchText && !hasLongCopy && !hasFullGallery;
}

export function compactStoredOffer(stored: StoredOffer): {
  runtime: StoredOffer;
  detail?: OfferDetailRecord;
} {
  const normalized = normalizeOffer(stored);
  const gallery = uniqueImageUrls(stored);
  const hasSourceCopy =
    hasText(stored.descriptionLong) || hasText(stored.feedDescription) || hasText(stored.accommodation);
  const searchText = hasSourceCopy
    ? buildCompactSearchText(normalized)
    : hasText(stored.searchText)
      ? stored.searchText.trim().toLowerCase()
      : undefined;

  const runtime: StoredOffer = {
    externalId: stored.externalId,
    provider: stored.provider,
    hotelName: normalized.hotelName,
    country: stored.country,
    nights: stored.nights,
    price: stored.price,
    imageUrl: gallery[0] ?? stored.imageUrl ?? '',
    deepLink: stored.deepLink,
  };

  assignIfPresent(runtime, 'canonicalOfferIdentity', stored.canonicalOfferIdentity);
  assignIfPresent(runtime, 'accommodationType', stored.accommodationType);
  assignIfPresent(runtime, 'province', stored.province);
  assignIfPresent(runtime, 'region', stored.region);
  assignIfPresent(runtime, 'city', stored.city);
  assignIfPresent(runtime, 'departureAirport', stored.departureAirport);
  assignIfPresent(runtime, 'departureAirportCode', stored.departureAirportCode);
  assignIfPresent(runtime, 'airport', stored.airport);
  assignIfPresent(runtime, 'departureDate', stored.departureDate);
  assignIfPresent(runtime, 'boardType', stored.boardType);
  assignIfPresent(runtime, 'flightIncluded', stored.flightIncluded);
  assignIfPresent(runtime, 'lastMinute', stored.lastMinute);
  if (stored.hasCarRental === true) {
    runtime.hasCarRental = true;
  }
  assignIfPresent(runtime, 'currency', stored.currency);
  assignIfPresent(runtime, 'stars', stored.stars ?? undefined);
  assignIfPresent(runtime, 'rating', stored.rating ?? undefined);
  assignIfPresent(runtime, 'descriptionShort', stored.descriptionShort);
  assignIfPresent(runtime, 'extraInfo', stored.extraInfo);
  assignIfPresent(runtime, 'subcategories', stored.subcategories);
  assignIfPresent(runtime, 'categories', stored.categories);
  assignIfPresent(runtime, 'affiliateCampaignId', stored.affiliateCampaignId);
  assignIfPresent(runtime, 'arrivalAirport', stored.arrivalAirport);
  assignIfPresent(runtime, 'feedSourceId', stored.feedSourceId);
  assignIfPresent(runtime, 'listingHost', stored.listingHost);
  assignIfPresent(runtime, 'providerListings', stored.providerListings);
  assignIfPresent(runtime, 'searchText', searchText);

  const detail: OfferDetailRecord = {};
  assignIfPresent(detail, 'descriptionLong', stored.descriptionLong);
  assignIfPresent(detail, 'feedDescription', stored.feedDescription);
  assignIfPresent(detail, 'localizedDescriptions', stored.localizedDescriptions);
  assignIfPresent(detail, 'accommodation', stored.accommodation);
  if (gallery.length > 1) {
    // Keep a short card gallery on Results runtime; full set stays in detail.
    runtime.images = gallery.slice(0, RESULTS_CARD_GALLERY_MAX);
    // Eliza sidecar keeps XML/feed order so Detail can apply the hero rule
    // once. Display order is [images[3], ...rest] via collectOrderedOfferImages.
    const elizaFeedGallery =
      stored.provider === ELIZA_PROVIDER_NAME
        ? collectFeedGalleryImages(stored.images)
        : [];
    detail.images = elizaFeedGallery.length > 1 ? elizaFeedGallery : gallery;
  }
  if (hasText(stored.imageLarge) && stored.imageLarge.trim() !== runtime.imageUrl) {
    detail.imageLarge = stored.imageLarge.trim();
  }
  if (hasText(stored.imageSmall) && stored.imageSmall.trim() !== runtime.imageUrl) {
    detail.imageSmall = stored.imageSmall.trim();
  }
  assignIfPresent(detail, 'durationType', stored.durationType);
  assignIfPresent(detail, 'variations', stored.variations);
  if (stored.latitude != null) {
    detail.latitude = stored.latitude;
  }
  if (stored.longitude != null) {
    detail.longitude = stored.longitude;
  }

  return {
    runtime,
    detail: Object.keys(detail).length > 0 ? detail : undefined,
  };
}

export function splitStoredCatalog(offers: StoredOffer[]): {
  runtime: StoredOffer[];
  details: Record<string, OfferDetailRecord>;
} {
  const runtime: StoredOffer[] = [];
  const details: Record<string, OfferDetailRecord> = {};

  for (const stored of offers) {
    const split = compactStoredOffer(stored);
    runtime.push(split.runtime);
    if (split.detail) {
      details[stored.externalId] = split.detail;
    }
  }

  return { runtime, details };
}

export function mergeOfferDetail(
  offer: TravelOffer,
  detail: OfferDetailRecord | undefined,
): TravelOffer {
  if (!detail) {
    return offer;
  }

  return {
    ...offer,
    descriptionLong: detail.descriptionLong ?? offer.descriptionLong,
    feedDescription: detail.feedDescription ?? offer.feedDescription,
    localizedDescriptions: detail.localizedDescriptions ?? offer.localizedDescriptions,
    accommodation: detail.accommodation ?? offer.accommodation,
    images: detail.images ?? offer.images,
    imageLarge: detail.imageLarge ?? offer.imageLarge,
    imageSmall: detail.imageSmall ?? offer.imageSmall,
    durationType: detail.durationType ?? offer.durationType,
    variations: detail.variations ?? offer.variations,
    latitude: detail.latitude ?? offer.latitude,
    longitude: detail.longitude ?? offer.longitude,
  };
}
