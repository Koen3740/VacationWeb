import { createHash } from 'node:crypto';
import { parseCorendonMergeFragment } from '../feeds/importers/corendon-merge';
import {
  resolveSunwebBookableContext,
  resolveSunwebTripFields,
} from '../feeds/importers/sunweb-merge';
import type { StoredOffer } from '../feeds/types/stored-offer';
import { CORENDON_PROVIDER_NAME } from '../providers/corendon/constants';
import { extractCorendonAccommodationId } from '../providers/corendon/offer-context';
import { ELIZA_PROVIDER_NAME } from '../providers/eliza/constants';
import { extractElizaAccommodationId } from '../providers/eliza/offer-context';
import { PRIJSVRIJ_PROVIDER_NAME } from '../providers/prijsvrij/constants';
import { extractPrijsvrijProductId } from '../providers/prijsvrij/product-id';
import { SUNWEB_PROVIDER_NAME } from '../providers/sunweb/constants';
import { extractSunwebAccommodationId } from '../providers/sunweb/offer-context';
import { type CanonicalBoardType } from './canonicalize-board-type';

export type DetailProviderSlug = 'prijsvrij' | 'corendon' | 'sunweb' | 'eliza';

export type CanonicalIdentitySuccess = {
  ok: true;
  identity: string;
  providerSlug: DetailProviderSlug;
};

export type CanonicalIdentityFailure = {
  ok: false;
  externalId: string;
  provider: string;
  reason: string;
};

export type CanonicalIdentityResult = CanonicalIdentitySuccess | CanonicalIdentityFailure;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const SUNWEB_BOARD_SLUG: Record<CanonicalBoardType, string> = {
  Logies: 'logies',
  'Logies & ontbijt': 'logies-ontbijt',
  Halfpension: 'halfpension',
  'Halfpension Plus': 'halfpension-plus',
  Volpension: 'volpension',
  'Volpension Plus': 'volpension-plus',
  'All Inclusive': 'all-inclusive',
  'Ultra All Inclusive': 'ultra-all-inclusive',
};

const PRIJSVRIJ_LABEL_TO_CODE: Record<string, string> = {
  logies: 'LG',
  lg: 'LG',
  'logies en ontbijt': 'LO',
  'logies & ontbijt': 'LO',
  lo: 'LO',
  'half pension': 'HP',
  halfpension: 'HP',
  hp: 'HP',
  'vol pension': 'VP',
  volpension: 'VP',
  vp: 'VP',
  'all inclusive': 'AI',
  allinclusive: 'AI',
  ai: 'AI',
  'ultra all inclusive': 'UA',
  ultraallinclusive: 'UA',
  ua: 'UA',
};

function fail(offer: StoredOffer, reason: string): CanonicalIdentityFailure {
  return {
    ok: false,
    externalId: offer.externalId,
    provider: offer.provider,
    reason,
  };
}

function nfcField(value: string): string {
  return value.normalize('NFC').trim().replace(/\|/g, '%7C');
}

function joinIdentity(parts: string[]): string {
  return parts.map(nfcField).join('|');
}

function integerDuration(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  const rounded = Math.round(n);
  if (Math.abs(n - rounded) > 1e-9) {
    return null;
  }
  return String(rounded);
}

export function detailProviderSlug(provider: string): DetailProviderSlug | null {
  if (provider === PRIJSVRIJ_PROVIDER_NAME) {
    return 'prijsvrij';
  }
  if (provider === CORENDON_PROVIDER_NAME) {
    return 'corendon';
  }
  if (provider === SUNWEB_PROVIDER_NAME) {
    return 'sunweb';
  }
  if (provider === ELIZA_PROVIDER_NAME) {
    return 'eliza';
  }
  return null;
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function detailObjectSha256(canonicalOfferIdentity: string): string {
  return sha256Hex(canonicalOfferIdentity);
}

export function detailObjectKey(
  generationId: string,
  providerSlug: DetailProviderSlug,
  canonicalOfferIdentity: string,
): string {
  return `generations/${generationId}/details/${providerSlug}/${detailObjectSha256(canonicalOfferIdentity)}.json`;
}

function prijsvrijBoardCode(offer: StoredOffer): string | null {
  const fromId =
    /^prijsvrij-\d+-\d{4}-\d{2}-\d{2}-\d+-\d+(?:\.\d+)?-([A-Za-z][A-Za-z0-9]*)$/i.exec(
      offer.externalId.trim(),
    );
  if (fromId?.[1]) {
    return fromId[1].toUpperCase();
  }

  const label = (offer.boardType ?? '').trim();
  if (!label) {
    return null;
  }
  const key = label.toLowerCase().replace(/\s+/g, ' ');
  if (PRIJSVRIJ_LABEL_TO_CODE[key]) {
    return PRIJSVRIJ_LABEL_TO_CODE[key];
  }
  const compact = key.replace(/[^a-z0-9]+/g, '');
  if (PRIJSVRIJ_LABEL_TO_CODE[compact]) {
    return PRIJSVRIJ_LABEL_TO_CODE[compact];
  }
  return label.toUpperCase();
}

function prijsvrijParts(offer: StoredOffer): {
  productId: string | null;
  departureDate: string | null;
  duration: string | null;
  boardTypeCode: string | null;
} {
  const parsed =
    /^prijsvrij-(\d+)-(\d{4}-\d{2}-\d{2})-(\d+)-\d+(?:\.\d+)?-([A-Za-z][A-Za-z0-9]*)$/i.exec(
      offer.externalId.trim(),
    );
  if (parsed) {
    return {
      productId: parsed[1],
      departureDate: parsed[2],
      duration: integerDuration(parsed[3]),
      boardTypeCode: parsed[4].toUpperCase(),
    };
  }
  return {
    productId: extractPrijsvrijProductId(offer.externalId),
    departureDate: ISO_DATE.test(offer.departureDate ?? '') ? offer.departureDate!.trim() : null,
    duration: integerDuration(offer.nights),
    boardTypeCode: prijsvrijBoardCode(offer),
  };
}

function sunwebOpaqueAccoId(externalId: string): string | null {
  const numeric = extractSunwebAccommodationId(externalId);
  if (numeric) {
    return numeric;
  }
  const hash = /^sunweb-([0-9a-f]+)(?:-|$)/i.exec(externalId.trim());
  return hash ? hash[1].toLowerCase() : null;
}

function prijsvrijIdentity(offer: StoredOffer): CanonicalIdentityResult {
  const parts = prijsvrijParts(offer);
  if (!parts.productId) {
    return fail(offer, 'Prijsvrij productId missing');
  }
  if (!parts.departureDate || !ISO_DATE.test(parts.departureDate)) {
    return fail(offer, 'Prijsvrij departureDate missing or not YYYY-MM-DD');
  }
  if (!parts.duration) {
    return fail(offer, 'Prijsvrij duration missing');
  }
  if (!parts.boardTypeCode) {
    return fail(offer, 'Prijsvrij boardTypeCode missing');
  }
  return {
    ok: true,
    providerSlug: 'prijsvrij',
    identity: joinIdentity([
      'prijsvrij',
      parts.productId,
      parts.departureDate,
      parts.duration,
      parts.boardTypeCode,
    ]),
  };
}

function corendonIdentity(offer: StoredOffer): CanonicalIdentityResult {
  const hotelId = extractCorendonAccommodationId(offer.externalId);
  if (!hotelId) {
    return fail(offer, 'Corendon hotelId missing');
  }
  const fragment = parseCorendonMergeFragment(offer.deepLink);
  const accommodationCode = (fragment?.accommodationCode ?? '').trim().toLowerCase();
  const airportRoute = (fragment?.airportRoute ?? '').trim().toLowerCase();
  const dateYymmdd = (fragment?.dateYymmdd ?? '').trim().toLowerCase();
  const durationNights = (fragment?.durationNights ?? '').trim().toLowerCase();
  const roomBoard = (fragment?.roomBoard ?? '').trim().toLowerCase();
  return {
    ok: true,
    providerSlug: 'corendon',
    identity: joinIdentity([
      'corendon',
      hotelId,
      accommodationCode,
      airportRoute,
      dateYymmdd,
      durationNights,
      roomBoard,
    ]),
  };
}

function sunwebIdentity(offer: StoredOffer): CanonicalIdentityResult {
  const context = resolveSunwebBookableContext(offer);
  const trip = context ?? resolveSunwebTripFields(offer);
  const accoId = context?.accoId ?? sunwebOpaqueAccoId(offer.externalId);
  if (!accoId) {
    return fail(offer, 'Sunweb accoId missing');
  }
  if (!trip) {
    return fail(offer, 'Sunweb canonical board missing');
  }
  const boardSlug = SUNWEB_BOARD_SLUG[trip.board];
  if (!boardSlug) {
    return fail(offer, `Sunweb board slug missing for ${trip.board}`);
  }
  return {
    ok: true,
    providerSlug: 'sunweb',
    identity: joinIdentity([
      'sunweb',
      accoId,
      trip.departureDate,
      trip.duration,
      trip.departureAirport,
      boardSlug,
    ]),
  };
}

function elizaIdentity(offer: StoredOffer): CanonicalIdentityResult {
  const productId = extractElizaAccommodationId(offer.externalId);
  if (!productId) {
    return fail(offer, 'Eliza productId missing');
  }
  return {
    ok: true,
    providerSlug: 'eliza',
    identity: joinIdentity(['eliza', productId]),
  };
}

export function buildCanonicalOfferIdentity(offer: StoredOffer): CanonicalIdentityResult {
  const slug = detailProviderSlug(offer.provider);
  if (!slug) {
    return fail(offer, `Unsupported provider for canonical identity: ${offer.provider}`);
  }
  if (slug === 'prijsvrij') {
    return prijsvrijIdentity(offer);
  }
  if (slug === 'corendon') {
    return corendonIdentity(offer);
  }
  if (slug === 'sunweb') {
    return sunwebIdentity(offer);
  }
  return elizaIdentity(offer);
}

export type CanonicalIdentityAssignment = {
  offers: StoredOffer[];
  collisions: Array<{ identity: string; externalIds: string[] }>;
  failures: CanonicalIdentityFailure[];
};

export function assignCanonicalOfferIdentities(offers: StoredOffer[]): CanonicalIdentityAssignment {
  const failures: CanonicalIdentityFailure[] = [];
  const byIdentity = new Map<string, string[]>();
  const next: StoredOffer[] = [];

  for (const offer of offers) {
    const result = buildCanonicalOfferIdentity(offer);
    if (!result.ok) {
      failures.push(result);
      next.push(offer);
      continue;
    }
    const ids = byIdentity.get(result.identity) ?? [];
    ids.push(offer.externalId);
    byIdentity.set(result.identity, ids);
    next.push({ ...offer, canonicalOfferIdentity: result.identity });
  }

  const collisions: Array<{ identity: string; externalIds: string[] }> = [];
  for (const [identity, externalIds] of byIdentity) {
    if (externalIds.length > 1) {
      collisions.push({ identity, externalIds });
    }
  }

  return { offers: next, collisions, failures };
}

export function assertCanonicalIdentitiesAssignable(offers: StoredOffer[]): StoredOffer[] {
  const assigned = assignCanonicalOfferIdentities(offers);
  if (assigned.failures.length > 0) {
    const sample = assigned.failures
      .slice(0, 20)
      .map((item) => `${item.externalId}: ${item.reason}`)
      .join('; ');
    throw new Error(
      `Canonical identity construction failed for ${assigned.failures.length} offer(s). ${sample}`,
    );
  }
  if (assigned.collisions.length > 0) {
    const sample = assigned.collisions
      .slice(0, 10)
      .map((item) => `${item.identity} <= ${item.externalIds.join(', ')}`)
      .join(' | ');
    throw new Error(
      `Duplicate canonicalOfferIdentity detected (${assigned.collisions.length} group(s)). STOP. ${sample}`,
    );
  }
  return assigned.offers;
}
