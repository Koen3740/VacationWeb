import { NextRequest, NextResponse } from 'next/server';
import {
  isDefinitiveSearchParams,
  isHomeLivePricePrefetchEnabled,
  scheduleHomeLivePricePrefetch,
  searchParamsFromResultsHref,
} from '@/lib/search/home-live-price-prefetch';
import { attachSiteMarket } from '@/lib/search/site-market';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * AN-077 — Homepage live-price prefetch.
 * Returns immediately (202). Work continues via waitUntil / schedule helper.
 * Does not block homepage navigation.
 */
export async function POST(req: NextRequest) {
  if (!isHomeLivePricePrefetchEnabled()) {
    return NextResponse.json(
      { ok: true, accepted: false, reason: 'flag_off' },
      { status: 202 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const href = typeof record.href === 'string' ? record.href : '';
  if (!href.startsWith('/results?')) {
    return NextResponse.json({ ok: false, error: 'bad_href' }, { status: 400 });
  }

  const generation =
    typeof record.generation === 'number' && Number.isFinite(record.generation)
      ? Math.floor(record.generation)
      : 0;

  const params = attachSiteMarket(
    searchParamsFromResultsHref(href),
    req.headers.get('x-forwarded-host') ?? req.headers.get('host'),
  );

  if (!isDefinitiveSearchParams(params)) {
    return NextResponse.json(
      { ok: true, accepted: false, reason: 'not_definitive', generation },
      { status: 202 },
    );
  }

  const result = scheduleHomeLivePricePrefetch(params, { generation });
  return NextResponse.json(
    {
      ok: true,
      accepted: result.accepted,
      reason: result.reason,
      generation: result.generation,
    },
    { status: 202 },
  );
}
