import type { ProviderListing } from '../../feeds/types/stored-offer';
import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import type { SearchParams } from '../../../types/travel';
import { parseDepartureAirportsParam } from '../../search/departure-airports';
import { mapCorendonAirportRouteInbound } from '../../search/provider-airport-mapping';
import {
  CORENDON_FE_HOST,
  CORENDON_FE_HOST_BE_FR,
  CORENDON_FE_HOST_NL,
  CORENDON_PROVIDER_NAME,
} from './constants';
import {
  parseCorendonUrlFragment,
  resolveCorendonFeHost,
} from './offer-context';

export const CORENDON_FEED_BENL = 'corendon-benl';
export const CORENDON_FEED_BEFR = 'corendon-befr';
export const CORENDON_FEED_NL = 'corendon-nl';

const BE_DEPARTURE_IATA = new Set(['BRU', 'CRL', 'LGG', 'OST', 'ANR']);
const NL_DEPARTURE_IATA = new Set(['AMS', 'EIN', 'RTM', 'GRQ', 'MST']);

/**
 * Tie-break inside the same country. Not an inventory lock.
 * BE-NL before BE-FR because language must not choose click-out host.
 */
const HOST_TIE_RANK: Record<string, number> = {
  [CORENDON_FE_HOST]: 0,
  [CORENDON_FE_HOST_NL]: 0,
  [CORENDON_FE_HOST_BE_FR]: 1,
};

export function corendonListingCacheKey(listing: Pick<ProviderListing, 'host' | 'feedId'>): string {
  return `${listing.host.trim().toLowerCase()}|${listing.feedId.trim().toLowerCase()}`;
}

export function feedIdForCorendonHost(host: string): string {
  const normalized = host.trim().toLowerCase();
  if (normalized === CORENDON_FE_HOST_NL) {
    return CORENDON_FEED_NL;
  }
  if (normalized === CORENDON_FE_HOST_BE_FR) {
    return CORENDON_FEED_BEFR;
  }
  return CORENDON_FEED_BENL;
}

export function departureIataFromAirportRoute(airportRoute: string | undefined): string | undefined {
  const mapped = mapCorendonAirportRouteInbound(airportRoute);
  if (mapped.status === 'MAPPED' || mapped.status === 'CANONICAL_AIRPORT_MISSING') {
    return mapped.canonicalIata;
  }
  return undefined;
}

export function listingFromCorendonOffer(offer: TravelOffer): ProviderListing | null {
  if (!offer.deepLink?.trim()) {
    return null;
  }
  const host = offer.listingHost ?? resolveCorendonFeHost(offer.deepLink) ?? CORENDON_FE_HOST;
  return {
    provider: CORENDON_PROVIDER_NAME,
    feedId: offer.feedSourceId ?? feedIdForCorendonHost(host),
    campaignId: offer.affiliateCampaignId,
    host,
    deepLink: offer.deepLink,
  };
}

export function corendonListingsFromOffer(offer: TravelOffer): ProviderListing[] {
  if (offer.provider !== CORENDON_PROVIDER_NAME) {
    return [];
  }
  if (offer.providerListings && offer.providerListings.length > 0) {
    return offer.providerListings.filter((listing) => listing.deepLink?.trim() && listing.host?.trim());
  }
  const synthesized = listingFromCorendonOffer(offer);
  return synthesized ? [synthesized] : [];
}

function listingDepartureIata(listing: ProviderListing): string | undefined {
  return departureIataFromAirportRoute(parseCorendonUrlFragment(listing.deepLink)?.airportRoute);
}

function airportCountryRank(iata: string | undefined, host: string): number {
  const normalizedHost = host.toLowerCase();
  const isBeHost = normalizedHost === CORENDON_FE_HOST || normalizedHost === CORENDON_FE_HOST_BE_FR;
  const isNlHost = normalizedHost === CORENDON_FE_HOST_NL;
  if (iata && BE_DEPARTURE_IATA.has(iata)) {
    return isBeHost ? 0 : 1;
  }
  if (iata && NL_DEPARTURE_IATA.has(iata)) {
    return isNlHost ? 0 : 1;
  }
  return 1;
}

function siteMarketRank(siteMarket: SearchParams['siteMarket'], host: string): number {
  const normalizedHost = host.toLowerCase();
  const isBeHost = normalizedHost === CORENDON_FE_HOST || normalizedHost === CORENDON_FE_HOST_BE_FR;
  const isNlHost = normalizedHost === CORENDON_FE_HOST_NL;
  if (siteMarket === 'nl') {
    return isNlHost ? 0 : 1;
  }
  if (siteMarket === 'be') {
    return isBeHost ? 0 : 1;
  }
  return isBeHost ? 0 : 1;
}

function selectedAirportMatchRank(selectedAirports: string[], listingIata: string | undefined): number {
  if (selectedAirports.length === 0) {
    return 0;
  }
  if (listingIata && selectedAirports.includes(listingIata)) {
    return 0;
  }
  return 1;
}

/**
 * Deterministic Corendon listing order for live price + click-out.
 *
 * 1. Listing whose fragment departure IATA matches the user airport filter (when set).
 * 2. Listing whose host country matches the trip's departure airport
 *    (BE airports → .be / fr.corendon.be; NL airports → .nl).
 *    Belgian user + AMS therefore prefers NL; Dutch user + BRU prefers BE.
 * 3. Site market (vacationmap.be vs .nl) only when the airport is not BE/NL.
 * 4. Host tie-break: www.corendon.be before fr.corendon.be; then feedId.
 *
 * Never uses catalog/feed price. Language is not a click-out host.
 */
export function rankCorendonListings(offer: TravelOffer, params: SearchParams = {}): ProviderListing[] {
  const listings = corendonListingsFromOffer(offer);
  if (listings.length <= 1) {
    return listings;
  }

  const selectedAirports = parseDepartureAirportsParam(params.departureAirport).map((code) => code.toUpperCase());

  return [...listings].sort((a, b) => {
    const iataA = listingDepartureIata(a);
    const iataB = listingDepartureIata(b);
    const airportMatch =
      selectedAirportMatchRank(selectedAirports, iataA) - selectedAirportMatchRank(selectedAirports, iataB);
    if (airportMatch !== 0) {
      return airportMatch;
    }

    const country =
      airportCountryRank(iataA ?? iataB, a.host) - airportCountryRank(iataA ?? iataB, b.host);
    if (country !== 0) {
      return country;
    }

    const iata = iataA ?? iataB;
    const airportIsBeOrNl = Boolean(iata && (BE_DEPARTURE_IATA.has(iata) || NL_DEPARTURE_IATA.has(iata)));
    if (!airportIsBeOrNl) {
      const market = siteMarketRank(params.siteMarket, a.host) - siteMarketRank(params.siteMarket, b.host);
      if (market !== 0) {
        return market;
      }
    }

    const tie =
      (HOST_TIE_RANK[a.host.toLowerCase()] ?? 50) - (HOST_TIE_RANK[b.host.toLowerCase()] ?? 50);
    if (tie !== 0) {
      return tie;
    }
    return a.feedId.localeCompare(b.feedId);
  });
}

export function selectCorendonListing(offer: TravelOffer, params: SearchParams = {}): ProviderListing | null {
  return rankCorendonListings(offer, params)[0] ?? null;
}

export function bindCorendonListing(
  offer: TravelOffer,
  listing: Pick<ProviderListing, 'deepLink' | 'host' | 'feedId'> & Partial<ProviderListing>,
): TravelOffer {
  return {
    ...offer,
    deepLink: listing.deepLink,
    listingHost: listing.host,
    feedSourceId: listing.feedId,
    affiliateCampaignId: listing.campaignId ?? offer.affiliateCampaignId,
  };
}
