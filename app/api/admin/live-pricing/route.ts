import { NextRequest, NextResponse } from 'next/server';
import {
  assertOpsAuthorized,
  getLivePricingCockpitSnapshot,
  listOpsTrends,
} from '@/lib/ops/live-pricing';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = assertOpsAuthorized(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const snapshot = getLivePricingCockpitSnapshot();
  return NextResponse.json({
    snapshot,
    trends: listOpsTrends(),
  });
}
