import type { TravelOffer } from '@/lib/feeds/canonical/travel-offer';
import {
  occupancyCategoryFromSearchParams,
} from '@/lib/search/occupancy-category';
import type { SearchParams } from '@/types/travel';

/**
 * Strict live-price attempt outcomes.
 *
 * SUCCESS     = proven live price received.
 * UNAVAILABLE = provider confirmed no availability for this concrete request
 *               (e.g. HTTP 204 / empty trip).
 * UNPRICED    = the current proven route cannot price this occupancy
 *               (not the same as unavailability). Results excludes the offer.
 * ERROR       = technical failure; the attempt could not be completed reliably.
 *
 * These statuses must not be used interchangeably.
 */
export const LIVE_PRICE_ATTEMPT_STATUS = {
  SUCCESS: 'SUCCESS',
  UNAVAILABLE: 'UNAVAILABLE',
  UNPRICED: 'UNPRICED',
  ERROR: 'ERROR',
} as const;

export type LivePriceAttemptStatus =
  (typeof LIVE_PRICE_ATTEMPT_STATUS)[keyof typeof LIVE_PRICE_ATTEMPT_STATUS];

export const LIVE_PRICE_ATTEMPT_REASON = {
  proven_live_price: 'proven_live_price',
  occupancy_unsupported: 'occupancy_unsupported',
  http_204: 'http_204',
  provider_empty: 'provider_empty',
  no_trip: 'no_trip',
  unavailable_trip: 'unavailable_trip',
  invalid_price: 'invalid_price',
  empty_receipt: 'empty_receipt',
  missing_package: 'missing_package',
  invalid_total: 'invalid_total',
  missing_context: 'missing_context',
  http_error: 'http_error',
  timeout: 'timeout',
  network_error: 'network_error',
  stale_context: 'stale_context',
  circuit_open: 'circuit_open',
  exception: 'exception',
} as const;

export type LivePriceAttemptReason =
  (typeof LIVE_PRICE_ATTEMPT_REASON)[keyof typeof LIVE_PRICE_ATTEMPT_REASON];

export type LivePriceAttemptEvent = {
  status: LivePriceAttemptStatus;
  reason: LivePriceAttemptReason;
  provider: string;
  listingHost?: string;
  feedSourceId?: string;
  departureAirport?: string;
  occupancyCategory: string;
  rooms: number;
  /** Internal unique-offer tracking only; never logged. */
  offerId?: string;
};

export type LivePriceFailureInput = {
  reason: string;
  httpStatus?: number;
};

type StatusCounts = Record<LivePriceAttemptStatus, number>;

export type LivePriceObservabilitySnapshot = {
  attempts: number;
  success: number;
  unavailable: number;
  unpriced: number;
  error: number;
  byStatus: StatusCounts;
  byProvider: Record<string, StatusCounts>;
  uniqueOffersByProvider: Record<string, StatusCounts>;
  byListingHost: Record<string, StatusCounts>;
  byFeedSourceId: Record<string, StatusCounts>;
  byDepartureAirport: Record<string, StatusCounts>;
  byOccupancyCategory: Record<string, StatusCounts>;
  byRooms: Record<string, StatusCounts>;
  byReason: Record<string, number>;
  recent: LivePriceAttemptEvent[];
};

const RING_BUFFER_SIZE = 500;

const emptyStatusCounts = (): StatusCounts => ({
  SUCCESS: 0,
  UNAVAILABLE: 0,
  UNPRICED: 0,
  ERROR: 0,
});

const recent: LivePriceAttemptEvent[] = [];
const byStatus = emptyStatusCounts();
const byProvider = new Map<string, StatusCounts>();
const byListingHost = new Map<string, StatusCounts>();
const byFeedSourceId = new Map<string, StatusCounts>();
const byDepartureAirport = new Map<string, StatusCounts>();
const byOccupancyCategory = new Map<string, StatusCounts>();
const byRooms = new Map<string, StatusCounts>();
const byReason = new Map<string, number>();
const uniqueOfferIdsByProviderStatus = new Map<string, Set<string>>();

function bumpStatus(map: Map<string, StatusCounts>, key: string, status: LivePriceAttemptStatus): void {
  const current = map.get(key) ?? emptyStatusCounts();
  current[status] += 1;
  map.set(key, current);
}

function mapToRecord(map: Map<string, StatusCounts>): Record<string, StatusCounts> {
  return Object.fromEntries(
    [...map.entries()].map(([key, value]) => [key, { ...value }]),
  );
}

export function classifyLivePriceFailure(
  input: LivePriceFailureInput,
): { status: 'UNAVAILABLE' | 'ERROR'; reason: LivePriceAttemptReason } {
  if (input.httpStatus === 204 || input.reason === LIVE_PRICE_ATTEMPT_REASON.http_204) {
    return {
      status: LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE,
      reason: LIVE_PRICE_ATTEMPT_REASON.http_204,
    };
  }

  switch (input.reason) {
    case 'empty':
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE,
        reason: LIVE_PRICE_ATTEMPT_REASON.provider_empty,
      };
    case 'no_trip':
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE,
        reason: LIVE_PRICE_ATTEMPT_REASON.no_trip,
      };
    case 'unavailable_trip':
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE,
        reason: LIVE_PRICE_ATTEMPT_REASON.unavailable_trip,
      };
    case 'invalid_price':
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE,
        reason: LIVE_PRICE_ATTEMPT_REASON.invalid_price,
      };
    case 'empty_receipt':
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE,
        reason: LIVE_PRICE_ATTEMPT_REASON.empty_receipt,
      };
    case 'missing_package':
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE,
        reason: LIVE_PRICE_ATTEMPT_REASON.missing_package,
      };
    case 'invalid_total':
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.UNAVAILABLE,
        reason: LIVE_PRICE_ATTEMPT_REASON.invalid_total,
      };
    case 'invalid_context':
    case 'missing_page_context':
    case 'missing_context':
    case 'no_listings':
      // C: no usable live context — short TTL, not a provider "trip unavailable" (A).
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
        reason: LIVE_PRICE_ATTEMPT_REASON.missing_context,
      };
    case 'timeout':
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
        reason: LIVE_PRICE_ATTEMPT_REASON.timeout,
      };
    case 'network_error':
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
        reason: LIVE_PRICE_ATTEMPT_REASON.network_error,
      };
    case 'http_error':
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
        reason: LIVE_PRICE_ATTEMPT_REASON.http_error,
      };
    case 'stale_context':
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
        reason: LIVE_PRICE_ATTEMPT_REASON.stale_context,
      };
    case 'circuit_open':
      // Technical skip while breaker is open — short TTL, not an 8h blacklist.
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
        reason: LIVE_PRICE_ATTEMPT_REASON.circuit_open,
      };
    case 'exception':
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
        reason: LIVE_PRICE_ATTEMPT_REASON.exception,
      };
    default:
      return {
        status: LIVE_PRICE_ATTEMPT_STATUS.ERROR,
        reason: LIVE_PRICE_ATTEMPT_REASON.exception,
      };
  }
}

/**
 * Technical (C) failures eligible for one immediate second attempt.
 * Confirmed unavailable (A) is not retried.
 * Missing mapping/context is C (short TTL) but not retried — retry cannot invent context.
 * Client 4xx (except 408/429) is treated as non-retryable http_error.
 */
export function isRetryableTechnicalLivePriceFailure(input: LivePriceFailureInput): boolean {
  const classified = classifyLivePriceFailure(input);
  if (classified.status !== LIVE_PRICE_ATTEMPT_STATUS.ERROR) {
    return false;
  }
  if (
    classified.reason === LIVE_PRICE_ATTEMPT_REASON.missing_context ||
    classified.reason === LIVE_PRICE_ATTEMPT_REASON.circuit_open
  ) {
    return false;
  }
  if (classified.reason === LIVE_PRICE_ATTEMPT_REASON.http_error) {
    const code = input.httpStatus;
    if (code != null && code >= 400 && code < 500 && code !== 408 && code !== 429) {
      return false;
    }
  }
  return true;
}

function occupancyRooms(params: SearchParams): number {
  const fromParty = params.party?.length
    ? Math.max(...params.party.map((traveller) => traveller.roomIndex + 1))
    : 1;
  return Math.max(1, params.rooms ?? 1, fromParty);
}

export function buildLivePriceAttemptEvent(
  offer: Pick<TravelOffer, 'provider' | 'listingHost' | 'feedSourceId' | 'departureAirport'>,
  params: SearchParams,
  outcome: { status: LivePriceAttemptStatus; reason: LivePriceAttemptReason },
): LivePriceAttemptEvent {
  const event: LivePriceAttemptEvent = {
    status: outcome.status,
    reason: outcome.reason,
    provider: offer.provider,
    occupancyCategory: occupancyCategoryFromSearchParams(params),
    rooms: occupancyRooms(params),
  };
  if (offer.listingHost) {
    event.listingHost = offer.listingHost;
  }
  if (offer.feedSourceId) {
    event.feedSourceId = offer.feedSourceId;
  }
  const airport = offer.departureAirport ?? params.departureAirport;
  if (airport) {
    event.departureAirport = airport;
  }
  return event;
}

function telemetryLooksLikeIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function livePriceTelemetryContainsPersonalData(value: unknown): boolean {
  if (value == null) {
    return false;
  }
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered.includes('dateofbirth') || lowered.includes('geboortedatum')) {
      return true;
    }
    if (telemetryLooksLikeIsoDate(value)) {
      return true;
    }
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => livePriceTelemetryContainsPersonalData(item));
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const lowered = key.toLowerCase();
      if (lowered.includes('dateofbirth') || lowered.includes('dob') || lowered === 'party') {
        return true;
      }
      if (livePriceTelemetryContainsPersonalData(nested)) {
        return true;
      }
    }
  }
  return false;
}

function maybeLog(event: LivePriceAttemptEvent): void {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) {
    return;
  }
  console.info(
    `[live-price] ${event.status} reason=${event.reason} provider=${event.provider} occupancy=${event.occupancyCategory} rooms=${event.rooms}` +
      (event.listingHost ? ` host=${event.listingHost}` : '') +
      (event.feedSourceId ? ` feed=${event.feedSourceId}` : '') +
      (event.departureAirport ? ` airport=${event.departureAirport}` : ''),
  );
}

function uniqueOffersByProviderRecord(): Record<string, StatusCounts> {
  const out: Record<string, StatusCounts> = {};
  for (const [key, ids] of uniqueOfferIdsByProviderStatus) {
    const separator = key.indexOf('\0');
    const provider = key.slice(0, separator);
    const status = key.slice(separator + 1) as LivePriceAttemptStatus;
    const row = out[provider] ?? emptyStatusCounts();
    row[status] = ids.size;
    out[provider] = row;
  }
  return out;
}

export function recordLivePriceAttempt(event: LivePriceAttemptEvent): void {
  const { offerId, ...publicEvent } = event;
  if (livePriceTelemetryContainsPersonalData(publicEvent)) {
    return;
  }

  byStatus[publicEvent.status] += 1;
  bumpStatus(byProvider, publicEvent.provider, publicEvent.status);
  if (publicEvent.listingHost) {
    bumpStatus(byListingHost, publicEvent.listingHost, publicEvent.status);
  }
  if (publicEvent.feedSourceId) {
    bumpStatus(byFeedSourceId, publicEvent.feedSourceId, publicEvent.status);
  }
  if (publicEvent.departureAirport) {
    bumpStatus(byDepartureAirport, publicEvent.departureAirport, publicEvent.status);
  }
  bumpStatus(byOccupancyCategory, publicEvent.occupancyCategory, publicEvent.status);
  bumpStatus(byRooms, String(publicEvent.rooms), publicEvent.status);
  byReason.set(publicEvent.reason, (byReason.get(publicEvent.reason) ?? 0) + 1);

  if (offerId) {
    const key = `${publicEvent.provider}\0${publicEvent.status}`;
    const ids = uniqueOfferIdsByProviderStatus.get(key) ?? new Set<string>();
    ids.add(offerId);
    uniqueOfferIdsByProviderStatus.set(key, ids);
  }

  recent.push(publicEvent);
  if (recent.length > RING_BUFFER_SIZE) {
    recent.shift();
  }

  maybeLog(publicEvent);
}

export function recordOfferLivePriceAttempt(
  offer: Pick<TravelOffer, 'id' | 'provider' | 'listingHost' | 'feedSourceId' | 'departureAirport'>,
  params: SearchParams,
  outcome: { status: LivePriceAttemptStatus; reason: LivePriceAttemptReason },
): void {
  const event = buildLivePriceAttemptEvent(offer, params, outcome);
  event.offerId = offer.id;
  recordLivePriceAttempt(event);
}

export function getLivePriceObservabilitySnapshot(): LivePriceObservabilitySnapshot {
  const attempts = byStatus.SUCCESS + byStatus.UNAVAILABLE + byStatus.UNPRICED + byStatus.ERROR;
  return {
    attempts,
    success: byStatus.SUCCESS,
    unavailable: byStatus.UNAVAILABLE,
    unpriced: byStatus.UNPRICED,
    error: byStatus.ERROR,
    byStatus: { ...byStatus },
    byProvider: mapToRecord(byProvider),
    uniqueOffersByProvider: uniqueOffersByProviderRecord(),
    byListingHost: mapToRecord(byListingHost),
    byFeedSourceId: mapToRecord(byFeedSourceId),
    byDepartureAirport: mapToRecord(byDepartureAirport),
    byOccupancyCategory: mapToRecord(byOccupancyCategory),
    byRooms: mapToRecord(byRooms),
    byReason: Object.fromEntries(byReason.entries()),
    recent: recent.map((event) => ({ ...event })),
  };
}

export function clearLivePriceObservabilityForTests(): void {
  recent.length = 0;
  byStatus.SUCCESS = 0;
  byStatus.UNAVAILABLE = 0;
  byStatus.UNPRICED = 0;
  byStatus.ERROR = 0;
  byProvider.clear();
  uniqueOfferIdsByProviderStatus.clear();
  byListingHost.clear();
  byFeedSourceId.clear();
  byDepartureAirport.clear();
  byOccupancyCategory.clear();
  byRooms.clear();
  byReason.clear();
}
