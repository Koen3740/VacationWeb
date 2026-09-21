import { NextRequest, NextResponse } from 'next/server';
import {
  assertOpsAuthorized,
  clearOpsSimulation,
  runOpsSimulation,
  type SimulatedOpsInput,
} from '@/lib/ops/live-pricing';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = assertOpsAuthorized(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  let body: Partial<SimulatedOpsInput> & { clear?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  if (body.clear) {
    const snapshot = clearOpsSimulation();
    return NextResponse.json({ ok: true, cleared: true, snapshot });
  }

  const scenario = body.scenario ?? 'GREEN';
  const snapshot = runOpsSimulation(scenario, body);
  return NextResponse.json({ ok: true, scenario, snapshot });
}
