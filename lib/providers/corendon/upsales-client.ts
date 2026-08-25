import type { FetchLike } from '../prijsvrij/auth';
import {
  CORENDON_FE_BASE_URL,
  CORENDON_FE_VERSION,
  CORENDON_LIVE_TIMEOUT_MS,
} from './constants';
import {
  corendonLiveContextMatchesTrip,
  fetchCorendonLowestpricesaccoPrice,
  type CorendonLivePriceResult,
  type CorendonLowestHop,
} from './lowestpricesacco-client';
import type { CorendonLiveContext } from './offer-context';

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: string }).name;
  const message = String((error as { message?: string }).message ?? error);
  return name === 'TimeoutError' || name === 'AbortError' || /timeout|aborted/i.test(message);
}

type UpsalesInput = {
  pax: Array<{ birthDate: string; roomNr: 1 | 2 }>;
  accoCode: string;
  facets: {
    tripPackageType: ['0'];
    airport: ['*'];
    board: ['*'];
  };
  upsales: null;
  previousUpsales: null;
  initialUpsales: null;
  initialPriceTablePrice: null;
  priceTableStateHash: string;
  offer: string;
  corendonClubDiscountCookieValue: '';
  affiliateIdCookieValue: '';
  travelnetWbsAgentCode: '';
  filterOptionsChanged: false;
};

/**
 * Proven upsales `offer` shape from Sub 17-1 (Bijbel §8.4 / evidence 13):
 * `{priceTableDate}|{days}_{nights}|{days}|{nights}|{nights}|{price}|{price}|0`
 * Values come from the lowestpricesacco hop, not invented table prices.
 */
export function buildCorendonUpsalesOffer(hop: CorendonLowestHop): string {
  const price = Math.round(hop.pricePerPerson);
  return `${hop.priceTableDate}|${hop.durationInDays}_${hop.nights}|${hop.durationInDays}|${hop.nights}|${hop.nights}|${price}|${price}|0`;
}

export function buildCorendonUpsalesInput(
  ctx: CorendonLiveContext,
  hop: CorendonLowestHop,
): UpsalesInput | null {
  if (!ctx.upsalesPax?.length || ctx.pricingRoute !== 'upsales') {
    return null;
  }
  return {
    pax: ctx.upsalesPax.map((traveller) => ({
      birthDate: traveller.birthDate,
      roomNr: traveller.roomNr,
    })),
    accoCode: ctx.fragment.accommodationCode,
    facets: {
      tripPackageType: ['0'],
      airport: ['*'],
      board: ['*'],
    },
    upsales: null,
    previousUpsales: null,
    initialUpsales: null,
    initialPriceTablePrice: null,
    priceTableStateHash: hop.tripUrlHash,
    offer: buildCorendonUpsalesOffer(hop),
    corendonClubDiscountCookieValue: '',
    affiliateIdCookieValue: '',
    travelnetWbsAgentCode: '',
    filterOptionsChanged: false,
  };
}

export function buildCorendonUpsalesUrl(ctx: CorendonLiveContext, hop: CorendonLowestHop): string | null {
  const input = buildCorendonUpsalesInput(ctx, hop);
  if (!input) {
    return null;
  }
  const encoded = encodeURIComponent(Buffer.from(JSON.stringify(input), 'utf8').toString('base64'));
  const host = encodeURIComponent(ctx.feHost);
  return (
    `${CORENDON_FE_BASE_URL}/fe/api/prices/upsales` +
    `?version=${CORENDON_FE_VERSION}` +
    `&originalHost=${host}` +
    `&browserHost=${host}` +
    `&input=${encoded}`
  );
}

function readUpsalesRoot(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== 'object') {
    return null;
  }
  const record = json as Record<string, unknown>;
  if (record.result && typeof record.result === 'object') {
    return record.result as Record<string, unknown>;
  }
  const content = record.content as { result?: unknown } | undefined;
  if (content?.result && typeof content.result === 'object') {
    return content.result as Record<string, unknown>;
  }
  return record;
}

function readNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

function readUpsalesTotal(json: unknown): {
  amount: number;
  field: 'upsales.totalPrice' | 'upsales.realTimeBlankPrice';
} | null {
  const root = readUpsalesRoot(json);
  if (!root) {
    return null;
  }
  const prices = (root.prices && typeof root.prices === 'object' ? root.prices : {}) as Record<
    string,
    unknown
  >;
  const total = readNumber(prices.totalPrice ?? root.totalPrice);
  if (total) {
    return { amount: total, field: 'upsales.totalPrice' };
  }
  const realtime = readNumber(prices.realTimeBlankPrice ?? root.realTimeBlankPrice);
  if (realtime) {
    return { amount: realtime, field: 'upsales.realTimeBlankPrice' };
  }
  return null;
}

function readUpsalesPricePerPerson(
  json: unknown,
  paxCount: number,
): {
  amount: number;
  field: 'upsales.displayedPricePerPerson' | 'display.totalDividedByPax';
} | null {
  const root = readUpsalesRoot(json);
  if (!root) {
    return null;
  }
  const prices = (root.prices && typeof root.prices === 'object' ? root.prices : {}) as Record<
    string,
    unknown
  >;
  const displayed = readNumber(root.displayedPricePerPerson ?? prices.displayedPricePerPerson);
  if (displayed) {
    return { amount: displayed, field: 'upsales.displayedPricePerPerson' };
  }
  // priceTableCalculatedPricePerPerson is table-calc, not selected booking p.p.
  const total = readUpsalesTotal(json);
  if (total && paxCount > 0) {
    return {
      amount: Math.round(total.amount / paxCount),
      field: 'display.totalDividedByPax',
    };
  }
  return null;
}

function readUpsalesTripCode(json: unknown): string {
  const root = readUpsalesRoot(json);
  if (!root) {
    return '';
  }
  return typeof root.extendedTripCode === 'string' ? root.extendedTripCode : '';
}

function readUpsalesDepartureIso(json: unknown): string {
  const root = readUpsalesRoot(json);
  const sel =
    (root?.selectedTripCudl as { selectedTrip?: Record<string, unknown> } | undefined)?.selectedTrip ??
    (root?.selectedTrip as Record<string, unknown> | undefined);
  if (!sel) {
    return '';
  }
  const system = sel.system as { request?: { departureDate?: unknown } } | undefined;
  const trip = sel.trip as { departureDate?: unknown } | undefined;
  const raw = system?.request?.departureDate ?? trip?.departureDate;
  return typeof raw === 'string' ? raw.slice(0, 10) : '';
}

/**
 * Occupancy-specific Corendon live price (Bijbel §8.4 / §10.3).
 * Requires a successful lowestpricesacco hop for tripUrlHash / offer context.
 * Does not present the 2-adult lowest price as a 4-pax quote.
 */
export async function fetchCorendonUpsalesPrice(
  ctx: CorendonLiveContext,
  hop: CorendonLowestHop,
  options: { fetchImpl?: FetchLike } = {},
): Promise<CorendonLivePriceResult> {
  const paxCount = ctx.upsalesPax?.length ?? 0;
  const url = buildCorendonUpsalesUrl(ctx, hop);
  if (!url || paxCount === 0) {
    return { ok: false, reason: 'invalid_context' };
  }

  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(url, {
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

    const displayPp = readUpsalesPricePerPerson(json, paxCount);
    if (displayPp == null) {
      return { ok: false, reason: 'invalid_price', httpStatus: 200 };
    }

    const tripCode = readUpsalesTripCode(json) || hop.tripCode;
    const liveDate = readUpsalesDepartureIso(json) || ctx.departureIso;
    if (!corendonLiveContextMatchesTrip(ctx, tripCode, liveDate)) {
      return { ok: false, reason: 'stale_context', httpStatus: 200 };
    }

    const total = readUpsalesTotal(json);
    return {
      ok: true,
      pricePerPerson: displayPp.amount,
      pricePerPersonField: displayPp.field,
      tripCode,
      source: 'upsales',
      hop,
      ...(total
        ? { totalPrice: total.amount, totalPriceField: total.field }
        : {}),
    };
  } catch (error) {
    if (isTimeoutError(error)) {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'network_error' };
  }
}

export async function fetchCorendonLivePrice(
  ctx: CorendonLiveContext,
  options: { fetchImpl?: FetchLike } = {},
): Promise<CorendonLivePriceResult> {
  const lowest = await fetchCorendonLowestpricesaccoPrice(ctx, options);
  if (!lowest.ok) {
    return lowest;
  }
  if (ctx.pricingRoute !== 'upsales') {
    return lowest;
  }
  if (!lowest.hop) {
    return { ok: false, reason: 'invalid_context' };
  }
  return fetchCorendonUpsalesPrice(ctx, lowest.hop, options);
}
