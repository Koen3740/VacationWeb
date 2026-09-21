'use client';

import type { HourlyIncidentBucket, IncidentZoneCounts } from '@/lib/ops/live-pricing/types';

export const ZONE_COLORS = {
  GREEN: '#12b76a',
  YELLOW: '#f5a524',
  ORANGE: '#f79009',
  RED: '#f04438',
  IDLE: '#94a3b8',
} as const;

export function StackedHourlyChart({
  buckets,
  height = 200,
  emptyLabel = 'Geen incidenten in deze periode',
  granularity = 'hour',
}: {
  buckets: HourlyIncidentBucket[];
  height?: number;
  emptyLabel?: string;
  granularity?: 'hour' | 'day';
}) {
  const width = 720;
  const pad = { top: 12, right: 8, bottom: 28, left: 28 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const total = buckets.reduce((s, b) => s + b.GREEN + b.YELLOW + b.ORANGE + b.RED, 0);
  const max = Math.max(1, ...buckets.map((b) => b.GREEN + b.YELLOW + b.ORANGE + b.RED));
  const barW = innerW / Math.max(buckets.length, 1);

  if (total === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          fontSize: 14,
          background: '#f8fafc',
          borderRadius: 12,
          border: '1px dashed #e2e8f0',
        }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={`Incidenten tijdlijn (${total} totaal)`}
    >
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = pad.top + innerH * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
              {Math.round(max * f)}
            </text>
          </g>
        );
      })}
      {buckets.map((b, i) => {
        const x = pad.left + i * barW + barW * 0.15;
        const w = barW * 0.7;
        let y = pad.top + innerH;
        const parts: { key: keyof typeof ZONE_COLORS; n: number }[] = [
          { key: 'GREEN', n: b.GREEN },
          { key: 'YELLOW', n: b.YELLOW },
          { key: 'ORANGE', n: b.ORANGE },
          { key: 'RED', n: b.RED },
        ];
        const d = new Date(b.hourStart);
        const label =
          granularity === 'day'
            ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
            : String(d.getHours()).padStart(2, '0');
        const showLabel = granularity === 'day' ? true : i % Math.max(1, Math.ceil(buckets.length / 8)) === 0;
        return (
          <g key={b.hourStart}>
            {parts.map((p) => {
              if (p.n <= 0) return null;
              const h = (p.n / max) * innerH;
              y -= h;
              return (
                <rect
                  key={p.key}
                  x={x}
                  y={y}
                  width={w}
                  height={Math.max(h, 0)}
                  fill={ZONE_COLORS[p.key]}
                  rx={2}
                />
              );
            })}
            {showLabel ? (
              <text x={x + w / 2} y={height - 8} textAnchor="middle" fontSize={10} fill="#6b7280">
                {label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

export function IncidentDonut({
  counts,
  size = 160,
}: {
  counts: IncidentZoneCounts;
  size?: number;
}) {
  const total = Math.max(counts.total, 0);
  const segments = [
    { key: 'GREEN' as const, n: counts.GREEN },
    { key: 'YELLOW' as const, n: counts.YELLOW },
    { key: 'ORANGE' as const, n: counts.ORANGE },
    { key: 'RED' as const, n: counts.RED },
  ];
  const r = 54;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 18;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  if (total === 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight={700} fill="#111827">
          0
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill="#6b7280">
          incidenten
        </text>
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Incidentverdeling">
      <g transform={`rotate(-90 ${cx} ${cy})`}>
        {segments.map((s) => {
          if (s.n <= 0) return null;
          const len = (s.n / total) * circ;
          const el = (
            <circle
              key={s.key}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={ZONE_COLORS[s.key]}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${circ - len}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </g>
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight={700} fill="#111827">
        {total}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill="#6b7280">
        incidenten
      </text>
    </svg>
  );
}

export function HorizontalBars({
  rows,
}: {
  rows: { label: string; count: number; pct?: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: '#111827' }}>{r.label}</span>
            <span style={{ color: '#6b7280' }}>
              {r.count}
              {typeof r.pct === 'number' ? ` · ${(r.pct * 100).toFixed(0)}%` : ''}
            </span>
          </div>
          <div style={{ height: 12, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
            <div
              style={{
                width: `${(r.count / max) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #f97066, #f04438)',
                borderRadius: 999,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CoverageProgress({
  presentableB,
  targetB,
}: {
  presentableB: number;
  targetB: number;
}) {
  const pct = Math.min(100, targetB > 0 ? (presentableB / targetB) * 100 : 0);
  const met = presentableB >= targetB;
  return (
    <div>
      <div
        style={{
          height: 22,
          background: '#eef2ff',
          borderRadius: 999,
          overflow: 'hidden',
          border: '1px solid #e0e7ff',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: met
              ? 'linear-gradient(90deg, #32d583, #12b76a)'
              : 'linear-gradient(90deg, #84caff, #2e90fa)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>{pct.toFixed(0)}% van productdoel</div>
    </div>
  );
}

export function RateBar({
  label,
  count,
  rate,
  color,
}: {
  label: string;
  count: number;
  rate: number;
  color: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 800, color: '#0f172a', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {(rate * 100).toFixed(0)}%
      </div>
      <div style={{ fontSize: 14, color: '#64748b', margin: '4px 0 8px' }}>{count} offers</div>
      <div style={{ height: 10, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, rate * 100)}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}
