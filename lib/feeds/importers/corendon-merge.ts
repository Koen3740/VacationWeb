import {
  extractCorendonAccommodationId,
  parseCorendonUrlFragment,
} from '../../providers/corendon/offer-context';
import { buildExternalId } from '../providers';
import { StoredOffer } from '../types/stored-offer';

export const CORENDON_BE_CAMPAIGN_ID = '38103';
export const CORENDON_NL_CAMPAIGN_ID = '38108';

/**
 * Bookable Corendon identity from the live-price URL fragment.
 * Excludes product ID and FE host: same trip can appear in BE and NL.
 */
export function buildCorendonBookableKey(deepLink: string | undefined): string | null {
  if (!deepLink) {
    return null;
  }
  const fragment = parseCorendonUrlFragment(deepLink);
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

function sanitizeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, '');
}

/** Unique catalog id that still starts with corendon-{numericHotelId} for live pricing. */
export function assignCorendonCanonicalExternalId(offer: StoredOffer): string {
  const productId =
    extractCorendonAccommodationId(offer.externalId) ??
    offer.externalId.replace(/^corendon-/i, '');
  const fragment = offer.deepLink ? parseCorendonUrlFragment(offer.deepLink) : null;
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

export type CorendonMergeStats = {
  input: number;
  unique: number;
  duplicatesDropped: number;
  keptWithoutBookableKey: number;
  beCampaignKept: number;
  nlCampaignKept: number;
};

/**
 * First-wins merge of Corendon StoredOffers.
 * Same bookable key → one offer (keep first; BE should be imported first).
 * Missing fragment → keep; never invent a duplicate match.
 */
export function mergeCorendonOffers(offers: StoredOffer[]): {
  offers: StoredOffer[];
  stats: CorendonMergeStats;
} {
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  const merged: StoredOffer[] = [];
  let duplicatesDropped = 0;
  let keptWithoutBookableKey = 0;
  let input = 0;

  for (const offer of offers) {
    if (offer.provider !== 'Corendon') {
      continue;
    }
    input += 1;

    const key = buildCorendonBookableKey(offer.deepLink);
    if (key) {
      if (seenKeys.has(key)) {
        duplicatesDropped += 1;
        continue;
      }
      seenKeys.add(key);
    } else {
      keptWithoutBookableKey += 1;
    }

    let next: StoredOffer = {
      ...offer,
      externalId: assignCorendonCanonicalExternalId(offer),
    };
    if (seenIds.has(next.externalId)) {
      next = {
        ...next,
        externalId: buildExternalId('corendon', next.externalId.replace(/^corendon-/i, ''), [
          next.affiliateCampaignId ?? 'feed',
        ]),
      };
    }
    seenIds.add(next.externalId);
    merged.push(next);
  }

  return {
    offers: merged,
    stats: {
      input,
      unique: merged.length,
      duplicatesDropped,
      keptWithoutBookableKey,
      beCampaignKept: merged.filter((offer) => offer.affiliateCampaignId === CORENDON_BE_CAMPAIGN_ID)
        .length,
      nlCampaignKept: merged.filter((offer) => offer.affiliateCampaignId === CORENDON_NL_CAMPAIGN_ID)
        .length,
    },
  };
}
