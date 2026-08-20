import { ELIZA_PROVIDER_NAME } from '../providers/eliza/constants';
import { isValidOfferImageUrl } from './is-valid-offer-image-url';

export type OfferImageFields = {
  provider?: string;
  imageUrl?: string;
  imageLarge?: string;
  imageSmall?: string;
  images?: string[];
};

/**
 * TradeTracker sometimes stores several image URLs in one property value
 * (array serialized with commas, or a comma-joined string). Split only at a
 * new URL boundary so query strings stay intact.
 */
export function splitFeedImageUrls(raw: string | number | boolean | undefined | null): string[] {
  if (raw === undefined || raw === null) {
    return [];
  }

  const text = String(raw).trim();
  if (!text) {
    return [];
  }

  return text
    .split(/,(?=https?:\/\/)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function flattenImageCandidates(
  ...values: Array<string | number | boolean | Array<string | number | boolean> | undefined | null>
): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        out.push(...splitFeedImageUrls(item));
      }
      continue;
    }
    out.push(...splitFeedImageUrls(value));
  }
  return out;
}

function isZeroDimensionCdnUrl(url: string): boolean {
  return /W0H0\.(?:jpe?g|png|webp)(?:[?#]|$)/i.test(url);
}

function pushUniqueValidUrl(out: string[], seen: Set<string>, url: string): void {
  const trimmed = url.trim();
  if (!trimmed || seen.has(trimmed) || !isValidOfferImageUrl(trimmed)) {
    return;
  }
  seen.add(trimmed);
  out.push(trimmed);
}

/**
 * Valid unique URLs from the feed `<images>` list, in XML order.
 * Does not apply provider hero rules.
 */
export function collectFeedGalleryImages(
  images: OfferImageFields['images'] | undefined,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of flattenImageCandidates(images)) {
    pushUniqueValidUrl(out, seen, url);
  }
  return out;
}

function isElizaOffer(offer: OfferImageFields): boolean {
  return offer.provider === ELIZA_PROVIDER_NAME;
}

/**
 * Eliza TradeTracker (campaign 1327): the official CMS hero is XML `images[3]`
 * when the feed gallery has at least 5 photos. Remaining URLs keep their
 * relative order. Fewer than 5 images keep the existing first URL.
 */
function promoteElizaXmlHero(out: string[], offer: OfferImageFields): void {
  if (!isElizaOffer(offer)) {
    return;
  }

  const feedGallery = collectFeedGalleryImages(offer.images);
  if (feedGallery.length < 5) {
    return;
  }

  const hero = feedGallery[3];
  if (!hero) {
    return;
  }

  const seen = new Set<string>();
  const next: string[] = [];
  const push = (url: string): void => {
    if (!url || seen.has(url)) {
      return;
    }
    seen.add(url);
    next.push(url);
  };

  push(hero);
  for (const url of feedGallery) {
    if (url !== hero) {
      push(url);
    }
  }
  for (const url of out) {
    push(url);
  }

  out.length = 0;
  out.push(...next);
}

/**
 * Gallery order for catalog/UI.
 * When `imageURL_large` / `imageLarge` exists, that designated large image is
 * the hero. Remaining URLs stay in the gallery. No visual room-detection.
 * A Corendon W0H0 CDN URL is a zero-dimension thumbnail and is not used as
 * hero when a sized image is already in the same gallery.
 * Eliza: XML `images[3]` is the proven provider hero when there are ≥5 photos.
 */
export function collectOrderedOfferImages(offer: OfferImageFields): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const url of flattenImageCandidates(offer.imageLarge, offer.imageUrl, offer.imageSmall, offer.images)) {
    pushUniqueValidUrl(out, seen, url);
  }

  const hero = out[0];
  if (hero && isZeroDimensionCdnUrl(hero)) {
    const sizedIndex = out.findIndex((url) => !isZeroDimensionCdnUrl(url));
    if (sizedIndex > 0) {
      const [sized] = out.splice(sizedIndex, 1);
      if (sized) {
        out.unshift(sized);
      }
    }
  }

  promoteElizaXmlHero(out, offer);
  return out;
}
