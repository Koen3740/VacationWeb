import type { FetchLike } from '../prijsvrij/auth';
import {
  ELIZA_LIVE_TIMEOUT_MS,
  ELIZA_PROMOTED_PRICE_PATH,
} from './constants';
import type { ElizaLiveContext } from './offer-context';

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

/** GUIDs from the proven landing HTML (AccommodationPage + PDP.promotedPriceId). */
export function extractElizaLandingGuids(
  html: string,
): { contextItemId: string; promotedPriceId: string } | null {
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

/**
 * Proven Eliza Feed→Live hop:
 * productURL → landing HTML (contextItemId / promotedPriceId) → GetPromotedPriceApi.
 * Does not reuse the Sunweb client. Does not substitute feed price.
 */
export async function fetchElizaPromotedPrice(
  ctx: ElizaLiveContext,
  options: { fetchImpl?: FetchLike } = {},
): Promise<ElizaLivePriceResult> {
  if (!ctx.accoId || !ctx.landingUrl) {
    return { ok: false, reason: 'invalid_context' };
  }

  const fetchImpl = options.fetchImpl ?? fetch;

  try {
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
      return { ok: false, reason: 'http_error', httpStatus: landingResponse.status };
    }

    let html = '';
    try {
      html = await landingResponse.text();
    } catch {
      return { ok: false, reason: 'missing_page_context', httpStatus: 200 };
    }

    const guids = extractElizaLandingGuids(html);
    if (!guids) {
      return { ok: false, reason: 'missing_page_context', httpStatus: 200 };
    }

    const priceResponse = await fetchImpl(buildElizaPromotedPriceUrl(ctx, guids), {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        Referer: ctx.landingUrl,
      },
      signal: AbortSignal.timeout(ELIZA_LIVE_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (priceResponse.status === 204) {
      return { ok: false, reason: 'empty', httpStatus: 204 };
    }
    if (priceResponse.status !== 200) {
      return { ok: false, reason: 'http_error', httpStatus: priceResponse.status };
    }

    let json: unknown = null;
    try {
      json = await priceResponse.json();
    } catch {
      return { ok: false, reason: 'empty', httpStatus: 200 };
    }

    const live = readPromotedPrice(json);
    if (!live || !Number.isFinite(live.averagePrice) || live.averagePrice <= 0) {
      return { ok: false, reason: 'invalid_price', httpStatus: 200 };
    }

    if (!contextMatches(ctx, live)) {
      return { ok: false, reason: 'stale_context', httpStatus: 200 };
    }

    return {
      ok: true,
      pricePerPerson: live.averagePrice,
      ...(Number.isFinite(live.totalPrice) && live.totalPrice > 0
        ? { totalPrice: live.totalPrice }
        : {}),
      accoId: live.accommodationId,
    };
  } catch (error) {
    if (isTimeoutError(error)) {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'network_error' };
  }
}
