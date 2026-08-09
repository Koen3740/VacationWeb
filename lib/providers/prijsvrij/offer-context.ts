import type { TravelOffer } from '../../feeds/canonical/travel-offer';

const TRANSPORT_CODES = new Set(['VL', 'HO', 'FL']);

function decodeAffiliateTarget(deepLink: string): URL | null {
  try {
    const url = new URL(deepLink);
    const nested = url.searchParams.get('r');
    if (nested) {
      return new URL(decodeURIComponent(nested));
    }
    if (url.hostname.includes('prijsvrij.')) {
      return url;
    }
  } catch {
    return null;
  }
  return null;
}

export function derivePrijsvrijTransport(offer: TravelOffer): string | null {
  const target = decodeAffiliateTarget(offer.deepLink);
  const fromQuery = target?.searchParams.get('transport')?.trim().toUpperCase();
  if (fromQuery && TRANSPORT_CODES.has(fromQuery)) {
    return fromQuery;
  }

  const flight = offer.flightIncluded?.trim();
  if (!flight) {
    return null;
  }

  const upper = flight.toUpperCase();
  if (TRANSPORT_CODES.has(upper)) {
    return upper;
  }

  if (flight.toLowerCase() === 'true') {
    return 'VL';
  }

  return null;
}

export function derivePrijsvrijSlugs(offer: TravelOffer): {
  countrySlug?: string;
  regionSlug?: string;
} {
  const target = decodeAffiliateTarget(offer.deepLink);
  if (!target) {
    return {};
  }

  const parts = target.pathname.split('/').filter(Boolean);
  // /vakanties/{country}/{region}/...
  if (parts[0] !== 'vakanties') {
    return {};
  }

  return {
    countrySlug: parts[1],
    regionSlug: parts[2],
  };
}

export type PrijsvrijOfferContextKey = string;

export function buildPrijsvrijOfferContextKey(input: {
  departureDate: string;
  nights: number;
  transport: string;
  country: string;
  region: string;
}): PrijsvrijOfferContextKey {
  return [
    input.departureDate,
    String(input.nights),
    input.transport,
    input.country.trim().toLowerCase(),
    input.region.trim().toLowerCase(),
  ].join('|');
}

export function getPrijsvrijOfferSearchContext(offer: TravelOffer): {
  departureDate: string;
  nights: number;
  transport: string;
  country: string;
  region: string;
  countrySlug?: string;
  regionSlug?: string;
} | null {
  const departureDate = offer.departureDate?.trim();
  const nights = offer.nights;
  const transport = derivePrijsvrijTransport(offer);
  const country = offer.destinationCountry?.trim();
  const region = offer.destinationRegion?.trim();

  if (!departureDate || !nights || nights <= 0 || !transport || !country || !region) {
    return null;
  }

  const slugs = derivePrijsvrijSlugs(offer);
  return {
    departureDate,
    nights,
    transport,
    country,
    region,
    countrySlug: slugs.countrySlug,
    regionSlug: slugs.regionSlug,
  };
}
