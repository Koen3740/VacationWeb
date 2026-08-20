import {
  extractCorendonAccommodationId,
  resolveCorendonFeHost,
  unwrapCorendonProductUrl,
} from '../../providers/corendon/offer-context';
import {
  CORENDON_FE_HOST,
  CORENDON_FE_HOST_BE_FR,
  CORENDON_FE_HOST_NL,
} from '../../providers/corendon/constants';
import { unionHasCarRental } from '../../offers/has-car-rental';
import { collectOrderedOfferImages } from '../../offers/offer-images';
import { buildExternalId } from '../providers';
import { StoredOffer, type ProviderListing } from '../types/stored-offer';

export const CORENDON_BE_CAMPAIGN_ID = '38103';
export const CORENDON_NL_CAMPAIGN_ID = '38108';

export const CORENDON_FEED_BENL = 'corendon-benl';
export const CORENDON_FEED_BEFR = 'corendon-befr';
export const CORENDON_FEED_NL = 'corendon-nl';

export type CorendonFeedSourceId =
  | typeof CORENDON_FEED_BENL
  | typeof CORENDON_FEED_BEFR
  | typeof CORENDON_FEED_NL;

const MANIFEST_ID_TO_SOURCE: Record<string, CorendonFeedSourceId> = {
  'corendon-primary': CORENDON_FEED_BENL,
  [CORENDON_FEED_BENL]: CORENDON_FEED_BENL,
  [CORENDON_FEED_BEFR]: CORENDON_FEED_BEFR,
  [CORENDON_FEED_NL]: CORENDON_FEED_NL,
};

const SOURCE_LOCALE: Record<CorendonFeedSourceId, string> = {
  [CORENDON_FEED_BENL]: 'nl-BE',
  [CORENDON_FEED_BEFR]: 'fr-BE',
  [CORENDON_FEED_NL]: 'nl-NL',
};

/**
 * Primary listing rank for the single TravelOffer.deepLink / live-price host.
 * Not an inventory filter and not a price ranking.
 * Proven live hosts (.be / .nl) first; unique BE-FR-only offers still use fr.corendon.be.
 */
const PRIMARY_HOST_RANK: Record<string, number> = {
  [CORENDON_FE_HOST]: 0,
  [CORENDON_FE_HOST_NL]: 1,
  [CORENDON_FE_HOST_BE_FR]: 2,
};

/**
 * Bookable Corendon identity from the live-price URL fragment.
 * Hotel id alone is not a bookable key: date, duration and room/board are required.
 * Airport route may be empty for city/hotel-only products (no flight hop).
 * Live pricing still uses parseCorendonUrlFragment, which requires an airport route.
 */
type CorendonMergeFragment = {
  accommodationCode: string;
  airportRoute: string;
  dateYymmdd: string;
  durationNights: string;
  roomBoard: string;
};

export function parseCorendonMergeFragment(deepLink: string | undefined): CorendonMergeFragment | null {
  if (!deepLink) {
    return null;
  }
  try {
    const url = new URL(unwrapCorendonProductUrl(deepLink));
    const raw = (url.hash || '').replace(/^#/, '');
    if (!raw) {
      return null;
    }
    const parts = raw.split('.');
    const hotelId = parts[0] || '';
    const accommodationCode = parts[1] || '';
    const airportRoute = parts[2] || '';
    const dateYymmdd = parts[3] || '';
    const durationNights = parts[4] || '';
    const roomBoard = parts[5] || '';
    if (!hotelId || !accommodationCode || dateYymmdd.length !== 6 || !durationNights || !roomBoard) {
      return null;
    }
    return {
      accommodationCode,
      airportRoute,
      dateYymmdd,
      durationNights,
      roomBoard,
    };
  } catch {
    return null;
  }
}

export function buildCorendonBookableKey(deepLink: string | undefined): string | null {
  const fragment = parseCorendonMergeFragment(deepLink);
  if (!fragment) {
    return null;
  }
  return [
    fragment.accommodationCode,
    fragment.airportRoute,
    fragment.dateYymmdd,
    fragment.durationNights,
    fragment.roomBoard,
  ]
    .map((part) => part.trim().toLowerCase())
    .join('|');
}

export function inferCorendonHost(deepLink: string | undefined): string | null {
  if (!deepLink) {
    return null;
  }
  const allowed = resolveCorendonFeHost(deepLink);
  if (allowed) {
    return allowed;
  }
  try {
    return new URL(unwrapCorendonProductUrl(deepLink)).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

export function inferCorendonFeedSourceId(
  deepLink: string | undefined,
  manifestId?: string,
): CorendonFeedSourceId | undefined {
  const host = inferCorendonHost(deepLink);
  if (host === CORENDON_FE_HOST) {
    return CORENDON_FEED_BENL;
  }
  if (host === CORENDON_FE_HOST_BE_FR) {
    return CORENDON_FEED_BEFR;
  }
  if (host === CORENDON_FE_HOST_NL) {
    return CORENDON_FEED_NL;
  }
  if (manifestId && MANIFEST_ID_TO_SOURCE[manifestId]) {
    return MANIFEST_ID_TO_SOURCE[manifestId];
  }
  return undefined;
}

export function annotateCorendonSource(offers: StoredOffer[], manifestId?: string): StoredOffer[] {
  return offers.map((offer) => {
    if (offer.provider !== 'Corendon') {
      return offer;
    }
    const feedSourceId = inferCorendonFeedSourceId(offer.deepLink, manifestId);
    const listingHost = inferCorendonHost(offer.deepLink) ?? undefined;
    return {
      ...offer,
      feedSourceId: feedSourceId ?? offer.feedSourceId,
      listingHost: listingHost ?? offer.listingHost,
    };
  });
}

function sanitizeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, '');
}

/** Unique catalog id that still starts with corendon-{numericHotelId} for live pricing. */
export function assignCorendonCanonicalExternalId(offer: StoredOffer): string {
  const productId =
    extractCorendonAccommodationId(offer.externalId) ??
    offer.externalId.replace(/^corendon-/i, '');
  const fragment = parseCorendonMergeFragment(offer.deepLink);
  if (!fragment) {
    return buildExternalId('corendon', productId);
  }
  return buildExternalId('corendon', productId, [
    fragment.airportRoute,
    fragment.dateYymmdd,
    sanitizeIdPart(fragment.durationNights),
    sanitizeIdPart(fragment.roomBoard),
  ]);
}

function listingIdentity(listing: ProviderListing): string {
  return `${listing.feedId}|${listing.host.toLowerCase()}`;
}

function toListing(offer: StoredOffer): ProviderListing | null {
  if (!offer.deepLink) {
    return null;
  }
  const feedId =
    offer.feedSourceId ?? inferCorendonFeedSourceId(offer.deepLink) ?? CORENDON_FEED_BENL;
  const host = offer.listingHost ?? inferCorendonHost(offer.deepLink) ?? CORENDON_FE_HOST;
  return {
    provider: 'Corendon',
    feedId,
    campaignId: offer.affiliateCampaignId,
    host,
    deepLink: offer.deepLink,
    locale: SOURCE_LOCALE[feedId as CorendonFeedSourceId] ?? undefined,
  };
}

function primaryListingRank(listing: ProviderListing): number {
  return PRIMARY_HOST_RANK[listing.host] ?? 50;
}

function collectMergedListings(records: StoredOffer[]): ProviderListing[] {
  const listings: ProviderListing[] = [];
  const seenListings = new Set<string>();
  const add = (listing: ProviderListing | null | undefined) => {
    if (!listing?.deepLink || !listing.host) {
      return;
    }
    const id = listingIdentity(listing);
    if (seenListings.has(id)) {
      return;
    }
    seenListings.add(id);
    listings.push(listing);
  };
  for (const record of records) {
    add(toListing(record));
    for (const listing of record.providerListings ?? []) {
      add(listing);
    }
  }
  listings.sort((a, b) => {
    const rank = primaryListingRank(a) - primaryListingRank(b);
    return rank !== 0 ? rank : a.feedId.localeCompare(b.feedId);
  });
  return listings;
}

function collectImageUrls(offer: StoredOffer): string[] {
  return collectOrderedOfferImages(offer);
}

function imageCount(offer: StoredOffer): number {
  return collectImageUrls(offer).length;
}

/**
 * Deterministic image union: start from the richest gallery, then append unique URLs.
 * Tie-break by primary-host rank, then feed id. Never uses catalog/feed price.
 */
function unionImages(offers: StoredOffer[]): string[] {
  const ranked = [...offers].sort((a, b) => {
    const byCount = imageCount(b) - imageCount(a);
    if (byCount !== 0) {
      return byCount;
    }
    const hostA = inferCorendonHost(a.deepLink) ?? '';
    const hostB = inferCorendonHost(b.deepLink) ?? '';
    const rank = (PRIMARY_HOST_RANK[hostA] ?? 50) - (PRIMARY_HOST_RANK[hostB] ?? 50);
    if (rank !== 0) {
      return rank;
    }
    return (a.feedSourceId ?? '').localeCompare(b.feedSourceId ?? '');
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const offer of ranked) {
    for (const url of collectImageUrls(offer)) {
      if (seen.has(url)) {
        continue;
      }
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

function localeForSource(feedId: string | undefined): string | undefined {
  if (feedId === CORENDON_FEED_BENL || feedId === CORENDON_FEED_BEFR || feedId === CORENDON_FEED_NL) {
    return SOURCE_LOCALE[feedId];
  }
  return undefined;
}

function longestText(...values: Array<string | undefined>): string | undefined {
  let best: string | undefined;
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) {
      continue;
    }
    if (!best || trimmed.length > best.length) {
      best = trimmed;
    }
  }
  return best;
}

function hotelIdentity(offer: StoredOffer): string | null {
  const acco = offer.accommodation?.trim().toLowerCase();
  if (acco) {
    return `acco:${acco}`;
  }
  const id = extractCorendonAccommodationId(offer.externalId);
  return id ? `id:${id}` : null;
}

function pickPrimaryRecord(records: StoredOffer[]): StoredOffer {
  const withListings = records.map((record) => ({
    record,
    listing: toListing(record),
  }));
  withListings.sort((a, b) => {
    const rankA = a.listing ? primaryListingRank(a.listing) : 99;
    const rankB = b.listing ? primaryListingRank(b.listing) : 99;
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return (a.listing?.feedId ?? '').localeCompare(b.listing?.feedId ?? '');
  });
  return withListings[0]?.record ?? records[0];
}

function mergeLocalizedDescriptions(records: StoredOffer[]): Record<string, string> | undefined {
  const merged: Record<string, string> = {};
  for (const record of records) {
    if (record.localizedDescriptions) {
      for (const [locale, text] of Object.entries(record.localizedDescriptions)) {
        const trimmed = text.trim();
        if (!trimmed) {
          continue;
        }
        const current = merged[locale];
        if (!current || trimmed.length > current.length) {
          merged[locale] = trimmed;
        }
      }
    }
    const locale = localeForSource(record.feedSourceId ?? inferCorendonFeedSourceId(record.deepLink));
    const text = longestText(record.descriptionLong, record.feedDescription);
    if (locale && text && (!merged[locale] || text.length > merged[locale].length)) {
      merged[locale] = text;
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeRecordGroup(records: StoredOffer[]): StoredOffer {
  const primary = pickPrimaryRecord(records);
  const listings = collectMergedListings(records);

  const images = unionImages(records);
  const localizedDescriptions = mergeLocalizedDescriptions(records);
  const primaryLocale = localeForSource(primary.feedSourceId) || listings[0]?.locale;
  const descriptionLong =
    (primaryLocale && localizedDescriptions?.[primaryLocale]) ||
    longestText(...records.map((record) => record.descriptionLong));

  const primaryListing = listings[0];

  return {
    ...primary,
    hotelName: primary.hotelName,
    descriptionShort: longestText(...records.map((record) => record.descriptionShort)),
    descriptionLong,
    extraInfo: longestText(...records.map((record) => record.extraInfo)),
    feedDescription: longestText(...records.map((record) => record.feedDescription)),
    images: images.length > 0 ? images : primary.images,
    imageUrl: images[0] ?? primary.imageUrl,
    imageLarge: images[0] ?? primary.imageLarge,
    imageSmall: longestText(...records.map((record) => record.imageSmall)) ?? primary.imageSmall,
    arrivalAirport:
      records.find((record) => record.arrivalAirport)?.arrivalAirport ?? primary.arrivalAirport,
    localizedDescriptions,
    providerListings: listings.length > 0 ? listings : primary.providerListings,
    feedSourceId: (primaryListing?.feedId as CorendonFeedSourceId | undefined) ?? primary.feedSourceId,
    listingHost: primaryListing?.host ?? primary.listingHost,
    deepLink: primaryListing?.deepLink ?? primary.deepLink,
    affiliateCampaignId: primaryListing?.campaignId ?? primary.affiliateCampaignId,
    hasCarRental: unionHasCarRental(records),
  };
}

function applyHotelContentMerge(offers: StoredOffer[]): { offers: StoredOffer[]; hotelsMerged: number } {
  const byHotel = new Map<string, StoredOffer[]>();
  for (const offer of offers) {
    const key = hotelIdentity(offer);
    if (!key) {
      continue;
    }
    const list = byHotel.get(key) ?? [];
    list.push(offer);
    byHotel.set(key, list);
  }

  let hotelsMerged = 0;
  const hotelContent = new Map<
    string,
    { images: string[]; localizedDescriptions?: Record<string, string> }
  >();

  for (const [key, group] of byHotel) {
    if (group.length < 2) {
      hotelContent.set(key, {
        images: unionImages(group),
        localizedDescriptions: mergeLocalizedDescriptions(group),
      });
      continue;
    }
    hotelsMerged += 1;
    hotelContent.set(key, {
      images: unionImages(group),
      localizedDescriptions: mergeLocalizedDescriptions(group),
    });
  }

  const next = offers.map((offer) => {
    const key = hotelIdentity(offer);
    if (!key) {
      return offer;
    }
    const content = hotelContent.get(key);
    if (!content) {
      return offer;
    }
    const images = content.images.length >= imageCount(offer) ? content.images : collectImageUrls(offer);
    const localizedDescriptions = mergeLocalizedDescriptions([
      { ...offer, localizedDescriptions: content.localizedDescriptions },
      offer,
    ]);
    const locale = localeForSource(offer.feedSourceId) || offer.providerListings?.[0]?.locale;
    const descriptionLong =
      offer.descriptionLong ||
      (locale && localizedDescriptions ? localizedDescriptions[locale] : undefined) ||
      longestText(...Object.values(localizedDescriptions ?? {}));

    return {
      ...offer,
      images: images.length > 0 ? images : offer.images,
      imageUrl: images[0] ?? offer.imageUrl,
      descriptionLong,
      localizedDescriptions:
        localizedDescriptions && Object.keys(localizedDescriptions).length > 0
          ? localizedDescriptions
          : offer.localizedDescriptions,
    };
  });

  return { offers: next, hotelsMerged };
}

export type CorendonMergeStats = {
  input: number;
  unique: number;
  duplicatesDropped: number;
  listingsRetained: number;
  keptWithoutBookableKey: number;
  beNlListings: number;
  beFrListings: number;
  nlListings: number;
  beCampaignKept: number;
  nlCampaignKept: number;
  hotelContentMerged: number;
};

/**
 * Corendon inventory union.
 * Same bookable key → one StoredOffer with all provider listings retained.
 * Content is merged deterministically (richest gallery first). Catalog/feed price is never used.
 */
export function mergeCorendonOffers(offers: StoredOffer[]): {
  offers: StoredOffer[];
  stats: CorendonMergeStats;
} {
  const annotated = annotateCorendonSource(offers);
  const groups = new Map<string, StoredOffer[]>();
  const withoutKey: StoredOffer[] = [];
  let input = 0;

  for (const offer of annotated) {
    if (offer.provider !== 'Corendon') {
      continue;
    }
    input += 1;
    const key = buildCorendonBookableKey(offer.deepLink);
    if (!key) {
      withoutKey.push(offer);
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push(offer);
    groups.set(key, list);
  }

  const mergedGroups: StoredOffer[] = [];
  let intraListingDuplicates = 0;

  for (const records of groups.values()) {
    const byListing = new Map<string, StoredOffer[]>();
    for (const record of records) {
      const listing = toListing(record);
      const id = listing ? listingIdentity(listing) : `none:${record.externalId}`;
      const list = byListing.get(id) ?? [];
      list.push(record);
      byListing.set(id, list);
    }
    const listingWinners: StoredOffer[] = [];
    for (const listingRecords of byListing.values()) {
      intraListingDuplicates += Math.max(0, listingRecords.length - 1);
      listingWinners.push(mergeRecordGroup(listingRecords));
    }
    mergedGroups.push(mergeRecordGroup(listingWinners));
  }

  const keptWithoutKey = withoutKey.map((offer) => ({
    ...offer,
    providerListings: toListing(offer) ? [toListing(offer)!] : offer.providerListings,
  }));

  const combined = [...mergedGroups, ...keptWithoutKey];
  const { offers: withHotelContent, hotelsMerged } = applyHotelContentMerge(combined);

  const seenIds = new Set<string>();
  const withIds: StoredOffer[] = [];
  for (const offer of withHotelContent) {
    let next: StoredOffer = {
      ...offer,
      externalId: assignCorendonCanonicalExternalId(offer),
    };
    if (seenIds.has(next.externalId)) {
      next = {
        ...next,
        externalId: buildExternalId('corendon', next.externalId.replace(/^corendon-/i, ''), [
          next.feedSourceId ?? next.affiliateCampaignId ?? 'feed',
        ]),
      };
    }
    seenIds.add(next.externalId);
    withIds.push(next);
  }

  const listingsRetained = withIds.reduce(
    (sum, offer) => sum + (offer.providerListings?.length ?? (offer.deepLink ? 1 : 0)),
    0,
  );

  const listingFeedCounts = { benl: 0, befr: 0, nl: 0 };
  for (const offer of withIds) {
    for (const listing of offer.providerListings ?? []) {
      if (listing.feedId === CORENDON_FEED_BENL) {
        listingFeedCounts.benl += 1;
      } else if (listing.feedId === CORENDON_FEED_BEFR) {
        listingFeedCounts.befr += 1;
      } else if (listing.feedId === CORENDON_FEED_NL) {
        listingFeedCounts.nl += 1;
      }
    }
  }

  return {
    offers: withIds,
    stats: {
      input,
      unique: withIds.length,
      duplicatesDropped: intraListingDuplicates,
      listingsRetained,
      keptWithoutBookableKey: keptWithoutKey.length,
      beNlListings: listingFeedCounts.benl,
      beFrListings: listingFeedCounts.befr,
      nlListings: listingFeedCounts.nl,
      beCampaignKept: withIds.filter((offer) => offer.affiliateCampaignId === CORENDON_BE_CAMPAIGN_ID)
        .length,
      nlCampaignKept: withIds.filter((offer) => offer.affiliateCampaignId === CORENDON_NL_CAMPAIGN_ID)
        .length,
      hotelContentMerged: hotelsMerged,
    },
  };
}
