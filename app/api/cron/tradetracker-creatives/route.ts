import { timingSafeEqual } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { refreshTradeTrackerCreatives } from '@/lib/tradetracker/promotions/refresh-creatives';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${secret}`;
  const left = Buffer.from(header);
  const right = Buffer.from(expected);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Daily creative refresh. Vercel Cron sends Authorization: Bearer CRON_SECRET.
 * Missing or wrong credentials refuse the run. The handler writes under /tmp
 * and publishes to the existing creative object-storage keys only after success.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: 'refused' }, { status: 401 });
  }
  if (!authorized(request, secret)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const summary = await refreshTradeTrackerCreatives({
      root: path.join(os.tmpdir(), 'vw-tradetracker-creatives'),
      requireRemote: true,
    });
    console.log(JSON.stringify({ event: 'tradetracker-creatives-refresh', ...summary }));
    return Response.json(summary, { status: summary.ok ? 200 : 500 });
  } catch {
    console.log(JSON.stringify({ event: 'tradetracker-creatives-refresh', ok: false, error: 'refresh_failed' }));
    return Response.json({ ok: false, error: 'refresh_failed' }, { status: 500 });
  }
}
