import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import type { SearchParams } from '../../../types/travel';
import {
  SUNWEB_ALLOWED_FE_HOSTS,
  SUNWEB_PROVIDER_NAME,
  type SunwebFeHost,
} from './constants';

export type SunwebParticipant = { key: string; value: string };

export type SunwebLandingQuery = {
  accoId: string;
  departureDate: string;
  departureAirport: string;
  duration: string;
  mealplan: string;
  transportType: string;
  month: string;
  participants: SunwebParticipant[];
};

export type SunwebLiveContext = {
  accoId: string;
  landingUrl: string;
  feHost: SunwebFeHost;
  query: SunwebLandingQuery;
};

export type SunwebLiveOccupancy =
  | { ok: false; reason: 'invalid_occupancy' }
  | { ok: true; mode: 'feed-two-adults' }
  | { ok: true; mode: 'party'; participants: SunwebParticipant[] };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const IATA = /^[A-Z]{3}$/;

function isIsoDob(value: string | null | undefined): value is string {
  return typeof value === 'string' && ISO_DATE.test(value);
}

export function isSunweb(offer: Pick<TravelOffer, 'provider'>): boolean {
  return offer.provider === SUNWEB_PROVIDER_NAME;
}

/** Feed externalId: sunweb-{accoId}-… */
export function extractSunwebAccommodationId(offerId: string): string | null {
  const match = /^sunweb-(\d+)(?:-|$)/i.exec(offerId.trim());
  return match?.[1] ?? null;
}

export function unwrapSunwebProductUrl(raw: string): string {
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

export function resolveSunwebFeHost(productUrl: string): SunwebFeHost | null {
  try {
    const host = new URL(unwrapSunwebProductUrl(productUrl)).hostname.toLowerCase();
    return (SUNWEB_ALLOWED_FE_HOSTS as readonly string[]).includes(host)
      ? (host as SunwebFeHost)
      : null;
  } catch {
    return null;
  }
}

/**
 * Search shape that is live-required for Sunweb: 4 travellers / 2 rooms.
 * 2A catalog remains rankable; the UI does not present feed € as a live price.
 */
export function isSunwebFourTravellerTwoRoomSearch(
  params: Pick<SearchParams, 'adults' | 'children' | 'babies' | 'rooms' | 'party'>,
): boolean {
  if (params.party && params.party.length === 4) {
    return true;
  }
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
    return false;
  }
  return rooms === 2 && adults + children + babies === 4;
}

function participantsFromSameRoomParty(
  party: Array<{ dateOfBirth: string | null; roomIndex: number }>,
): SunwebParticipant[] | null {
  if (!party.every((traveller) => isIsoDob(traveller.dateOfBirth))) {
    return null;
  }
  const rooms = new Set(party.map((traveller) => traveller.roomIndex));
  if (rooms.size !== 1) {
    return null;
  }
  const roomIndex = party[0]?.roomIndex;
  if (roomIndex !== 0 && roomIndex !== 1) {
    return null;
  }
  return party.map((traveller, personIndex) => ({
    key: `Participants[${roomIndex}][${personIndex}]`,
    value: traveller.dateOfBirth as string,
  }));
}

/**
 * Proven live occupancies (Bijbel §6 / §7; Fase 3 evidence `13`–`15`):
 * - 2A / 1 room: feed Participants or party ISO DOBs
 * - 2A+1C / 1 room and 2A+1B / 1 room with party ISO DOBs
 * - 4 travellers / 2 rooms with party ISO DOBs
 *
 * Real ISO DOBs are never replaced with feed or placeholder birthdates.
 * Results live-prices all proven occupancies below (same contract as Detail).
 */
export function resolveSunwebLiveOccupancy(
  params: Pick<SearchParams, 'adults' | 'children' | 'babies' | 'rooms' | 'party'>,
): SunwebLiveOccupancy {
  const party = params.party;
  if (party && party.length === 4) {
    if (!party.every((traveller) => isIsoDob(traveller.dateOfBirth))) {
      return { ok: false, reason: 'invalid_occupancy' };
    }

    const rooms: string[][] = [[], []];
    for (const traveller of party) {
      if (traveller.roomIndex !== 0 && traveller.roomIndex !== 1) {
        return { ok: false, reason: 'invalid_occupancy' };
      }
      rooms[traveller.roomIndex].push(traveller.dateOfBirth as string);
    }
    if (rooms[0].length < 1 || rooms[1].length < 1) {
      return { ok: false, reason: 'invalid_occupancy' };
    }

    const participants: SunwebParticipant[] = [];
    rooms.forEach((birthdates, roomIndex) => {
      birthdates.forEach((birthDate, personIndex) => {
        participants.push({
          key: `Participants[${roomIndex}][${personIndex}]`,
          value: birthDate,
        });
      });
    });

    return { ok: true, mode: 'party', participants };
  }

  if (party && party.length === 3) {
    const adults = params.adults ?? 2;
    const children = params.children ?? 0;
    const babies = params.babies ?? 0;
    const rooms = params.rooms ?? 1;
    const provenChildOrBaby =
      adults === 2 && rooms === 1 && ((children === 1 && babies === 0) || (children === 0 && babies === 1));
    if (!provenChildOrBaby) {
      return { ok: false, reason: 'invalid_occupancy' };
    }
    const participants = participantsFromSameRoomParty(party);
    if (!participants) {
      return { ok: false, reason: 'invalid_occupancy' };
    }
    return { ok: true, mode: 'party', participants };
  }

  if (party && party.length === 2) {
    const adults = params.adults ?? 2;
    const children = params.children ?? 0;
    const babies = params.babies ?? 0;
    const rooms = params.rooms ?? 1;
    if (adults !== 2 || children !== 0 || babies !== 0 || rooms !== 1) {
      return { ok: false, reason: 'invalid_occupancy' };
    }
    const participants = participantsFromSameRoomParty(party);
    if (!participants) {
      return { ok: false, reason: 'invalid_occupancy' };
    }
    return { ok: true, mode: 'party', participants };
  }

  if (party && party.length > 0) {
    return { ok: false, reason: 'invalid_occupancy' };
  }

  const adults = params.adults ?? 2;
  const children = params.children ?? 0;
  const babies = params.babies ?? 0;
  const rooms = params.rooms ?? 1;
  if (adults === 2 && children === 0 && babies === 0 && rooms === 1) {
    return { ok: true, mode: 'feed-two-adults' };
  }

  return { ok: false, reason: 'invalid_occupancy' };
}

/** Proven Sunweb occupancies that Results may live-price (matches Detail). */
export function requiresSunwebResultsLivePrice(
  params: Pick<SearchParams, 'adults' | 'children' | 'babies' | 'rooms' | 'party'>,
): boolean {
  return resolveSunwebLiveOccupancy(params).ok;
}

function readParam(url: URL, indexed: string, plain: string): string {
  return (url.searchParams.get(indexed) || url.searchParams.get(plain) || '').trim();
}

/**
 * Trip fields from productURL / landing query (Bijbel §3 / §4).
 * Feed Participants are ignored; occupancy comes from SearchParams.party.
 */
export function parseSunwebLandingQuery(
  productUrl: string,
  accoId: string,
): Omit<SunwebLandingQuery, 'participants'> | null {
  if (!accoId || !/^\d+$/.test(accoId)) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(unwrapSunwebProductUrl(productUrl));
  } catch {
    return null;
  }

  const departureDate = readParam(url, 'DepartureDate[0]', 'DepartureDate');
  const departureAirport = readParam(url, 'DepartureAirport[0]', 'DepartureAirport').toUpperCase();
  const duration = readParam(url, 'Duration[0]', 'Duration');
  const mealplan = readParam(url, 'Mealplan[0]', 'Mealplan');
  const transportType = readParam(url, 'TransportType[0]', 'TransportType');

  if (!ISO_DATE.test(departureDate) || !IATA.test(departureAirport)) {
    return null;
  }
  if (!/^\d+$/.test(duration) || Number(duration) <= 0) {
    return null;
  }
  if (!mealplan || transportType !== 'Flight') {
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
  };
}

/** Landing URL with occupancy Participants (Fase 3 `buildLanding`). */
export function applySunwebOccupancyToLandingUrl(
  landingUrl: string,
  participants: readonly SunwebParticipant[],
): string | null {
  let url: URL;
  try {
    url = new URL(landingUrl);
  } catch {
    return null;
  }
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith('Participants[')) {
      url.searchParams.delete(key);
    }
  }
  for (const participant of participants) {
    url.searchParams.set(participant.key, participant.value);
  }
  return url.toString();
}

export function buildSunwebLiveContext(
  offer: TravelOffer,
  params: SearchParams,
): SunwebLiveContext | null {
  if (!isSunweb(offer)) {
    return null;
  }
  const occupancy = resolveSunwebLiveOccupancy(params);
  if (!occupancy.ok) {
    return null;
  }

  const accoId = extractSunwebAccommodationId(offer.id);
  const feHost = offer.deepLink ? resolveSunwebFeHost(offer.deepLink) : null;
  if (!accoId || !feHost || !offer.deepLink) {
    return null;
  }

  const trip = parseSunwebLandingQuery(offer.deepLink, accoId);
  if (!trip) {
    return null;
  }

  const unwrapped = unwrapSunwebProductUrl(offer.deepLink);
  if (occupancy.mode === 'feed-two-adults') {
    let landing: URL;
    try {
      landing = new URL(unwrapped);
    } catch {
      return null;
    }
    const participants: SunwebParticipant[] = [];
    for (const [key, value] of landing.searchParams.entries()) {
      if (/^Participants\[\d+\]\[\d+\]$/.test(key) && ISO_DATE.test(value)) {
        participants.push({ key, value });
      }
    }
    if (
      participants.length !== 2 ||
      participants[0]?.key !== 'Participants[0][0]' ||
      participants[1]?.key !== 'Participants[0][1]'
    ) {
      return null;
    }
    return {
      accoId,
      landingUrl: unwrapped,
      feHost,
      query: { ...trip, participants },
    };
  }

  const landingUrl = applySunwebOccupancyToLandingUrl(unwrapped, occupancy.participants);
  if (!landingUrl) {
    return null;
  }

  return {
    accoId,
    landingUrl,
    feHost,
    query: {
      ...trip,
      participants: occupancy.participants,
    },
  };
}

/**
 * URL.toString() percent-encodes `[]`. Proven TradeTracker `r=` uses
 * encodeURIComponent of the IBE source form with literal brackets
 * (Bijbel §2–3; 06_case1_tt_redirect_and_rate.json start URL).
 */
function sunwebLandingHrefForTtWrap(landingUrl: string): string {
  const url = new URL(landingUrl);
  const pairs: string[] = [];
  url.searchParams.forEach((value, key) => {
    pairs.push(`${key}=${value}`);
  });
  const query = pairs.join('&');
  const href = query ? `${url.origin}${url.pathname}?${query}` : `${url.origin}${url.pathname}`;
  return `${href}${url.hash}`;
}

/**
 * Keep the proven TT wrapper (`tt=` + `r=`/`u=`) and replace only the nested
 * landing so Participants occupancy is the search party, not feed 2A.
 */
function wrapSunwebOccupancyLanding(
  productUrl: string,
  occupancyLandingUrl: string,
): string | null {
  try {
    const outer = new URL(productUrl);
    const wrapKey = outer.searchParams.has('r') ? 'r' : outer.searchParams.has('u') ? 'u' : null;
    if (!wrapKey) {
      return occupancyLandingUrl;
    }

    const landingForWrap = sunwebLandingHrefForTtWrap(occupancyLandingUrl);
    outer.searchParams.delete('r');
    outer.searchParams.delete('u');
    const kept = outer.searchParams.toString();
    const encodedLanding = encodeURIComponent(landingForWrap);
    const originPath = `${outer.origin}${outer.pathname}`;
    if (kept) {
      return `${originPath}?${kept}&${wrapKey}=${encodedLanding}`;
    }
    return `${originPath}?${wrapKey}=${encodedLanding}`;
  } catch {
    return null;
  }
}

function clickOutLandingHasOccupancy(
  clickOutHref: string,
  occupancyLandingUrl: string,
  participants: readonly SunwebParticipant[],
): boolean {
  let expected: URL;
  let actual: URL;
  try {
    expected = new URL(occupancyLandingUrl);
    actual = new URL(unwrapSunwebProductUrl(clickOutHref));
  } catch {
    return false;
  }
  if (actual.hostname.toLowerCase() !== expected.hostname.toLowerCase()) {
    return false;
  }
  if (actual.pathname !== expected.pathname) {
    return false;
  }
  for (const participant of participants) {
    if (actual.searchParams.get(participant.key) !== participant.value) {
      return false;
    }
  }
  return true;
}

/**
 * 4 travellers / 2 rooms click-out: occupancy-rewritten landing inside the
 * original TT wrap. Fail-closed (null) when trip fields, host, or occupancy
 * are not the proven contract — never send feed 2A Participants as 4p/2r.
 */
export function buildSunwebOccupancyClickOutHref(
  offer: TravelOffer,
  params: SearchParams,
): string | null {
  const occupancy = resolveSunwebLiveOccupancy(params);
  if (!occupancy.ok || occupancy.mode !== 'party') {
    return null;
  }
  const ctx = buildSunwebLiveContext(offer, params);
  if (!ctx || !offer.deepLink) {
    return null;
  }

  const clickOut = wrapSunwebOccupancyLanding(offer.deepLink, ctx.landingUrl);
  if (!clickOut) {
    return null;
  }
  if (resolveSunwebFeHost(clickOut) !== ctx.feHost) {
    return null;
  }
  if (!clickOutLandingHasOccupancy(clickOut, ctx.landingUrl, ctx.query.participants)) {
    return null;
  }
  return clickOut;
}
