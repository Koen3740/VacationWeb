import { cookies } from 'next/headers';
import {
  assertOpsAuthorized,
  getLivePricingCockpitSnapshot,
  listOpsTrends,
} from '@/lib/ops/live-pricing';
import { LivePricingOpsCockpitClient } from './cockpit-client';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Live Pricing Ops | VacationWeb',
  robots: { index: false, follow: false },
};

export default function LivePricingOpsPage({
  searchParams,
}: {
  searchParams?: { token?: string; unauthorized?: string };
}) {
  const cookieStore = cookies();
  const auth = assertOpsAuthorized({
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === 'x-ops-token') {
          return searchParams?.token ?? null;
        }
        return null;
      },
    },
    url: searchParams?.token
      ? `http://localhost/admin/live-pricing?token=${encodeURIComponent(searchParams.token)}`
      : 'http://localhost/admin/live-pricing',
    cookies: {
      get: (name: string) => {
        const v = cookieStore.get(name);
        return v ? { value: v.value } : undefined;
      },
    },
  });

  if (!auth.ok) {
    return (
      <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720, color: '#e2e8f0' }}>
        <h1>Live Pricing Ops</h1>
        <p>{auth.message}</p>
        <p style={{ color: '#94a3b8' }}>
          Pass owner token via <code>?token=</code>, header <code>Authorization: Bearer …</code>, or cookie{' '}
          <code>live_pricing_ops_token</code>.
        </p>
      </main>
    );
  }

  const snapshot = getLivePricingCockpitSnapshot();
  const trends = listOpsTrends();

  return <LivePricingOpsCockpitClient initialSnapshot={snapshot} initialTrends={trends} />;
}
