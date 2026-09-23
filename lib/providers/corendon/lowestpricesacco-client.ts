import '@/lib/http/prefer-ipv4';
import { extractTransportErrorCode } from '@/lib/http/transport-error-code';
import type { AirportCountryCode } from '@/lib/search/canonical-airports';
import { getCanonicalAirportByIata } from '@/lib/search/canonical-airports';
import type { FetchLike } from '../prijsvrij/auth';
import {
  CORENDON_DEFAULT_2A_PARTY,
  CORENDON_FE_BASE_URL,
  CORENDON_FE_VERSION,
  CORENDON_LIVE_TIMEOUT_MS,
} from './constants';
import type { CorendonLiveContext, CorendonUrlFragment } from './offer-context';

/**
 * Corendon FE filter country codes (ISO-3166 alpha-3) as used in site
 * `tripUrlHash` / `priceTableHash` payloads (`[filters]BEL/BRU…`, `DEU/CGN…`, `NLD/AMS…`).
 */
const CORENDON_FILTER_COUNTRY_ISO3: Record<AirportCountryCode, string> = {
  BE: 'BEL',
  NL: 'NLD',
  DE: 'DEU',
  FR: 'FRA',
  LU: 'LUX',
};

export type CorendonLivePriceSource = 'lowestpricesacco' | 'upsales';

export type CorendonLowestHop = {
  pricePerPerson: number;
  tripCode: string;
  tripUrlHash: string;
  priceTableDate: string;
  durationInDays: number;
  nights: number;
};

export type CorendonLivePricePerPersonField =
  | 'upsales.displayedPricePerPerson'
  | 'display.totalDividedByPax';

export type CorendonLivePriceResult =
  | {
      ok: true;
      pricePerPerson: number;
      /**
       * Upsales display p.p. provenance only.
       * `display.totalDividedByPax` is not a Corendon-supplied p.p. field
       * and must never be written back as liveTotalPrice.
       */
      pricePerPersonField?: CorendonLivePricePerPersonField;
      tripCode: string;
      source: CorendonLivePriceSource;
      hop?: CorendonLowestHop;
      /** Provider upsales total only. Never lowest × pax. */
      totalPrice?: number;
      totalPriceField?: 'upsales.totalPrice' | 'upsales.realTimeBlankPrice';
    }
  | {
      ok: false;
      reason:
        | 'empty'
        | 'no_trip'
        | 'invalid_price'
        | 'stale_context'
        | 'http_error'
        | 'timeout'
        | 'network_error'
        | 'invalid_context';
      httpStatus?: number;
      /** Undici/Node transport code when reason is network_error (observability). */
      transportErrorCode?: string;
    };

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: string }).name;
  const message = String((error as { message?: string }).message ?? error);
  return name === 'TimeoutError' || name === 'AbortError' || /timeout|aborted/i.test(message);
}

function toBase64PriceTableHash(payload: string): string {
  return Buffer.from(payload, 'utf8').toString('base64');
}

/**
 * Site-proven `priceTableHash` plaintext (before Base64).
 *
 * Bare deeplink fragment alone makes `lowestpricesacco` return the hotel's
 * absolute cheapest trip (often another departure airport). Wrapping with
 * `[filters]{ISO3}/{IATA}.*.*.*.0|||{fragment}|||true` pins the departure
 * airport the way Corendon.be/nl does in Network → lowestpricesacco.
 *
 * Evidence: AN-079 / F12 Atrium RHATP 2026-09-22 (CGN → €889 CGNRHO with
 * filter hash; bare fragment → €874 DUSRHO).
 */
export function buildCorendonPriceTableHashPayload(fragment: CorendonUrlFragment): string {
  const raw = fragment.raw;
  if (!raw) {
    return raw;
  }
  const iata = (fragment.airportRoute.slice(0, 3) || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata)) {
    return raw;
  }
  const airport = getCanonicalAirportByIata(iata);
  const filterKey = airport
    ? `${CORENDON_FILTER_COUNTRY_ISO3[airport.countryCode]}/${iata}.*.*.*.0`
    : `${iata}.*.*.*.0`;
  return `[filters]${filterKey}|||${raw}|||true`;
}

export function buildCorendonLowestpricesaccoUrl(ctx: CorendonLiveContext): string {
  const party = encodeURIComponent(JSON.stringify(ctx.partyComposition ?? CORENDON_DEFAULT_2A_PARTY));
  const hash = encodeURIComponent(
    toBase64PriceTableHash(buildCorendonPriceTableHashPayload(ctx.fragment)),
  );
  const host = encodeURIComponent(ctx.feHost);
  return (
    `${CORENDON_FE_BASE_URL}/fe/api/prices/lowestpricesacco` +
    `?version=${CORENDON_FE_VERSION}` +
    `&originalHost=${host}` +
    `&browserHost=${host}` +
    `&accommodationId=${encodeURIComponent(ctx.accommodationId)}` +
    `&partyComposition=${party}` +
    `&searchQuery=` +
    `&priceTableHash=${hash}` +
    `&useFiltersFromHash=true`
  );
}

function readTrip(json: unknown): {
  price: unknown;
  tripCode: unknown;
  departureDate: unknown;
  tripUrlHash: unknown;
  priceTableDate: unknown;
  durationInDays: unknown;
} | null {
  if (!json || typeof json !== 'object') {
    return null;
  }
  const pkg = (json as { package?: { lowestPriceTrip?: Record<string, unknown> } }).package;
  const lowest = pkg?.lowestPriceTrip;
  const trip = lowest?.trip as {
    price?: unknown;
    tripCode?: unknown;
    tripUrlHash?: unknown;
    priceTableDate?: unknown;
    durationInDays?: unknown;
  } | undefined;
  if (!trip) {
    return null;
  }
  return {
    price: trip.price,
    tripCode: trip.tripCode,
    departureDate: lowest?.tripDepartureDate,
    tripUrlHash: trip.tripUrlHash,
    priceTableDate: trip.priceTableDate,
    durationInDays: trip.durationInDays,
  };
}

export function corendonLiveContextMatchesTrip(
  ctx: CorendonLiveContext,
  tripCode: string,
  liveDate: string,
): boolean {
  const sameAcco =
    tripCode.startsWith(`${ctx.accommodationId}.`) ||
    tripCode.includes(`.${ctx.fragment.accommodationCode}.`);
  const sameDate = liveDate === ctx.departureIso;
  const sameAirport = tripCode.includes(`.${ctx.fragment.airportRoute}.`);
  return Boolean(sameAcco && sameDate && sameAirport);
}

function nightsFromDuration(durationInDays: number): number | null {
  if (!Number.isFinite(durationInDays) || durationInDays < 2) {
    return null;
  }
  return durationInDays - 1;
}

function hopFromTrip(trip: {
  price: number;
  tripCode: string;
  tripUrlHash: unknown;
  priceTableDate: unknown;
  durationInDays: unknown;
}): CorendonLowestHop | undefined {
  if (typeof trip.tripUrlHash !== 'string' || !trip.tripUrlHash.trim()) {
    return undefined;
  }
  const durationInDays =
    typeof trip.durationInDays === 'number' ? trip.durationInDays : Number(trip.durationInDays);
  const nights = nightsFromDuration(durationInDays);
  const priceTableDate =
    typeof trip.priceTableDate === 'string' && /^\d{8}$/.test(trip.priceTableDate)
      ? trip.priceTableDate
      : undefined;
  if (!nights || !priceTableDate) {
    return undefined;
  }
  return {
    pricePerPerson: trip.price,
    tripCode: trip.tripCode,
    tripUrlHash: trip.tripUrlHash,
    priceTableDate,
    durationInDays,
    nights,
  };
}

/**
 * Proven Corendon Feed→Live hop: productURL fragment → Base64 hash → lowestpricesacco.
 * Occupancy-specific quotes (2A / 2A+1C / 4p with party ISO DOBs) use upsales after this hop (`fetchCorendonLivePrice`).
 */
export async function fetchCorendonLowestpricesaccoPrice(
  ctx: CorendonLiveContext,
  options: { fetchImpl?: FetchLike } = {},
): Promise<CorendonLivePriceResult> {
  if (!ctx.accommodationId || !ctx.fragment.raw) {
    return { ok: false, reason: 'invalid_context' };
  }

  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(buildCorendonLowestpricesaccoUrl(ctx), {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: `https://${ctx.feHost}/`,
      },
      signal: AbortSignal.timeout(CORENDON_LIVE_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (response.status === 204) {
      return { ok: false, reason: 'empty', httpStatus: 204 };
    }
    if (response.status !== 200) {
      return { ok: false, reason: 'http_error', httpStatus: response.status };
    }

    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      return { ok: false, reason: 'empty', httpStatus: 200 };
    }

    const trip = readTrip(json);
    if (!trip?.tripCode || typeof trip.tripCode !== 'string') {
      return { ok: false, reason: 'no_trip', httpStatus: 200 };
    }

    const price = typeof trip.price === 'number' ? trip.price : Number(trip.price);
    if (!Number.isFinite(price) || price <= 0) {
      return { ok: false, reason: 'invalid_price', httpStatus: 200 };
    }

    const liveDate =
      typeof trip.departureDate === 'string' ? trip.departureDate.slice(0, 10) : '';
    if (!corendonLiveContextMatchesTrip(ctx, trip.tripCode, liveDate)) {
      return { ok: false, reason: 'stale_context', httpStatus: 200 };
    }

    const hop = hopFromTrip({
      price,
      tripCode: trip.tripCode,
      tripUrlHash: trip.tripUrlHash,
      priceTableDate: trip.priceTableDate,
      durationInDays: trip.durationInDays,
    });

    return {
      ok: true,
      pricePerPerson: price,
      tripCode: trip.tripCode,
      source: 'lowestpricesacco',
      ...(hop ? { hop } : {}),
    };
  } catch (error) {
    if (isTimeoutError(error)) {
      return { ok: false, reason: 'timeout' };
    }
    const transportErrorCode = extractTransportErrorCode(error);
    return {
      ok: false,
      reason: 'network_error',
      ...(transportErrorCode ? { transportErrorCode } : {}),
    };
  }
}
