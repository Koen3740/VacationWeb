import {
  PRIJSVRIJ_FILTER_TYPE,
  PRIJSVRIJ_RECEIPT_BASE_URL,
  PRIJSVRIJ_RECEIPT_TIMEOUT_MS,
} from './constants';
import { getPrijsvrijReceiptToken, type FetchLike } from './receipt-auth';
import {
  computePrijsvrijReceiptPricePerPerson,
  type PrijsvrijReceiptPriceInfo,
} from './receipt-price';

export type PrijsvrijReceiptFilter = {
  Type: number;
  UrlName: string;
  Value: string;
};

export type PrijsvrijReceiptRequestContext = {
  hotelId: string;
  /** Path date YYYYMMDD */
  departureYmd: string;
  /** Path duration in days */
  durationDays: number;
  filters: PrijsvrijReceiptFilter[];
  /** Optional Cookie header value (no invented ages). */
  cookieHeader?: string;
};

export type PrijsvrijReceiptCallResult =
  | {
      ok: true;
      price: PrijsvrijReceiptPriceInfo;
      httpStatus: number;
    }
  | {
      ok: false;
      reason:
        | 'empty_receipt'
        | 'missing_package'
        | 'invalid_total'
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

function buildReceiptUrl(ctx: PrijsvrijReceiptRequestContext): string {
  return `${PRIJSVRIJ_RECEIPT_BASE_URL}/${encodeURIComponent(ctx.hotelId)}/receipt/${ctx.departureYmd}/${ctx.durationDays}`;
}

async function postReceipt(
  token: string,
  ctx: PrijsvrijReceiptRequestContext,
  fetchImpl: FetchLike,
): Promise<{ status: number; json: unknown }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (ctx.cookieHeader) {
    headers.Cookie = ctx.cookieHeader;
  }

  const response = await fetchImpl(buildReceiptUrl(ctx), {
    method: 'POST',
    headers,
    body: JSON.stringify(ctx.filters),
    signal: AbortSignal.timeout(PRIJSVRIJ_RECEIPT_TIMEOUT_MS),
    cache: 'no-store',
  });

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { status: response.status, json };
}

function classifyReceiptJson(json: unknown): PrijsvrijReceiptCallResult {
  if (json == null || typeof json !== 'object') {
    return { ok: false, reason: 'empty_receipt', httpStatus: 200 };
  }

  const record = json as Record<string, unknown>;
  if (Object.keys(record).length === 0) {
    return { ok: false, reason: 'empty_receipt', httpStatus: 200 };
  }

  const receipt = record.Receipt;
  const pkg =
    receipt && typeof receipt === 'object'
      ? (receipt as { Package?: unknown }).Package
      : record.Package;

  if (!pkg || typeof pkg !== 'object') {
    return { ok: false, reason: 'missing_package', httpStatus: 200 };
  }

  const price = computePrijsvrijReceiptPricePerPerson(
    pkg as Parameters<typeof computePrijsvrijReceiptPricePerPerson>[0],
  );
  if (!price) {
    return { ok: false, reason: 'invalid_total', httpStatus: 200 };
  }

  return { ok: true, price, httpStatus: 200 };
}

/**
 * Server-side Receipt call: Bearer + filter body.
 * On HTTP 401: refresh token once and retry.
 */
export async function fetchPrijsvrijReceiptPrice(
  ctx: PrijsvrijReceiptRequestContext,
  options: { fetchImpl?: FetchLike } = {},
): Promise<PrijsvrijReceiptCallResult> {
  if (!ctx.hotelId || !ctx.departureYmd || !ctx.durationDays || ctx.durationDays <= 0) {
    return { ok: false, reason: 'invalid_context' };
  }
  if (!Array.isArray(ctx.filters) || ctx.filters.length === 0) {
    // Body {} → 500; never send empty object.
    return { ok: false, reason: 'invalid_context' };
  }

  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    let token = await getPrijsvrijReceiptToken(fetchImpl);
    let response = await postReceipt(token, ctx, fetchImpl);

    if (response.status === 401) {
      token = await getPrijsvrijReceiptToken(fetchImpl, Date.now(), true);
      response = await postReceipt(token, ctx, fetchImpl);
    }

    if (response.status === 401) {
      return { ok: false, reason: 'http_error', httpStatus: 401 };
    }

    if (response.status !== 200) {
      return { ok: false, reason: 'http_error', httpStatus: response.status };
    }

    return classifyReceiptJson(response.json);
  } catch (error) {
    if (isTimeoutError(error)) {
      return { ok: false, reason: 'timeout' };
    }
    return { ok: false, reason: 'network_error' };
  }
}

/** Build proven Receipt filter array from discrete context fields. */
export function buildPrijsvrijReceiptFilters(input: {
  departureYmd: string;
  durationDays: number;
  transport: string;
  airportCode?: string;
}): PrijsvrijReceiptFilter[] {
  const month = input.departureYmd.slice(0, 6);
  const filters: PrijsvrijReceiptFilter[] = [
    {
      Type: PRIJSVRIJ_FILTER_TYPE.vertrekdatum,
      UrlName: 'vertrekdatum',
      Value: input.departureYmd,
    },
    {
      Type: PRIJSVRIJ_FILTER_TYPE.vertrekmaand,
      UrlName: 'vertrekmaand',
      Value: month,
    },
    {
      Type: PRIJSVRIJ_FILTER_TYPE.transport,
      UrlName: 'transport',
      Value: input.transport,
    },
  ];

  // Path covers duration; reisduur 6_10 proven for 6–10 day audits; omit otherwise.
  if (input.durationDays >= 6 && input.durationDays <= 10) {
    filters.splice(1, 0, {
      Type: PRIJSVRIJ_FILTER_TYPE.reisduur,
      UrlName: 'reisduur',
      Value: '6_10',
    });
  }

  if (input.airportCode) {
    filters.push({
      Type: PRIJSVRIJ_FILTER_TYPE.luchthaven,
      UrlName: 'luchthaven',
      Value: input.airportCode,
    });
  }

  return filters;
}
