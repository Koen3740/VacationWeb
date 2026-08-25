import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import type { SearchParams } from '../../../types/travel';
import {
  ELIZA_ALLOWED_FE_HOSTS,
  ELIZA_PROVIDER_NAME,
  type ElizaFeHost,
} from './constants';

export type ElizaParticipant = { key: string; value: string };

export type ElizaLandingQuery = {
  accoId: string;
  departureDate: string;
  departureAirport: string;
  duration: string;
  mealplan: string;
  transportType: string;
  month: string;
  participants: ElizaParticipant[];
};

export type ElizaLiveContext = {
  accoId: string;
  landingUrl: string;
  feHost: ElizaFeHost;
  query: ElizaLandingQuery;
};

export type ElizaLiveOccupancy =
  | { ok: false; reason: 'invalid_occupancy' }
  | { ok: true; mode: 'feed-two-adults' }
  | { ok: true; mode: 'party'; participants: ElizaParticipant[] }
  | { ok: true; mode: 'four-travellers-two-rooms'; participants: ElizaParticipant[] };

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

function isIsoDob(value: string | null | undefined): value is string {
  return typeof value === 'string' && ISO_DATE.test(value);
}

/**
 * Search shape for this gap: 4 travellers / 2 rooms.
 * 2A/1R keeps the proven feed-Participants live route.
 */
export function isElizaFourTravellerTwoRoomSearch(
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

function resolveElizaFourTravellerTwoRoomOccupancy(
  params: Pick<SearchParams, 'party'>,
): ElizaLiveOccupancy {
  const party = params.party;
  if (!party || party.length !== 4) {
    return { ok: false, reason: 'invalid_occupancy' };
  }
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

  const participants: ElizaParticipant[] = [];
  rooms.forEach((birthdates, roomIndex) => {
    birthdates.forEach((birthDate, personIndex) => {
      participants.push({
        key: `Participants[${roomIndex}][${personIndex}]`,
        value: birthDate,
      });
    });
  });

  return { ok: true, mode: 'four-travellers-two-rooms', participants };
}

function resolveElizaSameRoomPartyOccupancy(
  params: Pick<SearchParams, 'adults' | 'children' | 'babies' | 'rooms' | 'party'>,
): ElizaLiveOccupancy {
  const party = params.party;
  if (!party || party.length !== 3) {
    return { ok: false, reason: 'invalid_occupancy' };
  }
  if (!party.every((traveller) => isIsoDob(traveller.dateOfBirth))) {
    return { ok: false, reason: 'invalid_occupancy' };
  }
  const adults = params.adults ?? 2;
  const children = params.children ?? 0;
  const babies = params.babies ?? 0;
  const rooms = params.rooms ?? 1;
  if (adults !== 2 || children !== 1 || babies !== 0 || rooms !== 1) {
    return { ok: false, reason: 'invalid_occupancy' };
  }
  const roomIndexes = new Set(party.map((traveller) => traveller.roomIndex));
  if (roomIndexes.size !== 1) {
    return { ok: false, reason: 'invalid_occupancy' };
  }
  const roomIndex = party[0]?.roomIndex;
  if (roomIndex !== 0 && roomIndex !== 1) {
    return { ok: false, reason: 'invalid_occupancy' };
  }
  return {
    ok: true,
    mode: 'party',
    participants: party.map((traveller, personIndex) => ({
      key: `Participants[${roomIndex}][${personIndex}]`,
      value: traveller.dateOfBirth as string,
    })),
  };
}

/**
 * Proven live occupancies for Eliza:
 * - Package 1: 2A / 0C / 0B / 1 room uses feed Participants (no invented DOBs)
 * - 2A+1C / 1 room with party ISO DOBs (Bijbel §6; case 133863)
 * - 4 travellers / 2 rooms with party ISO DOBs encoded as
 *   `Participants[roomIndex][personIndex]=YYYY-MM-DD`
 *   (Bijbel §5–6; 22_closure_multiroom.json 2A1C_2rooms + 2A_2rooms_split)
 *
 * Real ISO DOBs are never replaced with feed or placeholder birthdates.
 */
export function resolveElizaLiveOccupancy(
  params: Pick<SearchParams, 'adults' | 'children' | 'babies' | 'rooms' | 'party'>,
): ElizaLiveOccupancy {
  if (isElizaFourTravellerTwoRoomSearch(params)) {
    return resolveElizaFourTravellerTwoRoomOccupancy(params);
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
    return { ok: false, reason: 'invalid_occupancy' };
  }

  if (adults === 2 && children === 1 && babies === 0 && rooms === 1) {
    return resolveElizaSameRoomPartyOccupancy(params);
  }

  if (adults !== 2 || children !== 0 || babies !== 0 || rooms !== 1) {
    return { ok: false, reason: 'invalid_occupancy' };
  }

  return { ok: true, mode: 'feed-two-adults' };
}

function readParam(url: URL, indexed: string, plain: string): string {
  return (url.searchParams.get(indexed) || url.searchParams.get(plain) || '').trim();
}

function parseParticipants(url: URL): ElizaParticipant[] {
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

function isFeedTwoAdultParticipants(participants: readonly ElizaParticipant[]): boolean {
  return (
    participants.length === 2 &&
    participants[0].key === 'Participants[0][0]' &&
    participants[1].key === 'Participants[0][1]'
  );
}

function parseElizaTripQuery(
  productUrl: string,
  accoId: string,
): Omit<ElizaLandingQuery, 'participants'> | null {
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

/**
 * Canonical live context is the productURL / landing query (Bijbel §3 / §5).
 * Feed property airport is not used.
 * Package-1 parse still requires feed 2A Participants on the URL.
 */
export function parseElizaLandingQuery(
  productUrl: string,
  accoId: string,
): ElizaLandingQuery | null {
  const trip = parseElizaTripQuery(productUrl, accoId);
  if (!trip) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(unwrapElizaProductUrl(productUrl));
  } catch {
    return null;
  }

  const participants = parseParticipants(url);
  if (!isFeedTwoAdultParticipants(participants)) {
    return null;
  }

  return { ...trip, participants };
}

/** Landing URL with occupancy Participants (closure `22` landing rewrite). */
export function applyElizaOccupancyToLandingUrl(
  landingUrl: string,
  participants: readonly ElizaParticipant[],
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

export function buildElizaLiveContext(
  offer: TravelOffer,
  params: SearchParams,
): ElizaLiveContext | null {
  if (!isEliza(offer)) {
    return null;
  }
  const occupancy = resolveElizaLiveOccupancy(params);
  if (!occupancy.ok) {
    return null;
  }

  const accoId = extractElizaAccommodationId(offer.id);
  const feHost = offer.deepLink ? resolveElizaFeHost(offer.deepLink) : null;
  if (!accoId || !feHost || !offer.deepLink) {
    return null;
  }

  if (occupancy.mode === 'four-travellers-two-rooms' || occupancy.mode === 'party') {
    const trip = parseElizaTripQuery(offer.deepLink, accoId);
    if (!trip) {
      return null;
    }
    const landingUrl = applyElizaOccupancyToLandingUrl(
      unwrapElizaProductUrl(offer.deepLink),
      occupancy.participants,
    );
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

/**
 * URL.toString() percent-encodes `[]`. Proven TradeTracker `r=` uses
 * encodeURIComponent of the IBE source form with literal brackets
 * (Bijbel §2 productURL `tt=` + `r=` landing).
 */
function elizaLandingHrefForTtWrap(landingUrl: string): string {
  const url = new URL(landingUrl);
  const pairs: string[] = [];
  url.searchParams.forEach((value, key) => {
    pairs.push(`${key}=${value}`);
  });
  const query = pairs.join('&');
  const href = query ? `${url.origin}${url.pathname}?${query}` : `${url.origin}${url.pathname}`;
  return `${href}${url.hash}`;
}

function wrapElizaOccupancyLanding(
  productUrl: string,
  occupancyLandingUrl: string,
): string | null {
  try {
    const outer = new URL(productUrl);
    const wrapKey = outer.searchParams.has('r') ? 'r' : outer.searchParams.has('u') ? 'u' : null;
    if (!wrapKey) {
      return occupancyLandingUrl;
    }

    const landingForWrap = elizaLandingHrefForTtWrap(occupancyLandingUrl);
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
  participants: readonly ElizaParticipant[],
): boolean {
  let expected: URL;
  let actual: URL;
  try {
    expected = new URL(occupancyLandingUrl);
    actual = new URL(unwrapElizaProductUrl(clickOutHref));
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
export function buildElizaOccupancyClickOutHref(
  offer: TravelOffer,
  params: SearchParams,
): string | null {
  const occupancy = resolveElizaLiveOccupancy(params);
  if (!occupancy.ok || (occupancy.mode !== 'four-travellers-two-rooms' && occupancy.mode !== 'party')) {
    return null;
  }
  const ctx = buildElizaLiveContext(offer, params);
  if (!ctx || !offer.deepLink) {
    return null;
  }

  const clickOut = wrapElizaOccupancyLanding(offer.deepLink, ctx.landingUrl);
  if (!clickOut) {
    return null;
  }
  if (resolveElizaFeHost(clickOut) !== ctx.feHost) {
    return null;
  }
  if (!clickOutLandingHasOccupancy(clickOut, ctx.landingUrl, occupancy.participants)) {
    return null;
  }
  return clickOut;
}
