/**
 * Pre-HTTP live-price context gate (AN-061 P0.1).
 * Uses the same build*LiveContext builders as the HTTP path — no invented fields.
 * Offers that fail this gate must not consume live window / workset slots.
 */

import type { SearchParams, TravelOffer } from '@/types/travel';
import {
  buildCorendonLiveContext,
  isCorendon,
  rankCorendonListings,
  resolveCorendonLiveOccupancy,
} from '@/lib/providers/corendon';
import {
  buildElizaLiveContext,
  isEliza,
  resolveElizaLiveOccupancy,
} from '@/lib/providers/eliza';
import {
  buildSunwebLiveContext,
  extractSunwebAccommodationId,
  isSunweb,
  parseSunwebLandingQuery,
  requiresSunwebResultsLivePrice,
  resolveSunwebLiveOccupancy,
  withSunwebResultsLiveParams,
} from '@/lib/providers/sunweb';
import {
  buildPrijsvrijReceiptContext,
  resolvePrijsvrijReceiptOccupancy,
} from '@/lib/providers/prijsvrij/receipt-context';
import { PRIJSVRIJ_PROVIDER_NAME } from '@/lib/providers/prijsvrij/constants';

/**
 * True when this offer is a live-pricing provider for the current search
 * (same family as offerNeedsLivePriceWork, without cache checks).
 */
export function isLivePriceProviderOffer(offer: TravelOffer, params: SearchParams): boolean {
  if (offer.provider === PRIJSVRIJ_PROVIDER_NAME) {
    return true;
  }
  if (isCorendon(offer) || isEliza(offer)) {
    return true;
  }
  if (isSunweb(offer)) {
    return requiresSunwebResultsLivePrice(params);
  }
  return false;
}

/**
 * True when the provider-specific live-price request context can be built
 * without inventing fields. Matches run*LiveIntoCache pre-HTTP builders.
 */
export function canAttemptLivePrice(offer: TravelOffer, params: SearchParams): boolean {
  if (!isLivePriceProviderOffer(offer, params)) {
    return false;
  }

  if (isCorendon(offer)) {
    if (!resolveCorendonLiveOccupancy(params).ok) {
      return false;
    }
    const listings = rankCorendonListings(offer, params);
    if (listings.length === 0) {
      return false;
    }
    return listings.some((listing) => buildCorendonLiveContext(offer, params, listing) != null);
  }

  if (isEliza(offer)) {
    if (!resolveElizaLiveOccupancy(params).ok) {
      return false;
    }
    return buildElizaLiveContext(offer, params) != null;
  }

  if (isSunweb(offer)) {
    // GO4: Results path — default adult DOBs when missing so 2A is attemptable.
    let offerDeparture: string | null =
      typeof offer.departureDate === 'string' ? offer.departureDate : null;
    if (!offerDeparture && offer.deepLink) {
      const accoId = extractSunwebAccommodationId(offer.id);
      if (accoId) {
        offerDeparture = parseSunwebLandingQuery(offer.deepLink, accoId)?.departureDate ?? null;
      }
    }
    const liveParams = withSunwebResultsLiveParams(params, offerDeparture);
    if (!resolveSunwebLiveOccupancy(liveParams).ok) {
      return false;
    }
    return buildSunwebLiveContext(offer, liveParams) != null;
  }

  if (offer.provider === PRIJSVRIJ_PROVIDER_NAME) {
    if (!resolvePrijsvrijReceiptOccupancy(params).ok) {
      return false;
    }
    return buildPrijsvrijReceiptContext(offer, params) != null;
  }

  return false;
}
