import { canonicalizeBoardType, type CanonicalBoardType } from '../../offers/canonicalize-board-type';
import {
  extractSunwebAccommodationId,
  resolveSunwebFeHost,
  unwrapSunwebProductUrl,
} from '../../providers/sunweb/offer-context';
import { SUNWEB_FE_HOST, SUNWEB_PROVIDER_NAME } from '../../providers/sunweb/constants';
import { unionHasCarRental } from '../../offers/has-car-rental';
import { collectOrderedOfferImages } from '../../offers/offer-images';
import { canonicalizeDepartureAirportCode } from '../../search/departure-airports';
import { buildExternalId } from '../providers';
import { StoredOffer, type ProviderListing } from '../types/stored-offer';

export type SunwebBookableContext = {
  accoId: string;
  departureDate: string;
  departureAirport: string;
  duration: string;
  board: CanonicalBoardType;
};

/** Airport slot when the landing has no IATA (SelfDrive / missing DepartureAirport). */
export const SUNWEB_ABSENT_AIRPORT = 'none';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function readLandingParam(deepLink: string | undefined, indexed: string, plain: string): string {
  if (!deepLink) {
    return '';
  }
  try {
    const url = new URL(unwrapSunwebProductUrl(deepLink));
    return (url.searchParams.get(indexed) || url.searchParams.get(plain) || '').trim();
  } catch {
    return '';
  }
}

function tradeTrackerToken(deepLink: string): string {
  try {
    const tt = new URL(deepLink).searchParams.get('tt');
    return tt?.trim() ? `tt:${tt}` : deepLink;
  } catch {
    return deepLink;
  }
}

/**
 * Bookable Sunweb identity from landing query, with feed fallbacks for overlay gaps.
 * Hotel name, price, image, description, tt and feed-id are not part of the key.
 * Airport may be absent (SelfDrive); that slot is then SUNWEB_ABSENT_AIRPORT.
 */
export function resolveSunwebBookableContext(offer: StoredOffer): SunwebBookableContext | null {
  const accoId = extractSunwebAccommodationId(offer.externalId);
  if (!accoId) {
    return null;
  }

  const landingDate = readLandingParam(offer.deepLink, 'DepartureDate[0]', 'DepartureDate');
  const landingAirport = readLandingParam(offer.deepLink, 'DepartureAirport[0]', 'DepartureAirport');
  const landingDuration = readLandingParam(offer.deepLink, 'Duration[0]', 'Duration');
  const landingMeal = readLandingParam(offer.deepLink, 'Mealplan[0]', 'Mealplan');

  const departureDate = (landingDate || offer.departureDate || '').trim();
  const resolvedAirport = canonicalizeDepartureAirportCode(landingAirport || offer.departureAirport);
  const duration =
    (landingDuration || (offer.nights != null && offer.nights > 0 ? String(offer.nights) : '')).trim();
  const board = canonicalizeBoardType(landingMeal || offer.boardType);

  if (!ISO_DATE.test(departureDate) || !duration || !board) {
    return null;
  }
  if (!/^\d+$/.test(duration) || Number(duration) <= 0) {
    return null;
  }

  return {
    accoId,
    departureDate,
    departureAirport: resolvedAirport || SUNWEB_ABSENT_AIRPORT,
    duration,
    board,
  };
}

export function buildSunwebBookableKey(offer: StoredOffer): string | null {
  const context = resolveSunwebBookableContext(offer);
  if (!context) {
    return null;
  }
  return [
    context.accoId,
    context.departureDate,
    context.departureAirport,
    context.duration,
    context.board,
  ]
    .map((part) => part.trim().toLowerCase())
    .join('|');
}

export function inferSunwebHost(deepLink: string | undefined): string | null {
  if (!deepLink) {
    return null;
  }
  const allowed = resolveSunwebFeHost(deepLink);
  if (allowed) {
    return allowed;
  }
  try {
    return new URL(unwrapSunwebProductUrl(deepLink)).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

export function annotateSunwebSource(offers: StoredOffer[], manifestId?: string): StoredOffer[] {
  return offers.map((offer) => {
    if (offer.provider !== SUNWEB_PROVIDER_NAME) {
      return offer;
    }
    return {
      ...offer,
      feedSourceId: manifestId ?? offer.feedSourceId,
      listingHost: inferSunwebHost(offer.deepLink) ?? offer.listingHost,
    };
  });
}

function sanitizeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, '');
}

export function assignSunwebCanonicalExternalId(offer: StoredOffer): string {
  const context = resolveSunwebBookableContext(offer);
  const accoId = extractSunwebAccommodationId(offer.externalId);
  if (!context || !accoId) {
    return offer.externalId;
  }
  return buildExternalId('sunweb', accoId, [
    context.departureDate,
    context.duration,
    context.departureAirport,
    sanitizeIdPart(context.board),
  ]);
}

function listingIdentity(listing: ProviderListing): string {
  return `${listing.feedId}|${listing.campaignId ?? ''}|${tradeTrackerToken(listing.deepLink)}`;
}

function toListing(offer: StoredOffer): ProviderListing | null {
  if (!offer.deepLink) {
    return null;
  }
  return {
    provider: SUNWEB_PROVIDER_NAME,
    feedId: offer.feedSourceId ?? 'sunweb',
    campaignId: offer.affiliateCampaignId,
    host: offer.listingHost ?? inferSunwebHost(offer.deepLink) ?? SUNWEB_FE_HOST,
    deepLink: offer.deepLink,
  };
}

function collectMergedListings(records: StoredOffer[]): ProviderListing[] {
  const listings: ProviderListing[] = [];
  const seenListings = new Set<string>();
  const add = (listing: ProviderListing | null | undefined) => {
    if (!listing?.deepLink) {
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
  listings.sort((a, b) => a.feedId.localeCompare(b.feedId) || a.deepLink.localeCompare(b.deepLink));
  return listings;
}

function overlayCompleteness(offer: StoredOffer): number {
  let score = 0;
  if (canonicalizeDepartureAirportCode(offer.departureAirport)) {
    score += 4;
  }
  if (offer.boardType?.trim()) {
    score += 4;
  }
  if (offer.descriptionShort?.trim()) {
    score += 1;
  }
  if ((offer.images?.length ?? 0) > 0) {
    score += 1;
  }
  return score;
}

function collectImageUrls(offer: StoredOffer): string[] {
  return collectOrderedOfferImages(offer);
}

function unionImages(offers: StoredOffer[]): string[] {
  const ranked = [...offers].sort((a, b) => overlayCompleteness(b) - overlayCompleteness(a));
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

function pickPrimaryRecord(records: StoredOffer[]): StoredOffer {
  const ranked = [...records].sort((a, b) => {
    const byComplete = overlayCompleteness(b) - overlayCompleteness(a);
    if (byComplete !== 0) {
      return byComplete;
    }
    return (a.feedSourceId ?? '').localeCompare(b.feedSourceId ?? '');
  });
  return ranked[0] ?? records[0];
}

function mergeRecordGroup(records: StoredOffer[], context: SunwebBookableContext): StoredOffer {
  const primary = pickPrimaryRecord(records);
  const listings = collectMergedListings(records);

  const images = unionImages(records);
  const primaryListing =
    listings.find((listing) => listing.deepLink === primary.deepLink) ?? listings[0];
  const catalogAirport =
    context.departureAirport === SUNWEB_ABSENT_AIRPORT
      ? primary.departureAirport
      : context.departureAirport;

  return {
    ...primary,
    departureAirport: catalogAirport,
    boardType: context.board,
    nights: primary.nights ?? Number(context.duration),
    departureDate: primary.departureDate || context.departureDate,
    descriptionShort: longestText(...records.map((record) => record.descriptionShort)),
    extraInfo: longestText(...records.map((record) => record.extraInfo)),
    feedDescription: longestText(...records.map((record) => record.feedDescription)),
    images: images.length > 0 ? images : primary.images,
    imageUrl: images[0] ?? primary.imageUrl,
    imageLarge: longestText(...records.map((record) => record.imageLarge)) ?? primary.imageLarge,
    imageSmall: longestText(...records.map((record) => record.imageSmall)) ?? primary.imageSmall,
    providerListings: listings.length > 0 ? listings : primary.providerListings,
    feedSourceId: primaryListing?.feedId ?? primary.feedSourceId,
    listingHost: primaryListing?.host ?? primary.listingHost,
    deepLink: primaryListing?.deepLink ?? primary.deepLink,
    affiliateCampaignId: primaryListing?.campaignId ?? primary.affiliateCampaignId,
    hasCarRental: unionHasCarRental(records),
  };
}

export type SunwebMergeStats = {
  input: number;
  unique: number;
  duplicatesDropped: number;
  listingsRetained: number;
  keptWithoutBookableKey: number;
};

/**
 * Same bookable Sunweb context → one StoredOffer with all provider listings retained.
 * Different date, airport, duration or board stay separate. Catalog/feed price is not a key.
 */
export function mergeSunwebOffers(offers: StoredOffer[]): {
  offers: StoredOffer[];
  stats: SunwebMergeStats;
} {
  const annotated = annotateSunwebSource(offers);
  const groups = new Map<string, StoredOffer[]>();
  const withoutKey: StoredOffer[] = [];
  let input = 0;

  for (const offer of annotated) {
    if (offer.provider !== SUNWEB_PROVIDER_NAME) {
      continue;
    }
    input += 1;
    const key = buildSunwebBookableKey(offer);
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
    const context = resolveSunwebBookableContext(records[0]!);
    if (!context) {
      withoutKey.push(...records);
      continue;
    }
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
      listingWinners.push(mergeRecordGroup(listingRecords, context));
    }
    mergedGroups.push(mergeRecordGroup(listingWinners, context));
  }

  const keptWithoutKey = withoutKey.map((offer) => ({
    ...offer,
    providerListings: toListing(offer) ? [toListing(offer)!] : offer.providerListings,
  }));

  const combined = [...mergedGroups, ...keptWithoutKey];
  const seenIds = new Set<string>();
  const withIds: StoredOffer[] = [];
  for (const offer of combined) {
    let next: StoredOffer = {
      ...offer,
      externalId: assignSunwebCanonicalExternalId(offer),
    };
    if (seenIds.has(next.externalId)) {
      next = {
        ...next,
        externalId: buildExternalId('sunweb', next.externalId.replace(/^sunweb-/i, ''), [
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

  return {
    offers: withIds,
    stats: {
      input,
      unique: withIds.length,
      duplicatesDropped: intraListingDuplicates,
      listingsRetained,
      keptWithoutBookableKey: keptWithoutKey.length,
    },
  };
}
