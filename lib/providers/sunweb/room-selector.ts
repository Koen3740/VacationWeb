import type { FetchLike } from '../prijsvrij/auth';
import { resolveSunwebFetchImpl } from '../../http/sunweb-keepalive-agent';
import {
  getCachedContextItemId,
  getSitecoreSiteGuidConfig,
  setCachedContextItemId,
  setSitecoreSiteGuidConfig,
} from '../context-item-id-cache';
import {
  partyHasValidAges,
  syntheticDobForMember,
  SYNTHETIC_ADULT_DOB,
  tripDobReferenceForOffer,
} from '../synthetic-dob';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { SUNWEB_LIVE_TIMEOUT_MS, SUNWEB_ROOM_SELECTOR_PATH } from './constants';
import { isSunwebDepartureDateBeforeToday } from './grouped-availability';
import {
  extractSunwebAccommodationId,
  isSunweb,
  parseSunwebLandingQuery,
  resolveSunwebFeHost,
  unwrapSunwebProductUrl,
  type SunwebParticipant,
} from './offer-context';
import { extractSunwebLandingGuids } from './promoted-price-client';

export type DetailRoomQuote = {
  id: string;
  name: string;
  /** Provider sentence such as "geschikt voor 2 tot 3 personen …". Absent when the response has none. */
  capacityText?: string;
  /** Provider party total. Absent when this room has more than one distinct total. */
  totalPrice?: number;
};

export type SunwebRoomQuoteResult =
  | { ok: true; rooms: DetailRoomQuote[] }
  | { ok: false; reason: 'invalid_context' | 'unavailable_trip' | 'http_error' | 'empty' | 'timeout' | 'network_error'; httpStatus?: number };

const SUCCESS_TTL_MS = 60_000;
const FAILURE_TTL_MS = 15_000;
const ROOM_ID = /^[A-Za-z0-9]{2,16}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

type CacheEntry = { at: number; result: SunwebRoomQuoteResult };
const quoteCache = new Map<string, CacheEntry>();

export function resetSunwebRoomQuoteCacheForTests(): void {
  quoteCache.clear();
}

function readPositive(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

/**
 * One GetRoomSelectorApi body → room name, capacity sentence, and the party total.
 * A room with two different totals is listed without a price.
 */
export function readSunwebRoomQuotes(json: unknown): DetailRoomQuote[] | null {
  if (!json || typeof json !== 'object') {
    return null;
  }
  const data = (json as { data?: unknown }).data;
  if (!data || typeof data !== 'object') {
    return null;
  }
  const record = data as { rooms?: unknown; packages?: unknown };
  if (!Array.isArray(record.rooms)) {
    return null;
  }

  const totals = new Map<string, Set<number>>();
  if (Array.isArray(record.packages)) {
    for (const item of record.packages) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const pkg = item as { roomId?: unknown; totalPrice?: unknown };
      const roomId = typeof pkg.roomId === 'string' ? pkg.roomId.trim() : '';
      const total = readPositive(pkg.totalPrice);
      if (!ROOM_ID.test(roomId) || total == null) {
        continue;
      }
      const seen = totals.get(roomId) ?? new Set<number>();
      seen.add(total);
      totals.set(roomId, seen);
    }
  }

  const rooms: DetailRoomQuote[] = [];
  for (const item of record.rooms) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const room = item as { id?: unknown; name?: unknown; subtitle?: unknown };
    const id = typeof room.id === 'string' ? room.id.trim() : '';
    const name = typeof room.name === 'string' ? room.name.trim() : '';
    if (!ROOM_ID.test(id) || !name) {
      continue;
    }
    const subtitle = typeof room.subtitle === 'string' ? room.subtitle.trim() : '';
    const distinct = totals.get(id);
    const totalPrice = distinct && distinct.size === 1 ? [...distinct][0] : undefined;
    rooms.push({
      id,
      name,
      ...(subtitle ? { capacityText: subtitle } : {}),
      ...(totalPrice != null ? { totalPrice } : {}),
    });
  }
  return rooms;
}

/**
 * Participants for a detail-page party. Adults use the fixed synthetic DOB.
 * A child DOB is the return date minus the age. More than two rooms is not sent.
 */
export function sunwebDetailParticipants(
  params: Pick<SearchParams, 'adults' | 'children' | 'babies' | 'rooms' | 'party'>,
  reference: { returnDate: string | null },
): SunwebParticipant[] | null {
  const party = params.party;
  if (!party || party.length === 0) {
    const adults = params.adults ?? 2;
    const children = params.children ?? 0;
    const babies = params.babies ?? 0;
    const rooms = params.rooms ?? 1;
    if (adults === 2 && children === 0 && babies === 0 && rooms === 1) {
      return [
        { key: 'Participants[0][0]', value: SYNTHETIC_ADULT_DOB },
        { key: 'Participants[0][1]', value: SYNTHETIC_ADULT_DOB },
      ];
    }
    return null;
  }
  if (!partyHasValidAges(party)) {
    return null;
  }
  const buckets = new Map<number, typeof party>();
  for (const member of party) {
    if (member.roomIndex !== 0 && member.roomIndex !== 1) {
      return null;
    }
    const list = buckets.get(member.roomIndex) ?? [];
    list.push(member);
    buckets.set(member.roomIndex, list);
  }
  const roomIndexes = [...buckets.keys()].sort((a, b) => a - b);
  if (roomIndexes.length === 2) {
    if ((buckets.get(0)?.length ?? 0) < 1 || (buckets.get(1)?.length ?? 0) < 1) {
      return null;
    }
  } else if (roomIndexes.length !== 1) {
    return null;
  }

  const participants: SunwebParticipant[] = [];
  for (const roomIndex of roomIndexes) {
    const members = buckets.get(roomIndex) ?? [];
    for (let personIndex = 0; personIndex < members.length; personIndex += 1) {
      const birthDate = syntheticDobForMember(members[personIndex], reference);
      if (!birthDate) {
        return null;
      }
      participants.push({
        key: `Participants[${roomIndex}][${personIndex}]`,
        value: birthDate,
      });
    }
  }
  return participants.length === party.length ? participants : null;
}

export function buildSunwebRoomSelectorUrl(args: {
  feHost: string;
  accoId: string;
  contextItemId: string;
  bookingGateId: string;
  departureDate: string;
  departureAirport: string;
  duration: string;
  mealplan: string;
  transportType: string;
  participants: readonly SunwebParticipant[];
}): string {
  const params = new URLSearchParams();
  params.set('accoId', args.accoId);
  params.set('bookingGateId', args.bookingGateId);
  params.set('contextItemId', args.contextItemId);
  params.set('departureDate', args.departureDate);
  params.set('duration', args.duration);
  params.set('DepartureAirport[0]', args.departureAirport);
  params.set('DepartureDate[0]', args.departureDate);
  params.set('Duration[0]', args.duration);
  params.set('Mealplan', args.mealplan);
  params.set('Month', args.departureDate.slice(0, 7));
  params.set('TransportType', args.transportType);
  for (const participant of args.participants) {
    params.set(participant.key, participant.value);
  }
  return `https://${args.feHost}${SUNWEB_ROOM_SELECTOR_PATH}?${params.toString()}`;
}

function cached(url: string): SunwebRoomQuoteResult | null {
  const entry = quoteCache.get(url);
  if (!entry) {
    return null;
  }
  const ttl = entry.result.ok ? SUCCESS_TTL_MS : FAILURE_TTL_MS;
  if (Date.now() - entry.at > ttl) {
    quoteCache.delete(url);
    return null;
  }
  return entry.result;
}

async function landingGuids(
  landingUrl: string,
  feHost: string,
  accoId: string,
  fetchImpl: FetchLike,
): Promise<{ contextItemId: string; bookingGateId: string } | null> {
  const site = getSitecoreSiteGuidConfig('sunweb');
  const contextItemId = getCachedContextItemId('sunweb', feHost, accoId);
  if (site?.bookingGateId && contextItemId) {
    return { contextItemId, bookingGateId: site.bookingGateId };
  }
  const response = await fetchImpl(landingUrl, {
    method: 'GET',
    headers: { Accept: 'text/html', Referer: `https://${feHost}/` },
    signal: AbortSignal.timeout(SUNWEB_LIVE_TIMEOUT_MS),
    cache: 'no-store',
  });
  if (response.status !== 200) {
    return null;
  }
  const html = await response.text();
  const guids = extractSunwebLandingGuids(html);
  if (!guids) {
    return null;
  }
  setCachedContextItemId('sunweb', feHost, accoId, guids.contextItemId);
  setSitecoreSiteGuidConfig('sunweb', {
    promotedPriceId: guids.promotedPriceId,
    bookingGateId: guids.bookingGateId,
  });
  return { contextItemId: guids.contextItemId, bookingGateId: guids.bookingGateId };
}

export async function fetchSunwebDetailRoomQuotes(
  offer: TravelOffer,
  params: SearchParams,
  options: { tripDate?: string; fetchImpl?: FetchLike } = {},
): Promise<SunwebRoomQuoteResult> {
  if (!isSunweb(offer)) {
    return { ok: false, reason: 'invalid_context' };
  }
  const accoId = extractSunwebAccommodationId(offer.id);
  const feHost = offer.deepLink ? resolveSunwebFeHost(offer.deepLink) : null;
  if (!accoId || !feHost || !offer.deepLink) {
    return { ok: false, reason: 'invalid_context' };
  }
  const trip = parseSunwebLandingQuery(unwrapSunwebProductUrl(offer.deepLink), accoId);
  if (!trip) {
    return { ok: false, reason: 'invalid_context' };
  }
  const departureDate = options.tripDate && ISO_DATE.test(options.tripDate) ? options.tripDate : trip.departureDate;
  if (isSunwebDepartureDateBeforeToday(departureDate)) {
    return { ok: false, reason: 'unavailable_trip' };
  }
  const participants = sunwebDetailParticipants(
    params,
    tripDobReferenceForOffer(offer, departureDate),
  );
  if (!participants) {
    return { ok: false, reason: 'invalid_context' };
  }

  const fetchImpl = resolveSunwebFetchImpl(options.fetchImpl);
  let guids: { contextItemId: string; bookingGateId: string } | null;
  try {
    guids = await landingGuids(unwrapSunwebProductUrl(offer.deepLink), feHost, accoId, fetchImpl);
  } catch {
    return { ok: false, reason: 'network_error' };
  }
  if (!guids) {
    return { ok: false, reason: 'invalid_context' };
  }

  const url = buildSunwebRoomSelectorUrl({
    feHost,
    accoId,
    contextItemId: guids.contextItemId,
    bookingGateId: guids.bookingGateId,
    departureDate,
    departureAirport: trip.departureAirport,
    duration: trip.duration,
    mealplan: trip.mealplan,
    transportType: trip.transportType,
    participants,
  });
  const hit = cached(url);
  if (hit) {
    return hit;
  }

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: unwrapSunwebProductUrl(offer.deepLink),
      },
      signal: AbortSignal.timeout(SUNWEB_LIVE_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (response.status !== 200) {
      const failed: SunwebRoomQuoteResult = {
        ok: false,
        reason: 'http_error',
        httpStatus: response.status,
      };
      quoteCache.set(url, { at: Date.now(), result: failed });
      return failed;
    }
    const json: unknown = await response.json();
    const rooms = readSunwebRoomQuotes(json);
    if (!rooms || rooms.length === 0) {
      const failed: SunwebRoomQuoteResult = { ok: false, reason: 'empty', httpStatus: 200 };
      quoteCache.set(url, { at: Date.now(), result: failed });
      return failed;
    }
    const result: SunwebRoomQuoteResult = { ok: true, rooms };
    quoteCache.set(url, { at: Date.now(), result });
    return result;
  } catch (error) {
    const name = error && typeof error === 'object' ? (error as { name?: string }).name : '';
    const reason = name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'network_error';
    return { ok: false, reason };
  }
}

export function selectDetailRoomQuote(
  rooms: readonly DetailRoomQuote[],
  selectedId: string | undefined,
): DetailRoomQuote | null {
  if (rooms.length === 0) {
    return null;
  }
  if (selectedId) {
    const match = rooms.find((room) => room.id.toLowerCase() === selectedId.toLowerCase());
    if (match) {
      return match;
    }
  }
  return rooms.find((room) => typeof room.totalPrice === 'number') ?? rooms[0];
}
