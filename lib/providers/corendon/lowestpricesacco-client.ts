import type { FetchLike } from '../prijsvrij/auth';
import {
  CORENDON_DEFAULT_2A_PARTY,
  CORENDON_FE_BASE_URL,
  CORENDON_FE_VERSION,
  CORENDON_LIVE_TIMEOUT_MS,
} from './constants';
import type { CorendonLiveContext } from './offer-context';

export type CorendonLivePriceResult =
  | {
      ok: true;
      pricePerPerson: number;
      tripCode: string;
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
    };

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: string }).name;
  const message = String((error as { message?: string }).message ?? error);
  return name === 'TimeoutError' || name === 'AbortError' || /timeout|aborted/i.test(message);
}

function fragmentToPriceTableHash(fragment: string): string {
  return Buffer.from(fragment, 'utf8').toString('base64');
}

export function buildCorendonLowestpricesaccoUrl(ctx: CorendonLiveContext): string {
  const party = encodeURIComponent(JSON.stringify(CORENDON_DEFAULT_2A_PARTY));
  const hash = encodeURIComponent(fragmentToPriceTableHash(ctx.fragment.raw));
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
} | null {
  if (!json || typeof json !== 'object') {
    return null;
  }
  const pkg = (json as { package?: { lowestPriceTrip?: Record<string, unknown> } }).package;
  const lowest = pkg?.lowestPriceTrip;
  const trip = lowest?.trip as { price?: unknown; tripCode?: unknown } | undefined;
  if (!trip) {
    return null;
  }
  return {
    price: trip.price,
    tripCode: trip.tripCode,
    departureDate: lowest?.tripDepartureDate,
  };
}

function contextMatches(ctx: CorendonLiveContext, tripCode: string, liveDate: string): boolean {
  const sameAcco =
    tripCode.startsWith(`${ctx.accommodationId}.`) ||
    tripCode.includes(`.${ctx.fragment.accommodationCode}.`);
  const sameDate = liveDate === ctx.departureIso;
  const sameAirport = tripCode.includes(`.${ctx.fragment.airportRoute}.`);
  return Boolean(sameAcco && sameDate && sameAirport);
}

/**
 * Proven Corendon Feed→Live hop: productURL fragment → Base64 hash → lowestpricesacco.
 * Does not call upsales (that path invents birth dates). Coverage audit accepts
 * lowestpricesacco SUCCESS on acco+date+airportRoute match.
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
    if (!contextMatches(ctx, trip.tripCode, liveDate)) {
      return { ok: false, reason: 'stale_context', httpStatus: 200 };
    }

    return { ok: true, pricePerPerson: price, tripCode: trip.tripCode };
  } catch (error) {
    if (isTimeoutError(error)) {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'network_error' };
  }
}
