import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import type { SearchParams } from '../../../types/travel';
import { PRIJSVRIJ_PROVIDER_NAME } from './constants';
import { derivePrijsvrijTransport } from './offer-context';
import { extractPrijsvrijProductId } from './product-id';
import {
  buildPrijsvrijReceiptFilters,
  type PrijsvrijReceiptRequestContext,
} from './receipt-client';

/**
 * Proven IATA → Receipt Type-8 values from Bijbel / repository Receipt audits.
 * Do not invent unlisted codes or default airports.
 */
const PROVEN_AIRPORT_MAP: Record<string, string> = {
  BRU: 'BE-BRU',
  'BE-BRU': 'BE-BRU',
  CRL: 'BE-CRL',
  'BE-CRL': 'BE-CRL',
  CGN: 'DE-CGN',
  'DE-CGN': 'DE-CGN',
  AMS: 'NL-AMS',
  'NL-AMS': 'NL-AMS',
  EIN: 'NL-EIN',
  'NL-EIN': 'NL-EIN',
};

export type PrijsvrijOccupancyContext = {
  adults: number;
  children: number;
  babies: number;
  rooms: number;
};

/**
 * Occupancy VW can reproduce without inventing birth dates / ages / room assignments.
 * Default 2A / 0C / 0B / 1 room is the only proven no-cookie Receipt occupancy for Package 1.
 * Non-default pax requires TravelerBirthDates (unavailable in VW) → invalid.
 */
export function resolvePrijsvrijReceiptOccupancy(
  params: Pick<SearchParams, 'adults' | 'children' | 'babies' | 'rooms'>,
): { ok: true; occupancy: PrijsvrijOccupancyContext } | { ok: false; reason: 'invalid_occupancy' } {
  const adults = params.adults ?? 2;
  const children = params.children ?? 0;
  const babies = params.babies ?? 0;
  const rooms = params.rooms ?? 1;

  if (
    !Number.isFinite(adults) ||
    !Number.isFinite(children) ||
    !Number.isFinite(babies) ||
    !Number.isFinite(rooms)
  ) {
    return { ok: false, reason: 'invalid_occupancy' };
  }

  if (adults !== 2 || children !== 0 || babies !== 0 || rooms !== 1) {
    return { ok: false, reason: 'invalid_occupancy' };
  }

  return { ok: true, occupancy: { adults, children, babies, rooms } };
}

export function mapPrijsvrijReceiptAirport(raw: string | undefined | null): string | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  const key = raw.trim().toUpperCase();
  return PROVEN_AIRPORT_MAP[key];
}

function toDepartureYmd(isoDate: string): string | null {
  const trimmed = isoDate.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return null;
  }
  return `${match[1]}${match[2]}${match[3]}`;
}

/** Map Search/deeplink VL → Receipt body FL (proven in Receipt audits). */
export function mapPrijsvrijReceiptTransport(transport: string): string | null {
  const upper = transport.trim().toUpperCase();
  if (upper === 'VL' || upper === 'FL') {
    return 'FL';
  }
  if (upper === 'HO') {
    return 'HO';
  }
  return null;
}

function resolveAirport(
  offer: TravelOffer,
  params: Pick<SearchParams, 'departureAirport'>,
): string | undefined {
  return (
    mapPrijsvrijReceiptAirport(params.departureAirport) ??
    mapPrijsvrijReceiptAirport(offer.departureAirportCode) ??
    mapPrijsvrijReceiptAirport(offer.departureAirport) ??
    mapPrijsvrijReceiptAirport(offer.airport)
  );
}

/**
 * Build Receipt request from VW offer + searchable occupancy.
 * Returns null when required context is missing (no invented fields).
 */
export function buildPrijsvrijReceiptContext(
  offer: TravelOffer,
  params: Pick<SearchParams, 'adults' | 'children' | 'babies' | 'rooms' | 'departureAirport'>,
): PrijsvrijReceiptRequestContext | null {
  if (offer.provider !== PRIJSVRIJ_PROVIDER_NAME) {
    return null;
  }

  const occupancy = resolvePrijsvrijReceiptOccupancy(params);
  if (!occupancy.ok) {
    return null;
  }

  const hotelId = extractPrijsvrijProductId(offer.id);
  if (!hotelId) {
    return null;
  }

  const departureDate = offer.departureDate?.trim();
  if (!departureDate) {
    return null;
  }
  const departureYmd = toDepartureYmd(departureDate);
  if (!departureYmd) {
    return null;
  }

  const durationDays = offer.nights;
  if (!durationDays || durationDays <= 0) {
    return null;
  }

  const rawTransport = derivePrijsvrijTransport(offer);
  if (!rawTransport) {
    return null;
  }
  const transport = mapPrijsvrijReceiptTransport(rawTransport);
  if (!transport) {
    return null;
  }

  const airportCode = resolveAirport(offer, params);

  return {
    hotelId,
    departureYmd,
    durationDays,
    filters: buildPrijsvrijReceiptFilters({
      departureYmd,
      durationDays,
      transport,
      airportCode,
    }),
  };
}
