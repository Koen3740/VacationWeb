import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import type { SearchParams } from '../../../types/travel';
import {
  ELIZA_ALLOWED_FE_HOSTS,
  ELIZA_PROVIDER_NAME,
  type ElizaFeHost,
} from './constants';

export type ElizaLandingQuery = {
  accoId: string;
  departureDate: string;
  departureAirport: string;
  duration: string;
  mealplan: string;
  transportType: string;
  month: string;
  participants: Array<{ key: string; value: string }>;
};

export type ElizaLiveContext = {
  accoId: string;
  landingUrl: string;
  feHost: ElizaFeHost;
  query: ElizaLandingQuery;
};

const PARTICIPANT_KEY = /^Participants\[(\d+)\]\[(\d+)\]$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const IATA = /^[A-Z]{3}$/;

export function isEliza(offer: Pick<TravelOffer, 'provider'>): boolean {
  return offer.provider === ELIZA_PROVIDER_NAME;
}

/** Feed externalId: eliza-{accoId} */
export function extractElizaAccommodationId(offerId: string): string | null {
  const match = /^eliza-(\d+)(?:-|$)/i.exec(offerId.trim());
  return match?.[1] ?? null;
}

export function unwrapElizaProductUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const nested = url.searchParams.get('r') || url.searchParams.get('u');
    if (nested) {
      return decodeURIComponent(nested);
    }
    return raw;
  } catch {
    return raw;
  }
}

export function resolveElizaFeHost(productUrl: string): ElizaFeHost | null {
  try {
    const host = new URL(unwrapElizaProductUrl(productUrl)).hostname.toLowerCase();
    return (ELIZA_ALLOWED_FE_HOSTS as readonly string[]).includes(host)
      ? (host as ElizaFeHost)
      : null;
  } catch {
    return null;
  }
}

/**
 * Default 2A / 0C / 0B / 1 room only — same occupancy gate as Package 1.
 * Child/baby/multi-room encodings are proven on Eliza, but VW search params
 * do not carry ages; inventing birthdates is not allowed.
 */
export function resolveElizaLiveOccupancy(
  params: Pick<SearchParams, 'adults' | 'children' | 'babies' | 'rooms'>,
): { ok: true } | { ok: false; reason: 'invalid_occupancy' } {
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

  return { ok: true };
}

function readParam(url: URL, indexed: string, plain: string): string {
  return (url.searchParams.get(indexed) || url.searchParams.get(plain) || '').trim();
}

function parseParticipants(url: URL): Array<{ key: string; value: string }> {
  const found: Array<{ room: number; person: number; key: string; value: string }> = [];
  for (const [key, value] of url.searchParams.entries()) {
    const match = PARTICIPANT_KEY.exec(key);
    if (!match || !ISO_DATE.test(value)) {
      continue;
    }
    found.push({
      room: Number(match[1]),
      person: Number(match[2]),
      key,
      value,
    });
  }
  found.sort((a, b) => a.room - b.room || a.person - b.person);
  return found.map(({ key, value }) => ({ key, value }));
}

/**
 * Canonical live context is the productURL / landing query (Bijbel §3 / §5).
 * Feed property airport is not used.
 */
export function parseElizaLandingQuery(
  productUrl: string,
  accoId: string,
): ElizaLandingQuery | null {
  if (!accoId || !/^\d+$/.test(accoId)) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(unwrapElizaProductUrl(productUrl));
  } catch {
    return null;
  }

  const departureDate = readParam(url, 'DepartureDate[0]', 'DepartureDate');
  const departureAirport = readParam(url, 'DepartureAirport[0]', 'DepartureAirport').toUpperCase();
  const duration = readParam(url, 'Duration[0]', 'Duration');
  const mealplan = readParam(url, 'Mealplan[0]', 'Mealplan');
  const transportType = readParam(url, 'TransportType[0]', 'TransportType');
  const participants = parseParticipants(url);

  if (!ISO_DATE.test(departureDate) || !IATA.test(departureAirport)) {
    return null;
  }
  if (!/^\d+$/.test(duration) || Number(duration) <= 0) {
    return null;
  }
  if (!mealplan || transportType !== 'Flight') {
    return null;
  }
  // Package-1 default occupancy on the URL: 2 adults in room 0.
  if (
    participants.length !== 2 ||
    participants[0].key !== 'Participants[0][0]' ||
    participants[1].key !== 'Participants[0][1]'
  ) {
    return null;
  }

  return {
    accoId,
    departureDate,
    departureAirport,
    duration,
    mealplan,
    transportType,
    month: departureDate.slice(0, 7),
    participants,
  };
}

export function buildElizaLiveContext(
  offer: TravelOffer,
  params: SearchParams,
): ElizaLiveContext | null {
  if (!isEliza(offer)) {
    return null;
  }
  if (!resolveElizaLiveOccupancy(params).ok) {
    return null;
  }

  const accoId = extractElizaAccommodationId(offer.id);
  const feHost = offer.deepLink ? resolveElizaFeHost(offer.deepLink) : null;
  if (!accoId || !feHost || !offer.deepLink) {
    return null;
  }

  const query = parseElizaLandingQuery(offer.deepLink, accoId);
  if (!query) {
    return null;
  }

  return {
    accoId,
    landingUrl: unwrapElizaProductUrl(offer.deepLink),
    feHost,
    query,
  };
}
