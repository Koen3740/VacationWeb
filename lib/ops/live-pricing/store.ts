/**
 * AN-064 — process-local ops store with optional filesystem durability.
 *
 * Primary: in-memory (same pattern as live-price-observability).
 * Secondary: JSON under data/ops/live-pricing/ for local/long-lived Node.
 * On Vercel serverless, memory is per-instance; file writes may be ephemeral —
 * documented in AN-064. No second knowledge base / no parallel DB.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { S6RefillTelemetry } from '@/lib/search/s6-dynamic-refill';
import type {
  NotificationRecord,
  OpsIncident,
  RemediationLogEntry,
  SimulatedOpsInput,
} from './types';

export const OPS_STORE_RELATIVE_PATH = 'data/ops/live-pricing/store.json' as const;

const MAX_INCIDENTS = 200;
const MAX_REMEDIATIONS = 200;
const MAX_NOTIFICATIONS = 100;
const MAX_SNAPSHOT_TRENDS = 120;

export type OpsTrendPoint = {
  at: string;
  zone: string;
  attempts: number;
  b: number;
  a: number;
  c: number;
  cRate: number;
  presentableB: number;
};

type OpsStoreState = {
  incidents: OpsIncident[];
  remediations: RemediationLogEntry[];
  notifications: NotificationRecord[];
  trends: OpsTrendPoint[];
  lastS6: S6RefillTelemetry | null;
  lastS6At: string | null;
  lastBAt: string | null;
  playbookCooldowns: Record<string, string>;
  simulation: SimulatedOpsInput | null;
  lastEvaluatedAt: string | null;
};

function emptyState(): OpsStoreState {
  return {
    incidents: [],
    remediations: [],
    notifications: [],
    trends: [],
    lastS6: null,
    lastS6At: null,
    lastBAt: null,
    playbookCooldowns: {},
    simulation: null,
    lastEvaluatedAt: null,
  };
}

let state: OpsStoreState = emptyState();
let hydrated = false;

export function resolveOpsStorePath(cwd: string = process.cwd()): string {
  return join(cwd, OPS_STORE_RELATIVE_PATH);
}

function persist(): void {
  if (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) {
    return;
  }
  try {
    const path = resolveOpsStorePath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // Ephemeral FS (serverless) — memory remains source of truth.
  }
}

function hydrate(): void {
  if (hydrated) {
    return;
  }
  hydrated = true;
  if (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) {
    return;
  }
  try {
    const path = resolveOpsStorePath();
    if (!existsSync(path)) {
      return;
    }
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<OpsStoreState>;
    state = {
      ...emptyState(),
      ...raw,
      incidents: Array.isArray(raw.incidents) ? raw.incidents : [],
      remediations: Array.isArray(raw.remediations) ? raw.remediations : [],
      notifications: Array.isArray(raw.notifications) ? raw.notifications : [],
      trends: Array.isArray(raw.trends) ? raw.trends : [],
      playbookCooldowns:
        raw.playbookCooldowns && typeof raw.playbookCooldowns === 'object'
          ? raw.playbookCooldowns
          : {},
    };
  } catch {
    // Corrupt / missing — start fresh.
  }
}

function touch(): OpsStoreState {
  hydrate();
  return state;
}

export function getOpsStoreSnapshot(): OpsStoreState {
  const s = touch();
  return {
    incidents: s.incidents.map((i) => ({ ...i, story: [...i.story] })),
    remediations: s.remediations.map((r) => ({ ...r })),
    notifications: s.notifications.map((n) => ({ ...n })),
    trends: s.trends.map((t) => ({ ...t })),
    lastS6: s.lastS6 ? { ...s.lastS6 } : null,
    lastS6At: s.lastS6At,
    lastBAt: s.lastBAt,
    playbookCooldowns: { ...s.playbookCooldowns },
    simulation: s.simulation ? { ...s.simulation } : null,
    lastEvaluatedAt: s.lastEvaluatedAt,
  };
}

export function clearOpsStoreForTests(): void {
  state = emptyState();
  hydrated = true;
}

export function recordOpsLastBAt(iso: string = new Date().toISOString()): void {
  touch().lastBAt = iso;
  persist();
}

export function recordOpsS6Telemetry(
  telemetry: S6RefillTelemetry,
  at: string = new Date().toISOString(),
): void {
  const s = touch();
  s.lastS6 = { ...telemetry };
  s.lastS6At = at;
  persist();
}

export function setOpsSimulation(input: SimulatedOpsInput | null): void {
  touch().simulation = input;
  persist();
}

export function getOpsSimulation(): SimulatedOpsInput | null {
  const sim = touch().simulation;
  return sim ? { ...sim } : null;
}

export function upsertOpsIncident(incident: OpsIncident): void {
  const s = touch();
  const idx = s.incidents.findIndex((i) => i.id === incident.id);
  if (idx >= 0) {
    s.incidents[idx] = incident;
  } else {
    s.incidents.unshift(incident);
    if (s.incidents.length > MAX_INCIDENTS) {
      s.incidents.length = MAX_INCIDENTS;
    }
  }
  persist();
}

export function listOpsIncidents(): OpsIncident[] {
  return touch().incidents.map((i) => ({ ...i, story: [...i.story] }));
}

export function appendOpsRemediation(entry: RemediationLogEntry): void {
  const s = touch();
  s.remediations.unshift(entry);
  if (s.remediations.length > MAX_REMEDIATIONS) {
    s.remediations.length = MAX_REMEDIATIONS;
  }
  persist();
}

export function listOpsRemediations(): RemediationLogEntry[] {
  return touch().remediations.map((r) => ({ ...r }));
}

export function appendOpsNotification(entry: NotificationRecord): void {
  const s = touch();
  s.notifications.unshift(entry);
  if (s.notifications.length > MAX_NOTIFICATIONS) {
    s.notifications.length = MAX_NOTIFICATIONS;
  }
  persist();
}

export function listOpsNotifications(): NotificationRecord[] {
  return touch().notifications.map((n) => ({ ...n }));
}

export function appendOpsTrend(point: OpsTrendPoint): void {
  const s = touch();
  s.trends.push(point);
  if (s.trends.length > MAX_SNAPSHOT_TRENDS) {
    s.trends.splice(0, s.trends.length - MAX_SNAPSHOT_TRENDS);
  }
  persist();
}

export function listOpsTrends(): OpsTrendPoint[] {
  return touch().trends.map((t) => ({ ...t }));
}

export function getPlaybookCooldown(key: string): string | null {
  return touch().playbookCooldowns[key] ?? null;
}

export function setPlaybookCooldown(key: string, iso: string): void {
  touch().playbookCooldowns[key] = iso;
  persist();
}

export function markOpsEvaluated(at: string = new Date().toISOString()): void {
  touch().lastEvaluatedAt = at;
  persist();
}
