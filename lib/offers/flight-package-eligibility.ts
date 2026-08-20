import { parseCorendonMergeFragment } from '../feeds/importers/corendon-merge';
import { CORENDON_PROVIDER_NAME } from '../providers/corendon/constants';
import { departureIataFromAirportRoute } from '../providers/corendon/listing-selection';
import { parseCorendonUrlFragment } from '../providers/corendon/offer-context';
import { ELIZA_PROVIDER_NAME } from '../providers/eliza/constants';
import { unwrapElizaProductUrl } from '../providers/eliza/offer-context';
import { PRIJSVRIJ_PROVIDER_NAME } from '../providers/prijsvrij/constants';
import { derivePrijsvrijTransport } from '../providers/prijsvrij/offer-context';
import { SUNWEB_PROVIDER_NAME } from '../providers/sunweb/constants';
import { unwrapSunwebProductUrl } from '../providers/sunweb/offer-context';
import { canonicalizeDepartureAirportCode } from '../search/departure-airports';
import type { TravelOffer } from '../feeds/canonical/travel-offer';

/**
 * VacationWeb MVP eligibility: only proven accommodation+flight packages.
 * SelfDrive, hotel-only, and Flight records without a usable IATA stay out of
 * the product catalog and Results. Missing airport is not itself a product.
 */

export type FlightPackageOfferInput = {
  provider: string;
  flightIncluded?: string | boolean;
  deepLink?: string;
  departureAirport?: string;
  departureAirportCode?: string;
  airport?: string;
};

export type FlightPackageEligibilityStats = {
  input: number;
  kept: number;
  excluded: number;
  byProviderBefore: Record<string, number>;
  byProviderAfter: Record<string, number>;
};

const SELFDRIVE_TOKEN = 'selfdrive';
const ABSENT_AIRPORT_SENTINELS = new Set(['none', 'null', 'n/a', '-']);

function flightIncludedText(value: string | boolean | undefined): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function normalizeTransportToken(raw: string | undefined): string {
  return (raw ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function isSelfDriveTransport(raw: string | undefined): boolean {
  return normalizeTransportToken(raw) === SELFDRIVE_TOKEN;
}

function isExplicitNonFlightFlag(flightIncluded: string): boolean {
  const value = flightIncluded.toLowerCase();
  return value === 'false' || value === '0' || value === 'nee' || value === 'no';
}

function unwrapLandingUrl(deepLink: string | undefined, provider: string): URL | null {
  if (!deepLink?.trim()) {
    return null;
  }
  const raw =
    provider === ELIZA_PROVIDER_NAME
      ? unwrapElizaProductUrl(deepLink)
      : unwrapSunwebProductUrl(deepLink);
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function readLandingParam(url: URL, indexed: string, plain: string): string {
  return (url.searchParams.get(indexed) || url.searchParams.get(plain) || '').trim();
}

function usableIata(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed || ABSENT_AIRPORT_SENTINELS.has(trimmed.toLowerCase())) {
    return undefined;
  }
  return canonicalizeDepartureAirportCode(trimmed);
}

function catalogIata(offer: FlightPackageOfferInput): string | undefined {
  return (
    usableIata(offer.departureAirport) ??
    usableIata(offer.departureAirportCode) ??
    usableIata(offer.airport)
  );
}

function isSunwebOrElizaFlightPackage(offer: FlightPackageOfferInput): boolean {
  const flightIncluded = flightIncludedText(offer.flightIncluded);
  if (isExplicitNonFlightFlag(flightIncluded) || isSelfDriveTransport(flightIncluded)) {
    return false;
  }

  const landing = unwrapLandingUrl(offer.deepLink, offer.provider);
  const landingTransport = landing
    ? readLandingParam(landing, 'TransportType[0]', 'TransportType')
    : '';
  if (isSelfDriveTransport(landingTransport)) {
    return false;
  }

  const isLandingFlight = landingTransport.toLowerCase() === 'flight';
  const isFeedFlight = flightIncluded.toLowerCase() === 'true' || flightIncluded.toLowerCase() === 'flight';
  if (landingTransport && !isLandingFlight) {
    return false;
  }
  if (!isLandingFlight && !isFeedFlight) {
    return false;
  }

  const landingAirport = landing
    ? usableIata(readLandingParam(landing, 'DepartureAirport[0]', 'DepartureAirport'))
    : undefined;
  const iata = landingAirport ?? catalogIata(offer);
  return Boolean(iata);
}

function isCorendonFlightPackage(offer: FlightPackageOfferInput): boolean {
  const flightIncluded = flightIncludedText(offer.flightIncluded);
  if (isExplicitNonFlightFlag(flightIncluded) || isSelfDriveTransport(flightIncluded)) {
    return false;
  }

  const merge = parseCorendonMergeFragment(offer.deepLink);
  if (merge && !merge.airportRoute.trim()) {
    return false;
  }

  const live = offer.deepLink ? parseCorendonUrlFragment(offer.deepLink) : null;
  const airportRoute = live?.airportRoute || merge?.airportRoute || '';
  if (!airportRoute.trim()) {
    return false;
  }

  const iata = departureIataFromAirportRoute(airportRoute) ?? catalogIata(offer);
  return Boolean(iata);
}

function isPrijsvrijFlightPackage(offer: FlightPackageOfferInput): boolean {
  const flightIncluded = flightIncludedText(offer.flightIncluded);
  if (isExplicitNonFlightFlag(flightIncluded) || isSelfDriveTransport(flightIncluded)) {
    return false;
  }

  const stub: TravelOffer = {
    id: '',
    provider: PRIJSVRIJ_PROVIDER_NAME,
    hotelName: '',
    destinationCountry: '',
    nights: 0,
    price: 0,
    pricePerDay: 0,
    imageUrl: '',
    deepLink: offer.deepLink ?? '',
    flightIncluded: flightIncluded || undefined,
  };
  return derivePrijsvrijTransport(stub) === 'VL';
}

/**
 * True when the offer is a proven VacationWeb flight package.
 * Fail-closed: unknown provider, unknown transport, or Flight without IATA.
 */
export function isVacationWebFlightPackage(offer: FlightPackageOfferInput): boolean {
  const provider = offer.provider?.trim();
  if (!provider) {
    return false;
  }

  if (provider === SUNWEB_PROVIDER_NAME || provider === ELIZA_PROVIDER_NAME) {
    return isSunwebOrElizaFlightPackage(offer);
  }
  if (provider === CORENDON_PROVIDER_NAME) {
    return isCorendonFlightPackage(offer);
  }
  if (provider === PRIJSVRIJ_PROVIDER_NAME) {
    return isPrijsvrijFlightPackage(offer);
  }
  return false;
}

export function selectVacationWebFlightPackages<T extends FlightPackageOfferInput>(offers: T[]): T[] {
  return offers.filter((offer) => isVacationWebFlightPackage(offer));
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export function summarizeFlightPackageEligibility(
  offers: readonly FlightPackageOfferInput[],
): FlightPackageEligibilityStats {
  const byProviderBefore: Record<string, number> = {};
  const byProviderAfter: Record<string, number> = {};
  let kept = 0;

  for (const offer of offers) {
    const provider = offer.provider?.trim() || '(unknown)';
    increment(byProviderBefore, provider);
    if (isVacationWebFlightPackage(offer)) {
      kept += 1;
      increment(byProviderAfter, provider);
    }
  }

  return {
    input: offers.length,
    kept,
    excluded: offers.length - kept,
    byProviderBefore,
    byProviderAfter,
  };
}
