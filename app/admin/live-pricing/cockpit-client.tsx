'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  LivePricingCockpitSnapshot,
  OpsIncident,
  OwnerDisplayStatus,
  ProviderOpsRow,
} from '@/lib/ops/live-pricing/types';
import {
  applyCockpitIncidentViewFilters,
  humanActionSummary,
  humanProblemSummary,
} from '@/lib/ops/live-pricing/aggregates';
import { buildOpsClientAuthHeaders } from '@/lib/ops/live-pricing/client-auth-headers';
import { rebindSelectedIncident, rebindSelectedProvider } from '@/lib/ops/live-pricing/cockpit-selection';
import {
  CoverageProgress,
  HorizontalBars,
  IncidentDonut,
  RateBar,
  StackedHourlyChart,
  ZONE_COLORS,
} from './cockpit-charts';

/** Attach ?token= from the current URL as Bearer auth for cockpit API fetches. */
function opsFetchAuthHeaders(extra?: Record<string, string>): HeadersInit {
  const fromQuery =
    typeof window !== 'undefined' ? buildOpsClientAuthHeaders(window.location.search) : {};
  return { ...fromQuery, ...extra };
}

type TrendPoint = {
  at: string;
  zone: string;
  attempts: number;
  b: number;
  a: number;
  c: number;
  cRate: number;
  presentableB: number;
};

const STATUS_THEME: Record<
  OwnerDisplayStatus,
  { bg: string; border: string; soft: string }
> = {
  IDLE: { bg: '#f8fafc', border: '#94a3b8', soft: '#e2e8f0' },
  GREEN: { bg: '#ecfdf3', border: '#12b76a', soft: '#d1fadf' },
  YELLOW: { bg: '#fffaeb', border: '#f5a524', soft: '#fef0c7' },
  ORANGE: { bg: '#fff6ed', border: '#f79009', soft: '#fdead7' },
  RED: { bg: '#fef3f2', border: '#f04438', soft: '#fee4e2' },
};

function cardStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 16,
    padding: '1.25rem 1.4rem',
    boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
    ...extra,
  };
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

export function LivePricingOpsCockpitClient({
  initialSnapshot,
  initialTrends,
}: {
  initialSnapshot: LivePricingCockpitSnapshot;
  initialTrends: TrendPoint[];
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [trends, setTrends] = useState(initialTrends);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'24h' | '7d'>('24h');
  const [providerFilter, setProviderFilter] = useState<string>('ALL');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [selectedIncident, setSelectedIncident] = useState<OpsIncident | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderOpsRow | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const theme = STATUS_THEME[snapshot.ownerStatus];
  const periodView = period === '24h' ? snapshot.incidentView24h : snapshot.incidentView7d;
  /** One filtered incident dataset drives counts, timeline, donut, and list (view filter only). */
  const dashboardIncidents = useMemo(
    () =>
      applyCockpitIncidentViewFilters(periodView, {
        provider: providerFilter,
        zone: zoneFilter,
      }),
    [periodView, providerFilter, zoneFilter],
  );
  const incidentCounts = dashboardIncidents.counts;
  const timelineBuckets = dashboardIncidents.timeline;
  const filteredIncidents = dashboardIncidents.incidents;
  const remediationCounts =
    period === '24h' ? snapshot.remediationsLast24h : snapshot.remediationsLast7d;

  const applyCockpitSnapshot = useCallback((next: LivePricingCockpitSnapshot, nextTrends?: TrendPoint[]) => {
    setSnapshot(next);
    if (nextTrends) {
      setTrends(nextTrends);
    }
    setSelectedProvider((prev) => rebindSelectedProvider(prev, next.providers));
    setSelectedIncident((prev) => rebindSelectedIncident(prev, next));
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/live-pricing', {
        cache: 'no-store',
        headers: opsFetchAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
      }
      const data = (await res.json()) as {
        snapshot: LivePricingCockpitSnapshot;
        trends: TrendPoint[];
      };
      applyCockpitSnapshot(data.snapshot, data.trends);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [applyCockpitSnapshot]);

  const simulate = useCallback(
    async (scenario: 'IDLE' | 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'clear') => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/live-pricing/simulate', {
          method: 'POST',
          headers: opsFetchAuthHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify(scenario === 'clear' ? { clear: true } : { scenario }),
        });
        if (!res.ok) {
          throw new Error((await res.json().catch(() => ({}))).error ?? res.statusText);
        }
        // POST snapshot is authoritative — do not GET-refresh (Preview may lose process-local sim).
        const data = (await res.json()) as { snapshot: LivePricingCockpitSnapshot };
        applyCockpitSnapshot(data.snapshot);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [applyCockpitSnapshot],
  );

  const providers = useMemo(() => {
    if (providerFilter === 'ALL') return snapshot.providers;
    return snapshot.providers.filter((p) => p.provider === providerFilter);
  }, [snapshot.providers, providerFilter]);

  const coveragePct = snapshot.coverage.targetB
    ? Math.min(100, (snapshot.coverage.presentableB / snapshot.coverage.targetB) * 100)
    : 0;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(165deg, #0b1220 0%, #152238 45%, #1e293b 100%)',
        color: '#0f172a',
        padding: '1.5rem clamp(1rem, 2vw, 2rem) 3rem',
        fontFamily: 'ui-sans-serif, system-ui, Segoe UI, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Header */}
        <header style={{ marginBottom: '1.25rem', color: '#e2e8f0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: 1.2, fontWeight: 700, color: '#93c5fd' }}>
                VACATIONWEB
              </div>
              <h1 style={{ margin: '0.2rem 0 0', fontSize: 'clamp(1.6rem, 2.4vw, 2.1rem)', fontWeight: 800 }}>
                OWNER OPERATIONS COCKPIT
              </h1>
              <p style={{ margin: '0.25rem 0 0', color: '#94a3b8', fontSize: 15 }}>Live Pricing Operations</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1' }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: snapshot.simulationMode ? '#f5a524' : '#12b76a',
                    boxShadow: snapshot.simulationMode ? '0 0 0 4px rgba(245,165,36,0.25)' : '0 0 0 4px rgba(18,183,106,0.25)',
                  }}
                />
                {snapshot.simulationMode ? 'SIMULATIE' : 'LIVE'}
              </div>
              <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                Update {formatTime(snapshot.generatedAt)}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void refresh()}
                style={{
                  marginTop: 8,
                  background: '#1e293b',
                  color: '#e2e8f0',
                  border: '1px solid #334155',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Vernieuwen
              </button>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {(['24h', '7d'] as const).map((p) => (
              <FilterChip key={p} active={period === p} onClick={() => setPeriod(p)} label={p === '24h' ? '24 uur' : '7 dagen'} />
            ))}
            <FilterChip active={providerFilter === 'ALL'} onClick={() => setProviderFilter('ALL')} label="Alle providers" />
            {['Corendon', 'Sunweb', 'Eliza'].map((p) => (
              <FilterChip key={p} active={providerFilter === p} onClick={() => setProviderFilter(p)} label={p} />
            ))}
            <FilterChip active={zoneFilter === 'ALL'} onClick={() => setZoneFilter('ALL')} label="Alle zones" />
            {(['YELLOW', 'ORANGE', 'RED'] as const).map((z) => (
              <FilterChip key={z} active={zoneFilter === z} onClick={() => setZoneFilter(z)} label={z} />
            ))}
          </div>
          {error ? <p style={{ color: '#fda29b', marginTop: 8, fontWeight: 600 }}>{error}</p> : null}
        </header>

        {/* Status + Action */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <section style={{ ...cardStyle({ background: theme.bg, border: `2px solid ${theme.border}` }) }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: '#64748b' }}>
              HUIDIGE STATUS
            </div>
            <div style={{ fontSize: 'clamp(2.4rem, 4vw, 3.2rem)', fontWeight: 900, marginTop: 8, lineHeight: 1.05 }}>
              {snapshot.ownerHeadline.emoji} {snapshot.ownerHeadline.title}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8, color: '#1e293b' }}>
              {snapshot.ownerHeadline.subtitle}
            </div>
            <p style={{ margin: '10px 0 0', color: '#475569', fontSize: 14 }}>{snapshot.overallHealth}</p>
            <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 12 }}>
              Technisch: {snapshot.technicalHealthZone} · Product: {snapshot.productGoalMet ? '150 B gehaald' : '150 B niet gehaald'}
            </p>
          </section>

          <section
            style={{
              ...cardStyle({
                background: snapshot.actionRequired.needed ? STATUS_THEME.ORANGE.bg : STATUS_THEME.GREEN.bg,
                border: `2px solid ${snapshot.actionRequired.needed ? STATUS_THEME.ORANGE.border : STATUS_THEME.GREEN.border}`,
              }),
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.8, color: '#64748b' }}>
              MOET IK IETS DOEN?
            </div>
            <div style={{ fontSize: 'clamp(2.8rem, 5vw, 3.6rem)', fontWeight: 900, marginTop: 8, lineHeight: 1 }}>
              {snapshot.actionRequired.answer}
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 16, fontWeight: 600, color: '#1e293b', lineHeight: 1.35 }}>
              {snapshot.actionRequired.detail}
            </p>
          </section>
        </div>

        {/* 24h incident counts */}
        <section style={{ ...cardStyle(), marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            <h2 style={h2}>Incidenten — {period === '24h' ? 'laatste 24 uur' : 'laatste 7 dagen'}</h2>
            <span style={{ fontSize: 12, color: '#64748b' }}>Totaal {incidentCounts.total}</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 12,
              marginBottom: 18,
            }}
          >
            {(
              [
                ['GREEN', incidentCounts.GREEN],
                ['YELLOW', incidentCounts.YELLOW],
                ['ORANGE', incidentCounts.ORANGE],
                ['RED', incidentCounts.RED],
              ] as const
            ).map(([z, n]) => (
              <div
                key={z}
                style={{
                  background: STATUS_THEME[z].soft,
                  border: `1px solid ${STATUS_THEME[z].border}`,
                  borderRadius: 14,
                  padding: '1rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
                  {z === 'GREEN' ? '🟢' : z === 'YELLOW' ? '🟡' : z === 'ORANGE' ? '🟠' : '🔴'} {z}
                </div>
                <div style={{ fontSize: 40, fontWeight: 900, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{n}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.6fr) minmax(220px, 0.7fr)',
              gap: 20,
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Tijdlijn ({dashboardIncidents.timelineGranularity === 'hour' ? 'per uur' : 'per dag'})
              </div>
              <StackedHourlyChart
                buckets={timelineBuckets}
                granularity={dashboardIncidents.timelineGranularity}
                emptyLabel="Geen incidenten in deze periode"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <IncidentDonut counts={incidentCounts} />
              <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>
                Verdeling {period === '24h' ? '24u' : '7d'} ·{' '}
                {(['GREEN', 'YELLOW', 'ORANGE', 'RED'] as const).map((z) => (
                  <span key={z} style={{ marginRight: 6 }}>
                    <span style={{ color: ZONE_COLORS[z] }}>●</span> {z[0]}
                    {incidentCounts.total
                      ? ` ${Math.round((incidentCounts[z] / incidentCounts.total) * 100)}%`
                      : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 11, color: '#94a3b8' }}>{snapshot.incidentCountRule}</p>
        </section>

        {/* Coverage + BAC */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <section style={cardStyle()}>
            <h2 style={h2}>Live Coverage — 150 presentable B</h2>
            <div style={{ fontSize: 'clamp(2.6rem, 4vw, 3.4rem)', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
              {snapshot.coverage.presentableB} / {snapshot.coverage.targetB} B
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: snapshot.coverage.deficit > 0 ? '#b54708' : '#027a48', margin: '6px 0 12px' }}>
              {snapshot.coverage.deficit > 0
                ? `${snapshot.coverage.deficit} B nog nodig`
                : 'Productdoel gehaald'}
            </div>
            <CoverageProgress
              presentableB={snapshot.coverage.presentableB}
              targetB={snapshot.coverage.targetB}
            />
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                marginTop: 14,
                fontSize: 13,
                color: '#475569',
              }}
            >
              <Pill>
                S6 {snapshot.coverage.s6Active ? 'ACTIVE' : 'INACTIVE'}
              </Pill>
              <Pill>Stop: {snapshot.coverage.s6StopReason ?? '—'}</Pill>
              <Pill>{coveragePct.toFixed(0)}%</Pill>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#64748b', lineHeight: 1.45 }}>
              {snapshot.productCoverageLabel}
              <br />
              Verwerkt {snapshot.coverage.catalogCandidatesConsumed} · B-hint cache{' '}
              {snapshot.coverage.bFromCacheHint} · HTTP {snapshot.coverage.httpCallsHint} · skip ctx{' '}
              {snapshot.coverage.skippedMissingContext} · skip circuit {snapshot.coverage.skippedCircuitOpen}
            </div>
          </section>

          <section style={cardStyle()}>
            <h2 style={h2}>B / A / C</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
              <RateBar label="B — live prijs" count={snapshot.bac.b} rate={snapshot.bac.bRate} color="#12b76a" />
              <RateBar label="A — unavailable" count={snapshot.bac.a} rate={snapshot.bac.aRate} color="#98a2b3" />
              <RateBar label="C — technisch" count={snapshot.bac.c} rate={snapshot.bac.cRate} color="#f04438" />
            </div>
            <div style={{ marginTop: 16, fontSize: 14, color: '#475569' }}>
              Attempts: <strong>{snapshot.bac.attempts}</strong>
              {snapshot.bac.unpriced > 0 ? ` · Unpriced ${snapshot.bac.unpriced}` : ''}
            </div>
          </section>
        </div>

        {/* Providers */}
        <section style={{ ...cardStyle(), marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <h2 style={h2}>Provider health</h2>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              Concurrency vast: Corendon {snapshot.concurrencyGuard.corendon} · Sunweb{' '}
              {snapshot.concurrencyGuard.sunweb} · Eliza {snapshot.concurrencyGuard.eliza}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginTop: 8,
            }}
          >
            {providers.map((p) => (
              <button
                key={p.provider}
                type="button"
                onClick={() => setSelectedProvider(p)}
                style={{
                  textAlign: 'left',
                  ...cardStyle({
                    padding: '1rem',
                    border: `1px solid ${STATUS_THEME[p.zone].border}`,
                    background: STATUS_THEME[p.zone].bg,
                    cursor: 'pointer',
                  }),
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>{p.provider.toUpperCase()}</div>
                <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>
                  {p.zone === 'GREEN' ? '🟢' : p.zone === 'YELLOW' ? '🟡' : p.zone === 'ORANGE' ? '🟠' : '🔴'}{' '}
                  {(p.bRate * 100).toFixed(0)}% B
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>
                  A {(p.aRate * 100).toFixed(0)}% · C {(p.cRate * 100).toFixed(0)}% · {p.attempts} att
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  p50 {p.latencyP50Ms ?? '—'} · p95 {p.latencyP95Ms ?? '—'} · circuit {p.circuitState}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                  Open providerdetail
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* C errors + auto actions */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 16,
            marginBottom: 16,
          }}
        >
          <section style={cardStyle()}>
            <h2 style={h2}>C-fouten (transport subtypes)</h2>
            {snapshot.cSubtypes.length === 0 ? (
              <p style={{ color: '#64748b', margin: 0 }}>Geen geregistreerde transport subtypes.</p>
            ) : (
              <HorizontalBars
                rows={snapshot.cSubtypes.map((s) => ({
                  label: s.code,
                  count: s.count,
                  pct: s.percentage,
                }))}
              />
            )}
          </section>

          <section style={cardStyle()}>
            <h2 style={h2}>Automatische acties — {period === '24h' ? '24u' : '7d'}</h2>
            {remediationCounts.length === 0 ? (
              <p style={{ color: '#64748b', margin: 0 }}>Nog geen geregistreerde acties in dit venster.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {remediationCounts.map((r) => (
                  <div
                    key={r.playbookId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#f8fafc',
                      borderRadius: 10,
                      padding: '10px 12px',
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</span>
                    <span style={{ fontSize: 22, fontWeight: 800 }}>{r.count}</span>
                  </div>
                ))}
              </div>
            )}
            <p style={{ marginTop: 14, fontWeight: 700, color: snapshot.humanActionRequired ? '#b54708' : '#027a48' }}>
              {snapshot.humanActionRequired
                ? 'Menselijke actie vereist'
                : 'Alle acties automatisch uitgevoerd / geen actie nodig'}
            </p>
            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
              Nooit automatisch: concurrency, timeouts, circuit thresholds, architectuur.
            </p>
          </section>
        </div>

        {/* Recent incidents */}
        <section style={{ ...cardStyle(), marginBottom: 16 }}>
          <h2 style={h2}>Incidenten in periode ({period === '24h' ? '24u' : '7d'})</h2>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b' }}>
            Klik op <strong>Detail</strong> voor audit. AUTO-RESOLVED blijft zichtbaar binnen de periode.
          </p>
          {filteredIncidents.length === 0 ? (
            <p style={{ color: '#64748b', margin: 0 }}>Geen incidenten voor deze filters.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#64748b' }}>
                    {['Tijd', 'Zone', 'Provider', 'Probleem', 'Actie', 'Status', 'Duur', ''].map((h) => (
                      <th key={h || 'detail'} style={{ padding: '8px 10px', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredIncidents.slice(0, 40).map((inc) => (
                    <tr key={inc.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px' }}>{formatTime(inc.startedAt)}</td>
                      <td style={{ padding: '10px', fontWeight: 700 }}>
                        {inc.zoneAtDetection === 'YELLOW'
                          ? '🟡'
                          : inc.zoneAtDetection === 'ORANGE'
                            ? '🟠'
                            : inc.zoneAtDetection === 'RED'
                              ? '🔴'
                              : '🟢'}{' '}
                        {inc.zoneAtDetection}
                      </td>
                      <td style={{ padding: '10px' }}>{inc.provider ?? 'overall'}</td>
                      <td style={{ padding: '10px', maxWidth: 280 }}>{humanProblemSummary(inc)}</td>
                      <td style={{ padding: '10px' }}>{humanActionSummary(inc)}</td>
                      <td style={{ padding: '10px', fontWeight: 700 }}>{inc.status}</td>
                      <td style={{ padding: '10px' }}>{formatDuration(inc.recoveryDurationMs)}</td>
                      <td style={{ padding: '10px' }}>
                        <button
                          type="button"
                          data-testid={`incident-detail-${inc.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedIncident(inc);
                          }}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            fontWeight: 700,
                            fontSize: 12,
                            borderRadius: 8,
                            padding: '6px 10px',
                            cursor: 'pointer',
                          }}
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Trends */}
        <section style={{ ...cardStyle(), marginBottom: 16 }}>
          <h2 style={h2}>Trend (process window)</h2>
          {trends.length < 2 ? (
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
              Nog onvoldoende betrouwbare historie voor een langetermijntrend. Punten komen binnen zodra ops
              evalueert. Geen fictieve data.
            </p>
          ) : (
            <pre
              style={{
                margin: 0,
                fontSize: 11,
                background: '#0f172a',
                color: '#cbd5e1',
                padding: 12,
                borderRadius: 10,
                overflow: 'auto',
                maxHeight: 160,
              }}
            >
              {trends
                .slice(-16)
                .map(
                  (t) =>
                    `${t.at.slice(11, 19)}  ${t.zone.padEnd(6)}  C=${(t.cRate * 100).toFixed(1)}%  Bcov=${t.presentableB}`,
                )
                .join('\n')}
            </pre>
          )}
        </section>

        {/* Collapsible sections — native <details> so open/close works without broken hydration */}
        <section style={{ ...cardStyle(), marginBottom: 12, padding: 0, overflow: 'hidden' }}>
          <details data-testid="ops-tech-details">
            <summary style={expandSummary}>
              Technische details (thresholds, kanalen, raw remediations)
            </summary>
            <div style={{ padding: '0 1.25rem 1.25rem', fontSize: 12, color: '#475569' }}>
              <p>
                Circuits open: {snapshot.circuits.openCount} · workset skips:{' '}
                {snapshot.circuits.worksetSkippedCircuitOpen} · missing context:{' '}
                {snapshot.missingContext.skipped}
              </p>
              <p>
                Notificatiekanalen:{' '}
                {snapshot.notificationChannels.map((c) => `${c.id}:${c.live ? 'LIVE' : 'niet-live'}`).join(' · ')}
              </p>
              <ul>
                {snapshot.thresholds.slice(0, 8).map((t) => (
                  <li key={t.id}>
                    {t.id} [{t.evidenceStatus}] thr={t.threshold}
                  </li>
                ))}
              </ul>
            </div>
          </details>
        </section>

        <section style={{ ...cardStyle(), padding: 0, overflow: 'hidden' }}>
          <details data-testid="ops-test-controls">
            <summary style={expandSummary}>Owner / Test controls (simulatie)</summary>
            <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(['IDLE', 'GREEN', 'YELLOW', 'ORANGE', 'RED'] as const).map((s) => (
                <button key={s} type="button" disabled={busy} onClick={() => void simulate(s)} style={testBtn}>
                  Test {s}
                </button>
              ))}
              <button type="button" disabled={busy} onClick={() => void simulate('clear')} style={testBtn}>
                Clear simulation
              </button>
            </div>
          </details>
        </section>
      </div>

      {portalReady && selectedIncident
        ? createPortal(
            <Modal title={`Incident ${selectedIncident.id}`} onClose={() => setSelectedIncident(null)}>
              <dl style={dlStyle}>
                <Row k="Status" v={selectedIncident.status} />
                <Row k="Zone detectie → nu" v={`${selectedIncident.zoneAtDetection} → ${selectedIncident.currentZone}`} />
                <Row k="Start" v={formatTime(selectedIncident.startedAt)} />
                <Row k="Einde" v={formatTime(selectedIncident.endedAt)} />
                <Row k="Provider" v={selectedIncident.provider ?? 'overall'} />
                <Row k="Metric" v={`${selectedIncident.metric} = ${selectedIncident.actualValue} (thr ${selectedIncident.threshold})`} />
                <Row k="B/A/C" v={`${selectedIncident.bCount}/${selectedIncident.aCount}/${selectedIncident.cCount} (att ${selectedIncident.attempts})`} />
                <Row k="Coverage" v={`${selectedIncident.coveragePresentableB}/${selectedIncident.coverageTargetB} B`} />
                <Row k="C-subtype" v={selectedIncident.cSubtype ?? '—'} />
                <Row k="Oorzaak" v={selectedIncident.cause ?? '—'} />
                <Row k="Actie" v={selectedIncident.autoAction ?? '—'} />
                <Row k="Resultaat" v={selectedIncident.actionResult ?? '—'} />
                <Row k="Notificatie" v={selectedIncident.notified ? 'ja' : 'nee'} />
                <Row k="Escalatie" v={selectedIncident.escalated ? 'ja' : 'nee'} />
                <Row k="Herstelduur" v={formatDuration(selectedIncident.recoveryDurationMs)} />
              </dl>
              <h3 style={{ fontSize: 14, marginTop: 16 }}>Audit trail</h3>
              <ol style={{ fontSize: 12, color: '#475569', paddingLeft: 18 }}>
                {(selectedIncident.story ?? []).map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </Modal>,
            document.body,
          )
        : null}

      {portalReady && selectedProvider
        ? createPortal(
            <Modal title={`Provider ${selectedProvider.provider}`} onClose={() => setSelectedProvider(null)}>
              <dl style={dlStyle}>
                <Row k="Zone" v={selectedProvider.zone} />
                <Row k="Attempts" v={String(selectedProvider.attempts)} />
                <Row k="B / A / C" v={`${selectedProvider.b} / ${selectedProvider.a} / ${selectedProvider.c}`} />
                <Row
                  k="Rates"
                  v={`B ${(selectedProvider.bRate * 100).toFixed(1)}% · A ${(selectedProvider.aRate * 100).toFixed(1)}% · C ${(selectedProvider.cRate * 100).toFixed(1)}%`}
                />
                <Row k="Latency p50/p95" v={`${selectedProvider.latencyP50Ms ?? '—'} / ${selectedProvider.latencyP95Ms ?? '—'} ms`} />
                <Row k="Circuit" v={selectedProvider.circuitState} />
                <Row k="Transport errors" v={String(selectedProvider.transportErrors)} />
                <Row
                  k="Codes"
                  v={
                    Object.entries(selectedProvider.transportErrorCodes)
                      .map(([k, v]) => `${k}:${v}`)
                      .join(', ') || '—'
                  }
                />
              </dl>
            </Modal>,
            document.body,
          )
        : null}
    </main>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? '#e2e8f0' : 'rgba(255,255,255,0.08)',
        color: active ? '#0f172a' : '#cbd5e1',
        border: active ? '1px solid #cbd5e1' : '1px solid #334155',
        borderRadius: 999,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: '#f1f5f9',
        borderRadius: 999,
        padding: '4px 10px',
        fontWeight: 600,
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          ...cardStyle({ maxWidth: 640, width: '100%', maxHeight: '85vh', overflow: 'auto' }),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Sluiten
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt style={{ fontWeight: 700, color: '#64748b' }}>{k}</dt>
      <dd style={{ margin: '0 0 8px', color: '#0f172a' }}>{v}</dd>
    </>
  );
}

const h2: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 800,
  color: '#0f172a',
};

const expandSummary: React.CSSProperties = {
  width: '100%',
  display: 'list-item',
  boxSizing: 'border-box',
  background: '#fff',
  border: 'none',
  borderBottom: '1px solid #f1f5f9',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
  padding: '1rem 1.25rem',
  fontSize: 14,
  textAlign: 'left',
};

const ghostBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#334155',
  fontWeight: 700,
  cursor: 'pointer',
  padding: '6px 10px',
  fontSize: 14,
};

const testBtn: React.CSSProperties = {
  background: '#0f172a',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 12px',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: 13,
};

const dlStyle: React.CSSProperties = { margin: 0 };
