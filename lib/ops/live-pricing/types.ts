/**
 * AN-064 — Live Pricing Operations Cockpit types.
 */

import type { S6RefillTelemetry, S6StopReason } from '@/lib/search/s6-dynamic-refill';

export type OpsZone = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export type IncidentStatus = 'OPEN' | 'AUTO-RESOLVED' | 'ESCALATED' | 'CLOSED';

export type ThresholdEvidenceStatus = 'MEASURED' | 'DERIVED' | 'POLICY' | 'UNKNOWN';

export type OpsMetricId =
  | 'c_rate'
  | 'a_rate'
  | 'b_rate'
  | 'coverage_deficit'
  | 'circuit_opens'
  | 'provider_c_rate'
  | 'transport_subtype_share'
  | 's6_no_progress';

export type ThresholdDefinition = {
  id: string;
  metric: OpsMetricId;
  zone: OpsZone;
  /** Inclusive lower bound for this zone trigger (rate 0–1 or count). */
  threshold: number;
  window: string;
  source: string;
  evidenceStatus: ThresholdEvidenceStatus;
  rationale: string;
  autoAction: string;
};

export type RemediationPlaybookId =
  | 'continue_s6_cursor'
  | 'respect_circuit_skip'
  | 'skip_missing_context'
  | 'reuse_cache_b'
  | 'isolate_provider_fault'
  | 'protect_no_config_change'
  | 'collect_telemetry';

export type RemediationActionResult =
  | 'applied'
  | 'already_active'
  | 'skipped_cooldown'
  | 'escalated'
  | 'simulated';

export type RemediationLogEntry = {
  id: string;
  timestamp: string;
  playbookId: RemediationPlaybookId;
  incidentId: string | null;
  zone: OpsZone;
  provider: string | null;
  action: string;
  result: RemediationActionResult;
  detail: string;
};

export type OpsIncident = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  zoneAtDetection: OpsZone;
  currentZone: OpsZone;
  metric: OpsMetricId;
  actualValue: number;
  threshold: number;
  provider: string | null;
  cSubtype: string | null;
  attempts: number;
  bCount: number;
  aCount: number;
  cCount: number;
  coveragePresentableB: number;
  coverageTargetB: number;
  cause: string | null;
  autoAction: string | null;
  actionAt: string | null;
  actionResult: string | null;
  recoveryDurationMs: number | null;
  escalated: boolean;
  notified: boolean;
  status: IncidentStatus;
  story: string[];
};

export type NotificationChannelId = 'console' | 'email' | 'sms' | 'whatsapp' | 'web_push';

export type NotificationChannelStatus = {
  id: NotificationChannelId;
  available: boolean;
  live: boolean;
  missing: string[];
  notes: string;
};

export type NotificationRecord = {
  id: string;
  timestamp: string;
  channel: NotificationChannelId;
  delivered: boolean;
  simulated: boolean;
  incidentId: string;
  zone: OpsZone;
  subject: string;
  body: string;
};

export type ProviderOpsRow = {
  provider: string;
  attempts: number;
  b: number;
  a: number;
  c: number;
  bRate: number;
  aRate: number;
  cRate: number;
  latencyP50Ms: number | null;
  latencyP95Ms: number | null;
  circuitState: 'closed' | 'open' | 'unknown';
  circuitOpens: number;
  missingContextSkips: number;
  circuitSkips: number;
  transportErrors: number;
  transportErrorCodes: Record<string, number>;
  lastIncidentId: string | null;
  zone: OpsZone;
};

export type CSubtypeRow = {
  code: string;
  count: number;
  percentage: number;
  provider: string | null;
  lastOccurrenceAt: string | null;
  trend: 'up' | 'down' | 'flat' | 'unknown';
};

export type CoverageOpsView = {
  presentableB: number;
  targetB: number;
  deficit: number;
  s6Active: boolean;
  s6StopReason: S6StopReason | null;
  catalogCandidatesConsumed: number;
  skippedMissingContext: number;
  skippedCircuitOpen: number;
  skippedCachedOrSettled: number;
  attempts: number;
  bFromCacheHint: number;
  httpCallsHint: number;
  candidatesRemaining: number;
  eligibleCandidateCount: number;
  lastS6At: string | null;
  lastBAt: string | null;
};

export type BacOpsView = {
  attempts: number;
  b: number;
  a: number;
  c: number;
  unpriced: number;
  bRate: number;
  aRate: number;
  cRate: number;
};

export type OwnerDisplayStatus = 'IDLE' | OpsZone;

export type OwnerActionCard = {
  needed: boolean;
  answer: 'JA' | 'NEE';
  title: string;
  detail: string;
};

export type IncidentZoneCounts = {
  GREEN: number;
  YELLOW: number;
  ORANGE: number;
  RED: number;
  total: number;
};

export type HourlyIncidentBucket = {
  hourStart: string;
  GREEN: number;
  YELLOW: number;
  ORANGE: number;
  RED: number;
  granularity?: 'hour' | 'day';
};

export type IncidentPeriodAggregateView = {
  period: '24h' | '7d';
  sinceMs: number;
  untilMs: number;
  counts: IncidentZoneCounts;
  timeline: HourlyIncidentBucket[];
  timelineGranularity: 'hour' | 'day';
  /** Canonical incidents in this period (for list; same set as counts/timeline). */
  incidents: OpsIncident[];
  incidentIds: string[];
};

export type RemediationTypeCount = {
  playbookId: string;
  label: string;
  count: number;
};

export type LivePricingCockpitSnapshot = {
  generatedAt: string;
  /** Technical ops zone from triggers (never IDLE). */
  zone: OpsZone;
  /** Owner-facing status including IDLE (N-065). */
  ownerStatus: OwnerDisplayStatus;
  ownerHeadline: { emoji: string; title: string; subtitle: string };
  actionRequired: OwnerActionCard;
  productGoalMet: boolean;
  productCoverageLabel: string;
  technicalHealthZone: OpsZone;
  overallHealth: string;
  bac: BacOpsView;
  coverage: CoverageOpsView;
  providers: ProviderOpsRow[];
  cSubtypes: CSubtypeRow[];
  circuits: {
    openCount: number;
    worksetSkippedCircuitOpen: number;
  };
  missingContext: {
    skipped: number;
  };
  s6: S6RefillTelemetry | null;
  openIncidents: OpsIncident[];
  recentIncidents: OpsIncident[];
  /** Incident counts by zoneAtDetection in last 24h (all statuses). */
  incidentsLast24h: IncidentZoneCounts;
  /** Optional 7d window counts. */
  incidentsLast7d: IncidentZoneCounts;
  hourlyIncidents24h: HourlyIncidentBucket[];
  /** N-065.1 canonical period views (counts ≡ timeline ≡ same filtered set). */
  incidentView24h: IncidentPeriodAggregateView;
  incidentView7d: IncidentPeriodAggregateView;
  remediationsLast24h: RemediationTypeCount[];
  remediationsLast7d: RemediationTypeCount[];
  humanActionRequired: boolean;
  remediations: RemediationLogEntry[];
  notifications: NotificationRecord[];
  thresholds: ThresholdDefinition[];
  notificationChannels: NotificationChannelStatus[];
  simulationMode: boolean;
  concurrencyGuard: {
    corendon: number;
    sunweb: number;
    eliza: number;
    unchanged: true;
  };
  /** How incident 24h counts are defined (for UI footnote). */
  incidentCountRule: string;
};

export type SimulatedOpsInput = {
  scenario: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'IDLE' | 'CUSTOM';
  attempts?: number;
  b?: number;
  a?: number;
  c?: number;
  provider?: string;
  transportErrorCode?: string;
  circuitOpens?: number;
  presentableB?: number;
  s6StopReason?: S6StopReason | null;
  s6Active?: boolean;
};

/** Internal evaluation input (live or simulated). */
export type OpsEvaluationInput = {
  attempts: number;
  b: number;
  a: number;
  c: number;
  unpriced: number;
  bRate: number;
  aRate: number;
  cRate: number;
  byProvider: Record<
    string,
    { attempts: number; b: number; a: number; c: number; bRate: number; aRate: number; cRate: number }
  >;
  byTransportErrorCode: Record<string, number>;
  circuitOpenCount: number;
  worksetSkippedCircuitOpen: number;
  missingContextSkipped: number;
  coverage: CoverageOpsView;
  latencyByProvider: Record<string, { p50: number | null; p95: number | null }>;
  lastBAt: string | null;
  simulationMode: boolean;
};
