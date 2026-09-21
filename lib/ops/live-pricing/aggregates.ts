/**
 * N-065.1 — Canonical incident period aggregates.
 * One filtered dataset drives zone-counts, donut, and timeline (no divergent windows).
 */

import type {
  HourlyIncidentBucket,
  IncidentZoneCounts,
  OpsIncident,
  RemediationLogEntry,
  RemediationTypeCount,
} from './types';

const PLAYBOOK_LABELS: Record<string, string> = {
  continue_s6_cursor: 'S6 cursor voortgezet',
  reuse_cache_b: 'Cache B hergebruikt',
  respect_circuit_skip: 'Circuit gerespecteerd',
  skip_missing_context: 'Missing context overgeslagen',
  isolate_provider_fault: 'Provider fault geïsoleerd',
  protect_no_config_change: 'Bescherming (geen config-wijziging)',
  collect_telemetry: 'Telemetry verzameld',
};

export const INCIDENT_COUNT_RULE =
  'Telling = alle incidents met startedAt in [now−venster, now], gegroepeerd op zoneAtDetection (OPEN, AUTO-RESOLVED, ESCALATED, CLOSED). Counts, donut en tijdlijn gebruiken dezelfde gefilterde set.';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type IncidentPeriod = '24h' | '7d';

export type IncidentTimelineBucket = HourlyIncidentBucket & {
  /** hour | day label for axis */
  granularity: 'hour' | 'day';
};

export type IncidentPeriodAggregate = {
  period: IncidentPeriod;
  sinceMs: number;
  untilMs: number;
  /** Canonical filtered incidents (all statuses). */
  incidents: OpsIncident[];
  counts: IncidentZoneCounts;
  timeline: IncidentTimelineBucket[];
  timelineGranularity: 'hour' | 'day';
};

function emptyCounts(): IncidentZoneCounts {
  return { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0, total: 0 };
}

function emptyBucket(bucketStart: string, granularity: 'hour' | 'day'): IncidentTimelineBucket {
  return {
    hourStart: bucketStart,
    granularity,
    GREEN: 0,
    YELLOW: 0,
    ORANGE: 0,
    RED: 0,
  };
}

function bumpZone(
  target: { GREEN: number; YELLOW: number; ORANGE: number; RED: number; total?: number },
  zone: string,
): void {
  if (zone === 'GREEN' || zone === 'YELLOW' || zone === 'ORANGE' || zone === 'RED') {
    target[zone] += 1;
    if (typeof target.total === 'number') {
      target.total += 1;
    }
  }
}

/** Parse startedAt; invalid → NaN. */
export function incidentStartedAtMs(incident: Pick<OpsIncident, 'startedAt'>): number {
  return Date.parse(incident.startedAt);
}

/**
 * Filter incidents into an inclusive rolling window [sinceMs, untilMs].
 * Status (AUTO-RESOLVED / ESCALATED / …) does not exclude.
 */
export function filterIncidentsInWindow(
  incidents: readonly OpsIncident[],
  sinceMs: number,
  untilMs: number,
): OpsIncident[] {
  const out: OpsIncident[] = [];
  for (const inc of incidents) {
    const t = incidentStartedAtMs(inc);
    if (!Number.isFinite(t)) {
      continue;
    }
    if (t < sinceMs || t > untilMs) {
      continue;
    }
    out.push(inc);
  }
  return out;
}

export function countIncidentsByZone(incidents: readonly OpsIncident[]): IncidentZoneCounts {
  const out = emptyCounts();
  for (const inc of incidents) {
    bumpZone(out, inc.zoneAtDetection);
  }
  return out;
}

/** @deprecated use buildIncidentPeriodAggregate — kept for call-site compatibility */
export function countIncidentsByZoneSince(
  incidents: readonly OpsIncident[],
  sinceMs: number,
  untilMs: number = Date.now(),
): IncidentZoneCounts {
  return countIncidentsByZone(filterIncidentsInWindow(incidents, sinceMs, untilMs));
}

/**
 * Build timeline buckets that cover every incident in `filtered`.
 * 24h → hourly from floor(since) through floor(until) inclusive (includes current hour).
 * 7d → daily from floor(since) through floor(until) inclusive.
 */
export function buildTimelineFromFiltered(
  filtered: readonly OpsIncident[],
  sinceMs: number,
  untilMs: number,
  granularity: 'hour' | 'day',
): IncidentTimelineBucket[] {
  const step = granularity === 'hour' ? HOUR_MS : DAY_MS;
  const first = Math.floor(sinceMs / step) * step;
  const last = Math.floor(untilMs / step) * step;
  const buckets: IncidentTimelineBucket[] = [];
  for (let t = first; t <= last; t += step) {
    buckets.push(emptyBucket(new Date(t).toISOString(), granularity));
  }
  if (buckets.length === 0) {
    buckets.push(emptyBucket(new Date(first).toISOString(), granularity));
  }

  for (const inc of filtered) {
    const t = incidentStartedAtMs(inc);
    const bucketStart = Math.floor(t / step) * step;
    let idx = Math.floor((bucketStart - first) / step);
    if (idx < 0) {
      idx = 0;
    }
    if (idx >= buckets.length) {
      idx = buckets.length - 1;
    }
    const bucket = buckets[idx]!;
    bumpZone(bucket, inc.zoneAtDetection);
  }
  return buckets;
}

export function sumTimelineCounts(
  timeline: readonly Pick<IncidentTimelineBucket, 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED'>[],
): IncidentZoneCounts {
  const out = emptyCounts();
  for (const b of timeline) {
    out.GREEN += b.GREEN;
    out.YELLOW += b.YELLOW;
    out.ORANGE += b.ORANGE;
    out.RED += b.RED;
    out.total += b.GREEN + b.YELLOW + b.ORANGE + b.RED;
  }
  return out;
}

/**
 * Canonical aggregate: one filtered set → counts + timeline.
 * Guarantees sum(timeline) === counts.total.
 */
export function buildIncidentPeriodAggregate(
  incidents: readonly OpsIncident[],
  period: IncidentPeriod,
  nowMs: number = Date.now(),
): IncidentPeriodAggregate {
  const windowMs = period === '24h' ? 24 * HOUR_MS : 7 * DAY_MS;
  const sinceMs = nowMs - windowMs;
  const untilMs = nowMs;
  const filtered = filterIncidentsInWindow(incidents, sinceMs, untilMs);
  const counts = countIncidentsByZone(filtered);
  const timelineGranularity = period === '24h' ? 'hour' : 'day';
  const timeline = buildTimelineFromFiltered(filtered, sinceMs, untilMs, timelineGranularity);
  return {
    period,
    sinceMs,
    untilMs,
    incidents: filtered.map((i) => ({ ...i, story: [...i.story] })),
    counts,
    timeline,
    timelineGranularity,
  };
}

export type CockpitIncidentViewFilters = {
  /** `'ALL'` or exact provider name (e.g. Sunweb). */
  provider: string;
  /** `'ALL'` or zoneAtDetection (YELLOW | ORANGE | RED). */
  zone: string;
};

/**
 * Cockpit VIEW filter: one incident set → counts + timeline + list.
 * Does not re-evaluate live-pricing health / ownerStatus.
 */
export function applyCockpitIncidentViewFilters(
  periodView: {
    incidents: readonly OpsIncident[];
    sinceMs: number;
    untilMs: number;
    timelineGranularity: 'hour' | 'day';
  },
  filters: CockpitIncidentViewFilters,
): {
  incidents: OpsIncident[];
  counts: IncidentZoneCounts;
  timeline: IncidentTimelineBucket[];
  timelineGranularity: 'hour' | 'day';
} {
  const incidents = periodView.incidents.filter((inc) => {
    if (filters.provider !== 'ALL' && (inc.provider ?? '') !== filters.provider) {
      return false;
    }
    if (filters.zone !== 'ALL' && inc.zoneAtDetection !== filters.zone) {
      return false;
    }
    return true;
  });
  const counts = countIncidentsByZone(incidents);
  const timeline = buildTimelineFromFiltered(
    incidents,
    periodView.sinceMs,
    periodView.untilMs,
    periodView.timelineGranularity,
  );
  return {
    incidents: incidents.map((i) => ({ ...i, story: [...i.story] })),
    counts,
    timeline,
    timelineGranularity: periodView.timelineGranularity,
  };
}

/** @deprecated — use buildIncidentPeriodAggregate('24h').timeline */
export function buildHourlyIncidentBuckets(
  incidents: readonly OpsIncident[],
  nowMs: number = Date.now(),
): HourlyIncidentBucket[] {
  return buildIncidentPeriodAggregate(incidents, '24h', nowMs).timeline;
}

export function countRemediationsByPlaybookSince(
  remediations: readonly RemediationLogEntry[],
  sinceMs: number,
): RemediationTypeCount[] {
  const map = new Map<string, number>();
  for (const r of remediations) {
    const t = Date.parse(r.timestamp);
    if (!Number.isFinite(t) || t < sinceMs) {
      continue;
    }
    if (r.result === 'skipped_cooldown') {
      continue;
    }
    map.set(r.playbookId, (map.get(r.playbookId) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([playbookId, count]) => ({
      playbookId,
      label: PLAYBOOK_LABELS[playbookId] ?? playbookId,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

export function humanProblemSummary(incident: OpsIncident): string {
  if (incident.cause) {
    const c = incident.cause;
    if (c.length <= 72) {
      return c;
    }
    return `${c.slice(0, 69)}…`;
  }
  return incident.metric;
}

export function humanActionSummary(incident: OpsIncident): string {
  if (!incident.autoAction) {
    return '—';
  }
  const first = incident.autoAction.split(';')[0]?.trim() ?? incident.autoAction;
  const id = first.split(':')[0] ?? first;
  return PLAYBOOK_LABELS[id] ?? first;
}
