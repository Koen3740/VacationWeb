import type { FetchLike } from '../prijsvrij/auth';
import {
  extractElizaTransportErrorCode,
  noteElizaTransportFailure,
  resolveElizaFetchImpl,
} from '../../http/eliza-keepalive-agent';
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
  ELIZA_LIVE_PAGE1_CONCURRENCY,
  ELIZA_LIVE_TIMEOUT_MS,
  ELIZA_PROMOTED_PRICE_PATH,
} from './constants';
import type { ElizaLiveContext } from './offer-context';

export { resolveElizaFetchImpl } from '../../http/eliza-keepalive-agent';

configureLivePriceStepTelemetryBaseline({
  elizaPage1Concurrency: ELIZA_LIVE_PAGE1_CONCURRENCY,
  contextItemIdCacheTtlMs: CONTEXT_ITEM_ID_CACHE_TTL_MS,
});

export type ElizaLandingGuids = {
  contextItemId: string;
  promotedPriceId: string;
};

export type ElizaLivePriceResult =
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
        | 'http_error'
        | 'timeout'
        | 'network_error'
        | 'invalid_context'
        | 'missing_page_context';
      httpStatus?: number;
    };

const CONTEXT_ITEM_RE =
  /"template"\s*:\s*"AccommodationPage"\s*,\s*"contextItemId"\s*:\s*"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"/;
const PROMOTED_PRICE_ID_RE =
  /"PDP\.promotedPriceId"\s*:\s*"([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})"/;

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: string }).name;
  const message = String((error as { message?: string }).message ?? error);
  return name === 'TimeoutError' || name === 'AbortError' || /timeout|aborted/i.test(message);
}

/**
 * GUIDs from the proven landing HTML (AccommodationPage + PDP.promotedPriceId).
 * contextItemId is per-accommodation (B1 cache).
 * promotedPriceId is site-wide Sitecore config (Fase 0).
 */
export function extractElizaLandingGuids(html: string): ElizaLandingGuids | null {
  const context = CONTEXT_ITEM_RE.exec(html);
  const promoted = PROMOTED_PRICE_ID_RE.exec(html);
  if (!context?.[1] || !promoted?.[1]) {
    return null;
  }
  return { contextItemId: context[1], promotedPriceId: promoted[1] };
}

export function buildElizaPromotedPriceUrl(
  ctx: ElizaLiveContext,
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
  return `https://${ctx.feHost}${ELIZA_PROMOTED_PRICE_PATH}?${params.toString()}`;
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
  ctx: ElizaLiveContext,
  live: NonNullable<ReturnType<typeof readPromotedPrice>>,
): boolean {
  return (
    live.accommodationId === ctx.accoId &&
    live.departureDate === ctx.query.departureDate &&
    live.duration === ctx.query.duration &&
    live.mealplan === ctx.query.mealplan
  );
}

function tryCachedElizaGuids(ctx: ElizaLiveContext): ElizaLandingGuids | null {
  const site = getSitecoreSiteGuidConfig('eliza');
  if (!site?.promotedPriceId) {
    return null;
  }
  const contextItemId = getCachedContextItemId('eliza', ctx.feHost, ctx.accoId);
  if (!contextItemId) {
    return null;
  }
  return {
    contextItemId,
    promotedPriceId: site.promotedPriceId,
  };
}

type TimedLanding =
  | { ok: true; guids: ElizaLandingGuids; landingMs: number }
  | {
      ok: false;
      reason: 'http_error' | 'missing_page_context';
      httpStatus?: number;
      landingMs: number;
    };

async function fetchElizaLandingGuids(
  ctx: ElizaLiveContext,
  fetchImpl: FetchLike,
): Promise<TimedLanding> {
  const t0 = nowMs();
  const landingResponse = await fetchImpl(ctx.landingUrl, {
    method: 'GET',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      Referer: `https://${ctx.feHost}/`,
    },
    signal: AbortSignal.timeout(ELIZA_LIVE_TIMEOUT_MS),
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

  const guids = extractElizaLandingGuids(html);
  if (!guids) {
    return { ok: false, reason: 'missing_page_context', httpStatus: 200, landingMs: nowMs() - t0 };
  }

  setCachedContextItemId('eliza', ctx.feHost, ctx.accoId, guids.contextItemId);
  setSitecoreSiteGuidConfig('eliza', { promotedPriceId: guids.promotedPriceId });
  return { ok: true, guids, landingMs: nowMs() - t0 };
}

type ResolvedGuids =
  | {
      ok: true;
      guids: ElizaLandingGuids;
      fromCache: boolean;
      landingMs?: number;
    }
  | {
      ok: false;
      reason: 'http_error' | 'missing_page_context';
      httpStatus?: number;
      landingMs?: number;
    };

async function resolveElizaGuids(
  ctx: ElizaLiveContext,
  fetchImpl: FetchLike,
  forceLanding: boolean,
): Promise<ResolvedGuids> {
  if (!forceLanding) {
    const cached = tryCachedElizaGuids(ctx);
    if (cached) {
      return { ok: true, guids: cached, fromCache: true };
    }
  } else {
    recordContextItemLandingFallback();
  }

  const landing = await fetchElizaLandingGuids(ctx, fetchImpl);
  if (!landing.ok) {
    return {
      ok: false,
      reason: landing.reason,
      landingMs: landing.landingMs,
      ...(landing.httpStatus !== undefined ? { httpStatus: landing.httpStatus } : {}),
    };
  }
  return { ok: true, guids: landing.guids, fromCache: false, landingMs: landing.landingMs };
}

type PriceWithSteps = {
  result: ElizaLivePriceResult;
  gppMs: number;
  http429Count: number;
  httpErrorStatuses: number[];
};

async function fetchElizaPriceWithGuids(
  ctx: ElizaLiveContext,
  guids: ElizaLandingGuids,
  fetchImpl: FetchLike,
): Promise<PriceWithSteps> {
  const counters = { http429Count: 0, httpErrorStatuses: [] as number[] };
  const tGpp = nowMs();
  const priceResponse = await fetchImpl(buildElizaPromotedPriceUrl(ctx, guids), {
    method: 'GET',
    headers: {
      Accept: 'application/json, text/plain, */*',
      Referer: ctx.landingUrl,
    },
    signal: AbortSignal.timeout(ELIZA_LIVE_TIMEOUT_MS),
    cache: 'no-store',
  });
  const gppMs = nowMs() - tGpp;
  noteHttpStatus(priceResponse.status, counters);

  if (priceResponse.status === 204) {
    return {
      result: { ok: false, reason: 'empty', httpStatus: 204 },
      gppMs,
      ...counters,
    };
  }
  if (priceResponse.status !== 200) {
    return {
      result: { ok: false, reason: 'http_error', httpStatus: priceResponse.status },
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
      gppMs,
      ...counters,
    };
  }

  const live = readPromotedPrice(json);
  if (!live || !Number.isFinite(live.averagePrice) || live.averagePrice <= 0) {
    return {
      result: { ok: false, reason: 'invalid_price', httpStatus: 200 },
      gppMs,
      ...counters,
    };
  }

  if (!contextMatches(ctx, live)) {
    return {
      result: { ok: false, reason: 'stale_context', httpStatus: 200 },
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
    gppMs,
    ...counters,
  };
}

function shouldRetryWithFreshLanding(result: ElizaLivePriceResult, fromCache: boolean): boolean {
  if (!fromCache || result.ok) {
    return false;
  }
  return result.reason === 'stale_context';
}

function emitElizaStep(args: {
  ok: boolean;
  reason?: string;
  totalMs: number;
  landingFromCache: boolean;
  landingMs?: number;
  gppMs?: number;
  http429Count: number;
  httpErrorStatuses: number[];
  transportErrorCode?: string;
}): void {
  recordLivePriceStepEvent({
    provider: 'eliza',
    ok: args.ok,
    ...(args.reason ? { reason: args.reason } : {}),
    landingFromCache: args.landingFromCache,
    ...(typeof args.landingMs === 'number' ? { landingMs: args.landingMs } : {}),
    ...(typeof args.gppMs === 'number' ? { gppMs: args.gppMs } : {}),
    totalMs: args.totalMs,
    http429Count: args.http429Count,
    httpErrorStatuses: args.httpErrorStatuses,
    ...(args.transportErrorCode ? { transportErrorCode: args.transportErrorCode } : {}),
  });
}

/**
 * Proven Eliza Feed→Live hop:
 * productURL → landing HTML (contextItemId / promotedPriceId) → GetPromotedPriceApi.
 *
 * B1: within CONTEXT_ITEM_ID_CACHE_TTL_MS, repeat acco skips landing HTML when
 * site-wide promotedPriceId config is known. Price is never cached / substituted.
 * Does not reuse the Sunweb client.
 *
 * L0: records per-step timings only; does not change control flow.
 */
export async function fetchElizaPromotedPrice(
  ctx: ElizaLiveContext,
  options: { fetchImpl?: FetchLike } = {},
): Promise<ElizaLivePriceResult> {
  if (!ctx.accoId || !ctx.landingUrl) {
    return { ok: false, reason: 'invalid_context' };
  }

  const fetchImpl = resolveElizaFetchImpl(options.fetchImpl);
  const t0 = nowMs();
  const http = { http429Count: 0, httpErrorStatuses: [] as number[] };

  try {
    const resolved = await resolveElizaGuids(ctx, fetchImpl, false);
    if (!resolved.ok) {
      noteHttpStatus(resolved.httpStatus, http);
      emitElizaStep({
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
    let priced = await fetchElizaPriceWithGuids(ctx, resolved.guids, fetchImpl);
    http.http429Count += priced.http429Count;
    http.httpErrorStatuses.push(...priced.httpErrorStatuses);

    if (shouldRetryWithFreshLanding(priced.result, fromCache)) {
      invalidateCachedContextItemId('eliza', ctx.feHost, ctx.accoId);
      const fresh = await resolveElizaGuids(ctx, fetchImpl, true);
      if (!fresh.ok) {
        noteHttpStatus(fresh.httpStatus, http);
        emitElizaStep({
          ok: false,
          reason: fresh.reason,
          totalMs: nowMs() - t0,
          landingFromCache: false,
          landingMs: fresh.landingMs,
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
      priced = await fetchElizaPriceWithGuids(ctx, fresh.guids, fetchImpl);
      http.http429Count += priced.http429Count;
      http.httpErrorStatuses.push(...priced.httpErrorStatuses);
    }

    emitElizaStep({
      ok: priced.result.ok,
      reason: priced.result.ok ? undefined : priced.result.reason,
      totalMs: nowMs() - t0,
      landingFromCache: fromCache,
      landingMs,
      gppMs: priced.gppMs,
      ...http,
    });
    return priced.result;
  } catch (error) {
    const reason = isTimeoutError(error) ? 'timeout' : 'network_error';
    noteElizaTransportFailure(error, reason);
    const transportErrorCode = extractElizaTransportErrorCode(error);
    emitElizaStep({
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
