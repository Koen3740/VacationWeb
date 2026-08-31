import type { FetchLike } from '../prijsvrij/auth';
import {
  extractSunwebTransportErrorCode,
  noteSunwebTransportFailure,
  resolveSunwebFetchImpl,
} from '../../http/sunweb-keepalive-agent';
import {
  CONTEXT_ITEM_ID_CACHE_TTL_MS,
  getCachedContextItemId,
  getSitecoreSiteGuidConfig,
  invalidateCachedContextItemId,
  recordContextItemLandingFallback,
  setCachedContextItemId,
  setSitecoreSiteGuidConfig,
} from '../context-item-id-cache';
import {
  configureLivePriceStepTelemetryBaseline,
  noteHttpStatus,
  nowMs,
  recordLivePriceStepEvent,
} from '../live-price-step-telemetry';
import {
  SUNWEB_LIVE_PAGE1_CONCURRENCY,
  SUNWEB_LIVE_TIMEOUT_MS,
  SUNWEB_PROMOTED_PRICE_PATH,
} from './constants';
import {
  fetchSunwebExactTripAvailability,
  isSunwebDepartureDateBeforeToday,
} from './grouped-availability';
import type { SunwebLiveContext } from './offer-context';

configureLivePriceStepTelemetryBaseline({
  sunwebPage1Concurrency: SUNWEB_LIVE_PAGE1_CONCURRENCY,
  contextItemIdCacheTtlMs: CONTEXT_ITEM_ID_CACHE_TTL_MS,
});

export type SunwebLandingGuids = {
  contextItemId: string;
  promotedPriceId: string;
  bookingGateId: string;
};

export type SunwebLivePriceResult =
  | {
      ok: true;
      pricePerPerson: number;
      totalPrice?: number;
      accoId: string;
    }
  | {
      ok: false;
      reason:
        | 'empty'
        | 'invalid_price'
        | 'stale_context'
        | 'unavailable_trip'
        | 'http_error'
        | 'timeout'
        | 'network_error'
        | 'invalid_context'
        | 'missing_page_context';
      httpStatus?: number;
    };

const GUID =
  '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})';
const CONTEXT_ITEM_RE = new RegExp(
  `"template"\\s*:\\s*"AccommodationPage"\\s*,\\s*"contextItemId"\\s*:\\s*"${GUID}"`,
);
const PROMOTED_PRICE_ID_RE = new RegExp(`"PDP\\.promotedPriceId"\\s*:\\s*"${GUID}"`);
/** Proven landing HTML uses `PDP.bookingGateId`; keep unprefixed `bookingGateId` as fallback. */
const BOOKING_GATE_ID_RE = new RegExp(`"(?:PDP\\.)?bookingGateId"\\s*:\\s*"${GUID}"`, 'i');

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: string }).name;
  const message = String((error as { message?: string }).message ?? error);
  return name === 'TimeoutError' || name === 'AbortError' || /timeout|aborted/i.test(message);
}

/**
 * GUIDs from this offer's landing HTML.
 * contextItemId is per-accommodation (B1 cache).
 * promotedPriceId / bookingGateId are site-wide Sitecore config (Fase 0).
 */
export function extractSunwebLandingGuids(html: string): SunwebLandingGuids | null {
  const context = CONTEXT_ITEM_RE.exec(html);
  const promoted = PROMOTED_PRICE_ID_RE.exec(html);
  const bookingGate = BOOKING_GATE_ID_RE.exec(html);
  if (!context?.[1] || !promoted?.[1] || !bookingGate?.[1]) {
    return null;
  }
  return {
    contextItemId: context[1],
    promotedPriceId: promoted[1],
    bookingGateId: bookingGate[1],
  };
}

export function buildSunwebPromotedPriceUrl(
  ctx: SunwebLiveContext,
  guids: { contextItemId: string; promotedPriceId: string },
): string {
  const params = new URLSearchParams();
  params.set('DepartureAirport[0]', ctx.query.departureAirport);
  params.set('Duration[0]', ctx.query.duration);
  params.set('DepartureDate[0]', ctx.query.departureDate);
  for (const participant of ctx.query.participants) {
    params.set(participant.key, participant.value);
  }
  params.set('Mealplan', ctx.query.mealplan);
  params.set('Month', ctx.query.month);
  params.set('TransportType', ctx.query.transportType);
  params.set('accoId', ctx.accoId);
  params.set('contextItemId', guids.contextItemId);
  params.set('promotedPriceId', guids.promotedPriceId);
  return `https://${ctx.feHost}${SUNWEB_PROMOTED_PRICE_PATH}?${params.toString()}`;
}

function readPromotedPrice(json: unknown): {
  accommodationId: string;
  duration: string;
  departureDate: string;
  mealplan: string;
  averagePrice: number;
  totalPrice: number;
} | null {
  if (!json || typeof json !== 'object') {
    return null;
  }
  const record = json as {
    accommodationId?: unknown;
    duration?: unknown;
    departureDate?: { raw?: unknown };
    price?: {
      averagePrice?: unknown;
      value?: unknown;
      totalPrice?: unknown;
    };
    acmInformation?: { mealplanCode?: unknown };
  };

  const accommodationId = String(record.accommodationId ?? '');
  const duration = String(record.duration ?? '');
  const departureDate =
    typeof record.departureDate?.raw === 'string' ? record.departureDate.raw.slice(0, 10) : '';
  const mealplan =
    typeof record.acmInformation?.mealplanCode === 'string'
      ? record.acmInformation.mealplanCode
      : '';
  const averageRaw = record.price?.averagePrice ?? record.price?.value;
  const totalRaw = record.price?.totalPrice;
  const averagePrice = typeof averageRaw === 'number' ? averageRaw : Number(averageRaw);
  const totalPrice = typeof totalRaw === 'number' ? totalRaw : Number(totalRaw);

  if (!accommodationId || !Number.isFinite(averagePrice)) {
    return null;
  }

  return { accommodationId, duration, departureDate, mealplan, averagePrice, totalPrice };
}

function contextMatches(
  ctx: SunwebLiveContext,
  live: NonNullable<ReturnType<typeof readPromotedPrice>>,
): boolean {
  return (
    live.accommodationId === ctx.accoId &&
    live.departureDate === ctx.query.departureDate &&
    live.duration === ctx.query.duration &&
    live.mealplan === ctx.query.mealplan
  );
}

function tryCachedSunwebGuids(ctx: SunwebLiveContext): SunwebLandingGuids | null {
  const site = getSitecoreSiteGuidConfig('sunweb');
  if (!site?.promotedPriceId || !site.bookingGateId) {
    return null;
  }
  const contextItemId = getCachedContextItemId('sunweb', ctx.feHost, ctx.accoId);
  if (!contextItemId) {
    return null;
  }
  return {
    contextItemId,
    promotedPriceId: site.promotedPriceId,
    bookingGateId: site.bookingGateId,
  };
}

type TimedLanding =
  | { ok: true; guids: SunwebLandingGuids; landingMs: number }
  | {
      ok: false;
      reason: 'http_error' | 'missing_page_context';
      httpStatus?: number;
      landingMs: number;
    };

async function fetchSunwebLandingGuids(
  ctx: SunwebLiveContext,
  fetchImpl: FetchLike,
): Promise<TimedLanding> {
  const t0 = nowMs();
  const landingResponse = await fetchImpl(ctx.landingUrl, {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      Referer: `https://${ctx.feHost}/`,
    },
    signal: AbortSignal.timeout(SUNWEB_LIVE_TIMEOUT_MS),
    cache: 'no-store',
  });

  if (landingResponse.status !== 200) {
    return {
      ok: false,
      reason: 'http_error',
      httpStatus: landingResponse.status,
      landingMs: nowMs() - t0,
    };
  }

  let html = '';
  try {
    html = await landingResponse.text();
  } catch {
    return { ok: false, reason: 'missing_page_context', httpStatus: 200, landingMs: nowMs() - t0 };
  }

  const guids = extractSunwebLandingGuids(html);
  if (!guids) {
    if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
      const missing =
        [
          !CONTEXT_ITEM_RE.test(html) ? 'contextItemId' : null,
          !PROMOTED_PRICE_ID_RE.test(html) ? 'promotedPriceId' : null,
          !BOOKING_GATE_ID_RE.test(html) ? 'bookingGateId' : null,
        ]
          .filter(Boolean)
          .join(',') || 'unreadable';
      console.info(
        `[sunweb-availability] exact=false reason=missing_page_context missing=${missing} acco=${ctx.accoId} date=${ctx.query.departureDate} airport=${ctx.query.departureAirport} duration=${ctx.query.duration} meal=${ctx.query.mealplan} gpp=skip`,
      );
    }
    return { ok: false, reason: 'missing_page_context', httpStatus: 200, landingMs: nowMs() - t0 };
  }

  setCachedContextItemId('sunweb', ctx.feHost, ctx.accoId, guids.contextItemId);
  setSitecoreSiteGuidConfig('sunweb', {
    promotedPriceId: guids.promotedPriceId,
    bookingGateId: guids.bookingGateId,
  });
  return { ok: true, guids, landingMs: nowMs() - t0 };
}

type ResolvedGuids =
  | {
      ok: true;
      guids: SunwebLandingGuids;
      fromCache: boolean;
      landingMs?: number;
      httpStatus?: number;
    }
  | {
      ok: false;
      reason: 'http_error' | 'missing_page_context';
      httpStatus?: number;
      landingMs?: number;
    };

async function resolveSunwebGuids(
  ctx: SunwebLiveContext,
  fetchImpl: FetchLike,
  forceLanding: boolean,
): Promise<ResolvedGuids> {
  if (!forceLanding) {
    const cached = tryCachedSunwebGuids(ctx);
    if (cached) {
      return { ok: true, guids: cached, fromCache: true };
    }
  } else {
    recordContextItemLandingFallback();
  }

  const landing = await fetchSunwebLandingGuids(ctx, fetchImpl);
  if (!landing.ok) {
    return {
      ok: false,
      reason: landing.reason,
      landingMs: landing.landingMs,
      ...(landing.httpStatus !== undefined ? { httpStatus: landing.httpStatus } : {}),
    };
  }
  return {
    ok: true,
    guids: landing.guids,
    fromCache: false,
    landingMs: landing.landingMs,
  };
}

type PriceWithSteps = {
  result: SunwebLivePriceResult;
  groupedMs: number;
  gppMs?: number;
  http429Count: number;
  httpErrorStatuses: number[];
};

async function fetchSunwebPriceWithGuids(
  ctx: SunwebLiveContext,
  guids: SunwebLandingGuids,
  fetchImpl: FetchLike,
  todayIso?: string,
): Promise<PriceWithSteps> {
  const counters = { http429Count: 0, httpErrorStatuses: [] as number[] };
  const tGrouped = nowMs();
  const availability = await fetchSunwebExactTripAvailability(ctx, guids, {
    fetchImpl,
    todayIso,
  });
  const groupedMs = nowMs() - tGrouped;
  if (!availability.ok) {
    noteHttpStatus(availability.httpStatus, counters);
    if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
      console.info(
        `[sunweb-availability] exact=false reason=${availability.reason} acco=${ctx.accoId} date=${ctx.query.departureDate} airport=${ctx.query.departureAirport} duration=${ctx.query.duration} meal=${ctx.query.mealplan} gpp=skip`,
      );
    }
    return { result: availability, groupedMs, ...counters };
  }
  if (process.env.NODE_ENV !== 'test' && !process.env.NODE_TEST_CONTEXT) {
    console.info(
      `[sunweb-availability] exact=true acco=${ctx.accoId} date=${ctx.query.departureDate} airport=${ctx.query.departureAirport} duration=${ctx.query.duration} meal=${ctx.query.mealplan} gpp=call`,
    );
  }

  const tGpp = nowMs();
  const priceResponse = await fetchImpl(buildSunwebPromotedPriceUrl(ctx, guids), {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: ctx.landingUrl,
    },
    signal: AbortSignal.timeout(SUNWEB_LIVE_TIMEOUT_MS),
    cache: 'no-store',
  });
  const gppMs = nowMs() - tGpp;
  noteHttpStatus(priceResponse.status, counters);

  if (priceResponse.status === 204) {
    return {
      result: { ok: false, reason: 'empty', httpStatus: 204 },
      groupedMs,
      gppMs,
      ...counters,
    };
  }
  if (priceResponse.status !== 200) {
    return {
      result: { ok: false, reason: 'http_error', httpStatus: priceResponse.status },
      groupedMs,
      gppMs,
      ...counters,
    };
  }

  let json: unknown = null;
  try {
    json = await priceResponse.json();
  } catch {
    return {
      result: { ok: false, reason: 'empty', httpStatus: 200 },
      groupedMs,
      gppMs,
      ...counters,
    };
  }

  const live = readPromotedPrice(json);
  if (!live || !Number.isFinite(live.averagePrice) || live.averagePrice <= 0) {
    return {
      result: { ok: false, reason: 'invalid_price', httpStatus: 200 },
      groupedMs,
      gppMs,
      ...counters,
    };
  }

  if (!contextMatches(ctx, live)) {
    return {
      result: { ok: false, reason: 'stale_context', httpStatus: 200 },
      groupedMs,
      gppMs,
      ...counters,
    };
  }

  return {
    result: {
      ok: true,
      pricePerPerson: live.averagePrice,
      ...(Number.isFinite(live.totalPrice) && live.totalPrice > 0
        ? { totalPrice: live.totalPrice }
        : {}),
      accoId: live.accommodationId,
    },
    groupedMs,
    gppMs,
    ...counters,
  };
}

function shouldRetryWithFreshLanding(result: SunwebLivePriceResult, fromCache: boolean): boolean {
  if (!fromCache || result.ok) {
    return false;
  }
  // Cached contextItemId may be expired/wrong — never surface a wrong price; re-bootstrap once.
  return result.reason === 'stale_context';
}

function emitSunwebStep(args: {
  ok: boolean;
  reason?: string;
  totalMs: number;
  landingFromCache: boolean;
  landingMs?: number;
  groupedMs?: number;
  gppMs?: number;
  http429Count: number;
  httpErrorStatuses: number[];
  transportErrorCode?: string;
}): void {
  recordLivePriceStepEvent({
    provider: 'sunweb',
    ok: args.ok,
    ...(args.reason ? { reason: args.reason } : {}),
    landingFromCache: args.landingFromCache,
    ...(typeof args.landingMs === 'number' ? { landingMs: args.landingMs } : {}),
    ...(typeof args.groupedMs === 'number' ? { groupedMs: args.groupedMs } : {}),
    ...(typeof args.gppMs === 'number' ? { gppMs: args.gppMs } : {}),
    totalMs: args.totalMs,
    http429Count: args.http429Count,
    httpErrorStatuses: args.httpErrorStatuses,
    ...(args.transportErrorCode ? { transportErrorCode: args.transportErrorCode } : {}),
  });
}

/**
 * Proven Sunweb Feed→Live hop:
 * productURL → landing HTML (contextItemId / promotedPriceId / bookingGateId)
 * → exact GetPricesGroupedByDurationApi gate
 * → GetPromotedPriceApi + contextMatches.
 *
 * B1: within CONTEXT_ITEM_ID_CACHE_TTL_MS, repeat acco skips landing HTML when
 * site-wide promotedPriceId/bookingGateId config is known. Price is never cached.
 * GPP is never the availability oracle. Catalog € is never substituted.
 *
 * L0: records per-step timings only; does not change control flow.
 */
export async function fetchSunwebPromotedPrice(
  ctx: SunwebLiveContext,
  options: { fetchImpl?: FetchLike; todayIso?: string } = {},
): Promise<SunwebLivePriceResult> {
  if (!ctx.accoId || !ctx.landingUrl) {
    return { ok: false, reason: 'invalid_context' };
  }

  if (isSunwebDepartureDateBeforeToday(ctx.query.departureDate, options.todayIso)) {
    return { ok: false, reason: 'unavailable_trip' };
  }

  const fetchImpl = resolveSunwebFetchImpl(options.fetchImpl);
  const t0 = nowMs();
  const http = { http429Count: 0, httpErrorStatuses: [] as number[] };

  try {
    const resolved = await resolveSunwebGuids(ctx, fetchImpl, false);
    if (!resolved.ok) {
      noteHttpStatus(resolved.httpStatus, http);
      emitSunwebStep({
        ok: false,
        reason: resolved.reason,
        totalMs: nowMs() - t0,
        landingFromCache: false,
        landingMs: resolved.landingMs,
        ...http,
      });
      return {
        ok: false,
        reason: resolved.reason,
        ...(resolved.httpStatus !== undefined ? { httpStatus: resolved.httpStatus } : {}),
      };
    }

    let fromCache = resolved.fromCache;
    let landingMs = resolved.landingMs;
    let priced = await fetchSunwebPriceWithGuids(
      ctx,
      resolved.guids,
      fetchImpl,
      options.todayIso,
    );
    http.http429Count += priced.http429Count;
    http.httpErrorStatuses.push(...priced.httpErrorStatuses);

    if (shouldRetryWithFreshLanding(priced.result, fromCache)) {
      invalidateCachedContextItemId('sunweb', ctx.feHost, ctx.accoId);
      const fresh = await resolveSunwebGuids(ctx, fetchImpl, true);
      if (!fresh.ok) {
        noteHttpStatus(fresh.httpStatus, http);
        emitSunwebStep({
          ok: false,
          reason: fresh.reason,
          totalMs: nowMs() - t0,
          landingFromCache: false,
          landingMs: fresh.landingMs,
          groupedMs: priced.groupedMs,
          gppMs: priced.gppMs,
          ...http,
        });
        return {
          ok: false,
          reason: fresh.reason,
          ...(fresh.httpStatus !== undefined ? { httpStatus: fresh.httpStatus } : {}),
        };
      }
      fromCache = false;
      landingMs = fresh.landingMs;
      priced = await fetchSunwebPriceWithGuids(ctx, fresh.guids, fetchImpl, options.todayIso);
      http.http429Count += priced.http429Count;
      http.httpErrorStatuses.push(...priced.httpErrorStatuses);
    }

    emitSunwebStep({
      ok: priced.result.ok,
      reason: priced.result.ok ? undefined : priced.result.reason,
      totalMs: nowMs() - t0,
      landingFromCache: fromCache,
      landingMs,
      groupedMs: priced.groupedMs,
      gppMs: priced.gppMs,
      ...http,
    });
    return priced.result;
  } catch (error) {
    const reason = isTimeoutError(error) ? 'timeout' : 'network_error';
    if (reason === 'network_error') {
      noteSunwebTransportFailure(error);
    }
    const transportErrorCode = extractSunwebTransportErrorCode(error);
    emitSunwebStep({
      ok: false,
      reason,
      totalMs: nowMs() - t0,
      landingFromCache: false,
      ...http,
      ...(transportErrorCode ? { transportErrorCode } : {}),
    });
    return { ok: false, reason };
  }
}
