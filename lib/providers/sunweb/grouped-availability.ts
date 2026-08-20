import type { FetchLike } from '../prijsvrij/auth';
import { SUNWEB_GROUPED_PRICES_PATH, SUNWEB_LIVE_TIMEOUT_MS } from './constants';
import type { SunwebLiveContext } from './offer-context';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type SunwebGroupedAvailabilityGuids = {
  contextItemId: string;
  bookingGateId: string;
};

export type SunwebGroupedPriceRow = {
  departureDate: string;
  duration: string;
  mealplan: string;
  transportType: string;
};

export type SunwebExactAvailabilityResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | 'unavailable_trip'
        | 'empty'
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

/** Calendar date in Europe/Brussels (YYYY-MM-DD). */
export function sunwebTodayIsoEuropeBrussels(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * A departure date before today is not bookable.
 * Invalid ISO is fail-closed (treated as not available).
 */
export function isSunwebDepartureDateBeforeToday(
  departureDate: string,
  todayIso: string = sunwebTodayIsoEuropeBrussels(),
): boolean {
  if (!ISO_DATE.test(departureDate) || !ISO_DATE.test(todayIso)) {
    return true;
  }
  return departureDate < todayIso;
}

function normalizeIsoDate(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  const sliced = value.trim().slice(0, 10);
  return ISO_DATE.test(sliced) ? sliced : '';
}

export function sunwebGroupedRowMatchesExactTrip(
  row: SunwebGroupedPriceRow,
  ctx: Pick<SunwebLiveContext, 'query'>,
): boolean {
  return (
    row.departureDate === ctx.query.departureDate &&
    String(row.duration) === String(ctx.query.duration) &&
    row.mealplan === ctx.query.mealplan &&
    row.transportType === ctx.query.transportType
  );
}

function readGroupedPriceRow(value: unknown): SunwebGroupedPriceRow | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as {
    departureDate?: unknown;
    duration?: unknown;
    mealplan?: unknown;
    transportType?: unknown;
  };
  const departureDate = normalizeIsoDate(record.departureDate);
  const duration = record.duration == null ? '' : String(record.duration);
  const mealplan = typeof record.mealplan === 'string' ? record.mealplan : '';
  const transportType = typeof record.transportType === 'string' ? record.transportType : '';
  if (!departureDate || !duration || !mealplan || !transportType) {
    return null;
  }
  return { departureDate, duration, mealplan, transportType };
}

/** Proven Sitecore shape: `{ data: { prices: [...] } }`. Missing `prices` is not proof. */
export function readSunwebGroupedPriceRows(json: unknown): SunwebGroupedPriceRow[] | null {
  if (!json || typeof json !== 'object') {
    return null;
  }
  const data = (json as { data?: { prices?: unknown } }).data;
  if (!data || !Array.isArray(data.prices)) {
    return null;
  }
  const rows: SunwebGroupedPriceRow[] = [];
  for (const item of data.prices) {
    const row = readGroupedPriceRow(item);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

export function findExactSunwebGroupedAvailabilityRow(
  rows: readonly SunwebGroupedPriceRow[],
  ctx: Pick<SunwebLiveContext, 'query'>,
): SunwebGroupedPriceRow | null {
  return rows.find((row) => sunwebGroupedRowMatchesExactTrip(row, ctx)) ?? null;
}

/**
 * Exact-trip availability URL. DateFrom = DateTo = this offer's departureDate.
 * Duration[0] is the offer duration only (never 8,9,10,11).
 * Airport is this offer's IATA — the response has no reliable IATA echo.
 */
export function buildSunwebGroupedAvailabilityUrl(
  ctx: SunwebLiveContext,
  guids: SunwebGroupedAvailabilityGuids,
): string {
  const params = new URLSearchParams();
  params.set('DepartureAirport[0]', ctx.query.departureAirport);
  params.set('Duration[0]', ctx.query.duration);
  params.set('DepartureDate[0]', ctx.query.departureDate);
  params.set('DateFrom', ctx.query.departureDate);
  params.set('DateTo', ctx.query.departureDate);
  for (const participant of ctx.query.participants) {
    params.set(participant.key, participant.value);
  }
  params.set('Mealplan', ctx.query.mealplan);
  params.set('Month', ctx.query.month);
  params.set('TransportType', ctx.query.transportType);
  params.set('accoId', ctx.accoId);
  params.set('contextItemId', guids.contextItemId);
  params.set('bookingGateId', guids.bookingGateId);
  return `https://${ctx.feHost}${SUNWEB_GROUPED_PRICES_PATH}?${params.toString()}`;
}

/**
 * Exact live availability gate for one Sunweb offer.
 * Does not return a price. A matching row only means GetPromotedPrice may run.
 */
export async function fetchSunwebExactTripAvailability(
  ctx: SunwebLiveContext,
  guids: SunwebGroupedAvailabilityGuids,
  options: { fetchImpl?: FetchLike; todayIso?: string } = {},
): Promise<SunwebExactAvailabilityResult> {
  if (!ctx.accoId || !ctx.landingUrl || !guids.contextItemId || !guids.bookingGateId) {
    return { ok: false, reason: 'invalid_context' };
  }
  if (isSunwebDepartureDateBeforeToday(ctx.query.departureDate, options.todayIso)) {
    return { ok: false, reason: 'unavailable_trip' };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(buildSunwebGroupedAvailabilityUrl(ctx, guids), {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: ctx.landingUrl,
      },
      signal: AbortSignal.timeout(SUNWEB_LIVE_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (response.status !== 200) {
      return { ok: false, reason: 'http_error', httpStatus: response.status };
    }

    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      return { ok: false, reason: 'empty', httpStatus: 200 };
    }

    const rows = readSunwebGroupedPriceRows(json);
    if (!rows) {
      return { ok: false, reason: 'empty', httpStatus: 200 };
    }
    if (!findExactSunwebGroupedAvailabilityRow(rows, ctx)) {
      return { ok: false, reason: 'unavailable_trip', httpStatus: 200 };
    }
    return { ok: true };
  } catch (error) {
    if (isTimeoutError(error)) {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'network_error' };
  }
}
