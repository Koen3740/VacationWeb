/**
 * AN-064 incident lifecycle + cockpit evaluation loop.
 */

import { CORENDON_LIVE_MATCHSET_CONCURRENCY } from '@/lib/providers/corendon/constants';
import { ELIZA_LIVE_PAGE1_CONCURRENCY } from '@/lib/providers/eliza/constants';
import { SUNWEB_LIVE_MATCHSET_CONCURRENCY } from '@/lib/providers/sunweb/constants';
import {
  getLivePriceStepTelemetrySnapshot,
} from '@/lib/providers/live-price-step-telemetry';
import {
  getLivePriceObservabilitySnapshot,
} from '@/lib/search/live-price-observability';
import {
  isLivePriceCircuitOpen,
  type LivePriceCircuitProvider,
} from '@/lib/providers/live-price-circuit';
import { S6_TARGET_PRESENTABLE_B } from '@/lib/search/s6-dynamic-refill';
import { notifyOwnerForIncident, getNotificationChannelStatuses } from './notifications';
import { runRemediationPlaybooks } from './remediation';
import {
  appendOpsTrend,
  getOpsSimulation,
  getOpsStoreSnapshot,
  listOpsIncidents,
  listOpsNotifications,
  listOpsRemediations,
  markOpsEvaluated,
  upsertOpsIncident,
} from './store';
import {
  OPS_MIN_ATTEMPTS_FOR_RATE,
  OPS_COVERAGE_TARGET_B,
  OPS_C_RATE_YELLOW,
  getThresholdDefinitions,
} from './thresholds';
import type {
  BacOpsView,
  CoverageOpsView,
  CSubtypeRow,
  LivePricingCockpitSnapshot,
  OpsEvaluationInput,
  OpsIncident,
  ProviderOpsRow,
  SimulatedOpsInput,
} from './types';
import { evaluateOpsZoneTriggers, resolveOverallZone, type ZoneTrigger } from './zones';
import {
  buildOwnerActionCard,
  getProductCoverageState,
  isProductCoverageMetric,
  ownerStatusHeadline,
  resolveOwnerDisplayStatus,
} from './owner-status';
import {
  buildIncidentPeriodAggregate,
  countRemediationsByPlaybookSince,
  INCIDENT_COUNT_RULE,
} from './aggregates';
import type { IncidentPeriodAggregateView } from './types';

function toPeriodView(
  agg: ReturnType<typeof buildIncidentPeriodAggregate>,
): IncidentPeriodAggregateView {
  return {
    period: agg.period,
    sinceMs: agg.sinceMs,
    untilMs: agg.untilMs,
    counts: agg.counts,
    timeline: agg.timeline,
    timelineGranularity: agg.timelineGranularity,
    incidents: agg.incidents,
    incidentIds: agg.incidents.map((i) => i.id),
  };
}

function circuitProviderKey(provider: string): LivePriceCircuitProvider | null {
  const key = provider.trim().toLowerCase();
  if (key === 'corendon' || key === 'sunweb' || key === 'eliza' || key === 'prijsvrij') {
    return key;
  }
  return null;
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function fingerprint(trigger: ZoneTrigger): string {
  return `${trigger.metric}|${trigger.provider ?? 'all'}|${trigger.cSubtype ?? ''}|${trigger.zone}`;
}

function buildCoverageFromStore(): CoverageOpsView {
  const store = getOpsStoreSnapshot();
  const s6 = store.lastS6;
  const targetB = s6?.targetB ?? OPS_COVERAGE_TARGET_B;
  const presentableB = s6?.presentableB ?? 0;
  const deficit = Math.max(0, targetB - presentableB);
  const activeStop = s6?.stopReason;
  // S6 is "active" only while we have no terminal telemetry yet after start —
  // we expose last telemetry; active flag = simulation override or unknown false.
  return {
    presentableB,
    targetB,
    deficit,
    s6Active: false,
    s6StopReason: activeStop ?? null,
    catalogCandidatesConsumed: s6?.candidatesConsumed ?? 0,
    skippedMissingContext: s6?.skippedMissingContext ?? 0,
    skippedCircuitOpen: s6?.skippedCircuitOpen ?? 0,
    skippedCachedOrSettled: s6?.skippedCachedOrSettled ?? 0,
    attempts: s6?.attempts ?? 0,
    bFromCacheHint: s6?.skippedCachedOrSettled ?? 0,
    httpCallsHint: s6?.attempts ?? 0,
    candidatesRemaining: s6?.candidatesRemaining ?? 0,
    eligibleCandidateCount: s6?.eligibleCandidateCount ?? 0,
    lastS6At: store.lastS6At,
    lastBAt: store.lastBAt,
  };
}

function buildLiveEvaluationInput(): OpsEvaluationInput {
  const snap = getLivePriceObservabilitySnapshot();
  const step = getLivePriceStepTelemetrySnapshot();
  const byProvider: OpsEvaluationInput['byProvider'] = {};
  for (const [provider, counts] of Object.entries(snap.byProvider)) {
    const attempts = counts.SUCCESS + counts.UNAVAILABLE + counts.UNPRICED + counts.ERROR;
    const rates = snap.byProviderRates[provider];
    byProvider[provider] = {
      attempts,
      b: counts.SUCCESS,
      a: counts.UNAVAILABLE,
      c: counts.ERROR,
      bRate: rates?.bRate ?? 0,
      aRate: rates?.aRate ?? 0,
      cRate: rates?.cRate ?? 0,
    };
  }

  const latencyByProvider: OpsEvaluationInput['latencyByProvider'] = {};
  for (const [provider, row] of Object.entries(step.byProvider)) {
    latencyByProvider[provider] = {
      p50: row.totalMs?.p50 ?? null,
      p95: row.totalMs?.p95 ?? null,
    };
  }

  return {
    attempts: snap.attempts,
    b: snap.success,
    a: snap.unavailable,
    c: snap.error,
    unpriced: snap.unpriced,
    bRate: snap.bRate,
    aRate: snap.aRate,
    cRate: snap.cRate,
    byProvider,
    byTransportErrorCode: { ...snap.byTransportErrorCode },
    circuitOpenCount: snap.circuitOpenCount,
    worksetSkippedCircuitOpen: snap.worksetSkippedCircuitOpen,
    missingContextSkipped: snap.missingContextSkipped,
    coverage: buildCoverageFromStore(),
    latencyByProvider,
    lastBAt: getOpsStoreSnapshot().lastBAt,
    simulationMode: false,
  };
}

/**
 * Build a provider ABC row where attempts === b+a+c and rates = counts/attempts.
 * Target rates preserve scenario intent; integers use largest-remainder allocation
 * (remainder prefers B) so C is not inflated by all rounding error.
 */
function providerAbcFromTargetRates(
  attempts: number,
  targetBRate: number,
  targetARate: number,
  targetCRate: number,
): {
  attempts: number;
  b: number;
  a: number;
  c: number;
  bRate: number;
  aRate: number;
  cRate: number;
} {
  if (attempts <= 0) {
    return { attempts: 0, b: 0, a: 0, c: 0, bRate: 0, aRate: 0, cRate: 0 };
  }
  const raw = Math.max(0, targetBRate) + Math.max(0, targetARate) + Math.max(0, targetCRate);
  const nb = raw > 0 ? Math.max(0, targetBRate) / raw : 1;
  const na = raw > 0 ? Math.max(0, targetARate) / raw : 0;
  const nc = raw > 0 ? Math.max(0, targetCRate) / raw : 0;
  const exact = [
    { key: 'b' as const, floor: Math.floor(nb * attempts), frac: nb * attempts - Math.floor(nb * attempts) },
    { key: 'a' as const, floor: Math.floor(na * attempts), frac: na * attempts - Math.floor(na * attempts) },
    { key: 'c' as const, floor: Math.floor(nc * attempts), frac: nc * attempts - Math.floor(nc * attempts) },
  ];
  let b = exact[0]!.floor;
  let a = exact[1]!.floor;
  let c = exact[2]!.floor;
  let rem = attempts - b - a - c;
  const order = [...exact].sort((x, y) => {
    if (y.frac !== x.frac) {
      return y.frac - x.frac;
    }
    // Tie-break: prefer B, then A, then C — avoids dumping remainder into C.
    const rank = { b: 0, a: 1, c: 2 };
    return rank[x.key] - rank[y.key];
  });
  let i = 0;
  while (rem > 0 && order.length > 0) {
    const slot = order[i % order.length]!;
    if (slot.key === 'b') b += 1;
    else if (slot.key === 'a') a += 1;
    else c += 1;
    rem -= 1;
    i += 1;
  }
  // Do not let integer rounding alone push a quiet target C into YELLOW (≥5%).
  if (targetCRate < OPS_C_RATE_YELLOW) {
    const maxC = Math.max(0, Math.ceil(attempts * OPS_C_RATE_YELLOW) - 1);
    while (c > maxC && c > 0) {
      c -= 1;
      b += 1;
    }
  }
  return {
    attempts,
    b,
    a,
    c,
    bRate: b / attempts,
    aRate: a / attempts,
    cRate: c / attempts,
  };
}

function buildSimulatedEvaluationInput(sim: SimulatedOpsInput): OpsEvaluationInput {
  const attempts = sim.attempts ?? (sim.b ?? 0) + (sim.a ?? 0) + (sim.c ?? 0);
  const b = sim.b ?? 0;
  const a = sim.a ?? 0;
  const c = sim.c ?? 0;
  const bRate = attempts > 0 ? b / attempts : 0;
  const aRate = attempts > 0 ? a / attempts : 0;
  const cRate = attempts > 0 ? c / attempts : 0;
  const provider = sim.provider ?? 'Sunweb';
  const presentableB = sim.presentableB ?? b;
  const targetB = S6_TARGET_PRESENTABLE_B;
  const deficit = Math.max(0, targetB - presentableB);
  const transport: Record<string, number> = {};
  if (sim.transportErrorCode && c > 0) {
    transport[sim.transportErrorCode] = c;
  }

  const stopReason =
    sim.s6StopReason === null
      ? null
      : sim.s6StopReason ?? (deficit === 0 ? 'target_met' : 'no_progress');

  // Secondary Corendon row: keep "healthier than primary" intent, but enforce ABC invariants.
  const corendonAttempts = Math.max(OPS_MIN_ATTEMPTS_FOR_RATE, Math.floor(attempts * 0.4));
  const corendon = providerAbcFromTargetRates(
    corendonAttempts,
    cRate < 0.05 ? 0.85 : Math.min(1, bRate + 0.2),
    cRate < 0.05 ? 0.12 : Math.max(0, aRate * 0.5),
    cRate < 0.05 ? 0.03 : Math.min(cRate, Math.max(0, cRate * 0.4)),
  );

  return {
    attempts,
    b,
    a,
    c,
    unpriced: 0,
    bRate,
    aRate,
    cRate,
    byProvider:
      attempts === 0
        ? {}
        : {
            [provider]: { attempts, b, a, c, bRate, aRate, cRate },
            ...(provider === 'Corendon' ? {} : { Corendon: corendon }),
          },
    byTransportErrorCode: transport,
    circuitOpenCount: sim.circuitOpens ?? 0,
    worksetSkippedCircuitOpen: sim.circuitOpens ? sim.circuitOpens * 2 : 0,
    missingContextSkipped: 0,
    coverage: {
      presentableB,
      targetB,
      deficit,
      s6Active: Boolean(sim.s6Active),
      s6StopReason: stopReason,
      catalogCandidatesConsumed: attempts,
      skippedMissingContext: 0,
      skippedCircuitOpen: sim.circuitOpens ?? 0,
      skippedCachedOrSettled: Math.max(0, presentableB - b),
      attempts,
      bFromCacheHint: Math.max(0, presentableB - b),
      httpCallsHint: attempts,
      candidatesRemaining: deficit > 0 ? 10 : 0,
      eligibleCandidateCount: deficit > 0 ? 10 : 0,
      lastS6At: stopReason || sim.s6Active || presentableB > 0 ? new Date().toISOString() : null,
      lastBAt: b > 0 ? new Date().toISOString() : null,
    },
    latencyByProvider:
      attempts === 0
        ? {}
        : {
            sunweb: { p50: 1965, p95: 4500 },
            eliza: { p50: 624, p95: 1800 },
          },
    lastBAt: b > 0 ? new Date().toISOString() : null,
    simulationMode: true,
  };
}

function scenarioDefaults(scenario: SimulatedOpsInput['scenario']): SimulatedOpsInput {
  switch (scenario) {
    case 'IDLE':
      return {
        scenario: 'IDLE',
        attempts: 0,
        b: 0,
        a: 0,
        c: 0,
        presentableB: 0,
        s6StopReason: null,
        circuitOpens: 0,
        s6Active: false,
      };
    case 'GREEN':
      return {
        scenario: 'GREEN',
        attempts: 100,
        b: 82,
        a: 15,
        c: 3,
        presentableB: 150,
        s6StopReason: 'target_met',
        circuitOpens: 0,
      };
    case 'YELLOW':
      // cRate = 10/100 = 0.10 → YELLOW band [0.05, 0.15); no ORANGE+ independent triggers.
      return {
        scenario: 'YELLOW',
        attempts: 100,
        b: 85,
        a: 5,
        c: 10,
        provider: 'Sunweb',
        transportErrorCode: 'UND_ERR_CONNECT_TIMEOUT',
        presentableB: 150,
        s6StopReason: 'target_met',
        circuitOpens: 0,
      };
    case 'ORANGE':
      return {
        scenario: 'ORANGE',
        attempts: 100,
        b: 50,
        a: 30,
        c: 20,
        provider: 'Sunweb',
        transportErrorCode: 'UND_ERR_CONNECT_TIMEOUT',
        presentableB: 80,
        s6StopReason: 'no_progress',
        circuitOpens: 3,
      };
    case 'RED':
      return {
        scenario: 'RED',
        attempts: 100,
        b: 20,
        a: 15,
        c: 65,
        provider: 'Sunweb',
        transportErrorCode: 'UND_ERR_CONNECT_TIMEOUT',
        presentableB: 40,
        s6StopReason: 'no_progress',
        circuitOpens: 6,
      };
    default:
      return { scenario: 'CUSTOM' };
  }
}

export function resolveEvaluationInput(): OpsEvaluationInput {
  const sim = getOpsSimulation();
  if (sim) {
    const merged = { ...scenarioDefaults(sim.scenario), ...sim };
    return buildSimulatedEvaluationInput(merged);
  }
  return buildLiveEvaluationInput();
}

function openIncidentFromTrigger(
  trigger: ZoneTrigger,
  input: OpsEvaluationInput,
  existing: OpsIncident | undefined,
): OpsIncident {
  const nowIso = new Date().toISOString();
  if (existing && (existing.status === 'OPEN' || existing.status === 'ESCALATED')) {
    return {
      ...existing,
      currentZone: trigger.zone,
      actualValue: trigger.actualValue,
      threshold: trigger.threshold,
      attempts: input.attempts,
      bCount: input.b,
      aCount: input.a,
      cCount: input.c,
      coveragePresentableB: input.coverage.presentableB,
      coverageTargetB: input.coverage.targetB,
      cause: trigger.cause,
      cSubtype: trigger.cSubtype,
      story: [...existing.story, `${nowIso} UPDATE zone=${trigger.zone} value=${trigger.actualValue}`],
    };
  }

  return {
    id: newId('inc'),
    startedAt: nowIso,
    endedAt: null,
    zoneAtDetection: trigger.zone,
    currentZone: trigger.zone,
    metric: trigger.metric,
    actualValue: trigger.actualValue,
    threshold: trigger.threshold,
    provider: trigger.provider,
    cSubtype: trigger.cSubtype,
    attempts: input.attempts,
    bCount: input.b,
    aCount: input.a,
    cCount: input.c,
    coveragePresentableB: input.coverage.presentableB,
    coverageTargetB: input.coverage.targetB,
    cause: trigger.cause,
    autoAction: null,
    actionAt: null,
    actionResult: null,
    recoveryDurationMs: null,
    escalated: trigger.zone === 'RED',
    notified: false,
    status: trigger.zone === 'RED' ? 'ESCALATED' : 'OPEN',
    story: [
      `${nowIso} DETECT ${trigger.zone} metric=${trigger.metric} value=${trigger.actualValue} threshold=${trigger.threshold}`,
      `${nowIso} DIAGNOSE ${trigger.cause}`,
    ],
  };
}

function autoResolveStaleIncidents(
  open: OpsIncident[],
  activeFingerprints: Set<string>,
  overallZone: ReturnType<typeof resolveOverallZone>,
  coveragePresentableB: number,
  coverageTargetB: number,
): void {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const productGoalMet = coveragePresentableB >= coverageTargetB;

  for (const incident of open) {
    if (incident.status !== 'OPEN' && incident.status !== 'ESCALATED') {
      continue;
    }
    const stillActive =
      [...activeFingerprints].some(
        (a) =>
          a.startsWith(`${incident.metric}|${incident.provider ?? 'all'}|${incident.cSubtype ?? ''}|`),
      );

    if (stillActive) {
      continue;
    }

    // Product coverage incidents only auto-resolve when the product goal is met.
    if (isProductCoverageMetric(incident.metric) && !productGoalMet) {
      continue;
    }

    // Technical incidents may resolve when their trigger cleared and overall is not RED/ORANGE storm.
    if (overallZone === 'ORANGE' || overallZone === 'RED') {
      continue;
    }

    if (overallZone === 'GREEN' || overallZone === 'YELLOW' || isProductCoverageMetric(incident.metric)) {
      const recovery = now - Date.parse(incident.startedAt);
      const resolved: OpsIncident = {
        ...incident,
        endedAt: nowIso,
        currentZone: overallZone === 'GREEN' ? 'GREEN' : incident.currentZone,
        status: 'AUTO-RESOLVED',
        recoveryDurationMs: recovery,
        story: [
          ...incident.story,
          isProductCoverageMetric(incident.metric)
            ? `${nowIso} RESULT product goal met (${coveragePresentableB}/${coverageTargetB} B)`
            : `${nowIso} RESULT technical metrics recovered (product coverage tracked separately)`,
          `${nowIso} HERSTEL AUTO-RESOLVED durationMs=${recovery}`,
        ],
      };
      upsertOpsIncident(resolved);
    }
  }
}

/**
 * Evaluate zones, create/update incidents (incl. YELLOW), run playbooks, notify.
 */
export function evaluateLivePricingOps(): {
  zone: ReturnType<typeof resolveOverallZone>;
  triggers: ZoneTrigger[];
  incidents: OpsIncident[];
} {
  const input = resolveEvaluationInput();
  const triggers = evaluateOpsZoneTriggers(input);
  const zone = resolveOverallZone(triggers);
  const existing = listOpsIncidents();
  const open = existing.filter((i) => i.status === 'OPEN' || i.status === 'ESCALATED');
  const activeFp = new Set(triggers.map(fingerprint));
  const touched: OpsIncident[] = [];

  for (const trigger of triggers) {
    if (trigger.zone === 'GREEN') {
      continue;
    }
    const fp = fingerprint(trigger);
    const prior = open.find(
      (i) =>
        i.metric === trigger.metric &&
        (i.provider ?? null) === trigger.provider &&
        (i.cSubtype ?? null) === trigger.cSubtype,
    );
    let incident = openIncidentFromTrigger(trigger, input, prior);
    const remediations = runRemediationPlaybooks({
      zone: trigger.zone,
      triggers: [trigger],
      incident,
      simulationMode: input.simulationMode,
    });
    const remSummaries = remediations.map((r) => `${r.playbookId}:${r.result}`);
    incident = {
      ...incident,
      autoAction: remSummaries.join('; ') || null,
      actionAt: remediations[0]?.timestamp ?? new Date().toISOString(),
      actionResult: remediations.map((r) => r.result).join(',') || null,
      story: [
        ...incident.story,
        `${incident.actionAt} ACTIE ${remSummaries.join(' | ') || 'none'}`,
      ],
    };

    if ((trigger.zone === 'ORANGE' || trigger.zone === 'RED') && !incident.notified) {
      const note = notifyOwnerForIncident({
        incident,
        zone: trigger.zone,
        remediationSummaries: remSummaries,
        simulationMode: input.simulationMode,
      });
      incident = {
        ...incident,
        notified: note.notified,
        escalated: incident.escalated || trigger.zone === 'RED',
        status: trigger.zone === 'RED' ? 'ESCALATED' : incident.status,
        story: [
          ...incident.story,
          `${new Date().toISOString()} NOTIFY notified=${note.notified} channels=${note.records.map((r) => r.channel).join(',')}`,
        ],
      };
    } else if (trigger.zone === 'YELLOW') {
      incident = {
        ...incident,
        story: [
          ...incident.story,
          `${new Date().toISOString()} NOTIFY skipped (YELLOW — no owner message)`,
        ],
      };
    }

    upsertOpsIncident(incident);
    touched.push(incident);
    void fp;
  }

  autoResolveStaleIncidents(
    listOpsIncidents().filter((i) => i.status === 'OPEN' || i.status === 'ESCALATED'),
    activeFp,
    zone,
    input.coverage.presentableB,
    input.coverage.targetB,
  );

  appendOpsTrend({
    at: new Date().toISOString(),
    zone,
    attempts: input.attempts,
    b: input.b,
    a: input.a,
    c: input.c,
    cRate: input.cRate,
    presentableB: input.coverage.presentableB,
  });
  markOpsEvaluated();

  return { zone, triggers, incidents: touched };
}

function providerCircuitState(provider: string): 'closed' | 'open' | 'unknown' {
  const key = circuitProviderKey(provider);
  if (!key) {
    return 'unknown';
  }
  return isLivePriceCircuitOpen(key) ? 'open' : 'closed';
}

function buildProviderRows(input: OpsEvaluationInput, zoneOverall: ReturnType<typeof resolveOverallZone>): ProviderOpsRow[] {
  const incidents = listOpsIncidents();
  const names = new Set([
    ...Object.keys(input.byProvider),
    'Corendon',
    'Sunweb',
    'Eliza',
  ]);
  const rows: ProviderOpsRow[] = [];
  for (const provider of names) {
    const row = input.byProvider[provider] ?? {
      attempts: 0,
      b: 0,
      a: 0,
      c: 0,
      bRate: 0,
      aRate: 0,
      cRate: 0,
    };
    const latKey = provider.toLowerCase();
    const lat =
      input.latencyByProvider[latKey] ??
      input.latencyByProvider[provider] ??
      { p50: null, p95: null };
    const last = incidents.find((i) => i.provider === provider);
    const providerTriggers = evaluateOpsZoneTriggers({
      ...input,
      cRate: row.cRate,
      aRate: row.aRate,
      bRate: row.bRate,
      attempts: row.attempts,
      b: row.b,
      a: row.a,
      c: row.c,
      byProvider: { [provider]: row },
    });
    const pZone = resolveOverallZone(providerTriggers.filter((t) => t.provider === provider || t.provider === null));
    rows.push({
      provider,
      attempts: row.attempts,
      b: row.b,
      a: row.a,
      c: row.c,
      bRate: row.bRate,
      aRate: row.aRate,
      cRate: row.cRate,
      latencyP50Ms: lat.p50,
      latencyP95Ms: lat.p95,
      circuitState: providerCircuitState(provider),
      circuitOpens: input.circuitOpenCount,
      missingContextSkips: input.missingContextSkipped,
      circuitSkips: input.worksetSkippedCircuitOpen,
      transportErrors: Object.values(input.byTransportErrorCode).reduce((s, n) => s + n, 0),
      transportErrorCodes: { ...input.byTransportErrorCode },
      lastIncidentId: last?.id ?? null,
      zone: row.attempts === 0 ? zoneOverall : pZone,
    });
  }
  return rows.sort((a, b) => a.provider.localeCompare(b.provider));
}

function buildCSubtypes(input: OpsEvaluationInput): CSubtypeRow[] {
  const total = Object.values(input.byTransportErrorCode).reduce((s, n) => s + n, 0);
  return Object.entries(input.byTransportErrorCode)
    .map(([code, count]) => ({
      code,
      count,
      percentage: total > 0 ? count / total : 0,
      provider: null,
      lastOccurrenceAt: null,
      trend: 'unknown' as const,
    }))
    .sort((a, b) => b.count - a.count);
}

export function getLivePricingCockpitSnapshot(): LivePricingCockpitSnapshot {
  evaluateLivePricingOps();
  const input = resolveEvaluationInput();
  const triggers = evaluateOpsZoneTriggers(input);
  const technicalZone = resolveOverallZone(triggers);
  const ownerStatus = resolveOwnerDisplayStatus(technicalZone, input);
  const product = getProductCoverageState(input.coverage);
  const actionRequired = buildOwnerActionCard(ownerStatus, product);
  const bac: BacOpsView = {
    attempts: input.attempts,
    b: input.b,
    a: input.a,
    c: input.c,
    unpriced: input.unpriced,
    bRate: input.bRate,
    aRate: input.aRate,
    cRate: input.cRate,
  };
  const incidents = listOpsIncidents();
  const remediations = listOpsRemediations();
  const now = Date.now();
  const since24h = now - 24 * 60 * 60 * 1000;
  const since7d = now - 7 * 24 * 60 * 60 * 1000;
  const view24h = buildIncidentPeriodAggregate(incidents, '24h', now);
  const view7d = buildIncidentPeriodAggregate(incidents, '7d', now);
  const health =
    ownerStatus === 'IDLE'
      ? 'Idle — geen actieve pricing-run'
      : ownerStatus === 'GREEN'
        ? product.s6Filling
          ? 'Technisch normaal — S6 vult nog aan tot 150 B'
          : product.shortfall
            ? 'Technisch rustig — productdoel 150 B nog niet gehaald'
            : 'Normale werking'
        : ownerStatus === 'YELLOW'
          ? 'Kleine afwijking — automatische herstelactie'
          : ownerStatus === 'ORANGE'
            ? 'Serieuze afwijking — remediation + melding'
            : 'Kritiek — bescherming + escalatie';

  return {
    generatedAt: new Date().toISOString(),
    zone: technicalZone === 'GREEN' && ownerStatus === 'IDLE' ? 'GREEN' : technicalZone,
    ownerStatus,
    ownerHeadline: ownerStatusHeadline(ownerStatus),
    actionRequired,
    productGoalMet: product.productGoalMet,
    productCoverageLabel: product.label,
    technicalHealthZone: technicalZone,
    overallHealth: health,
    bac,
    coverage: input.coverage,
    providers: buildProviderRows(input, technicalZone),
    cSubtypes: buildCSubtypes(input),
    circuits: {
      openCount: input.circuitOpenCount,
      worksetSkippedCircuitOpen: input.worksetSkippedCircuitOpen,
    },
    missingContext: {
      skipped: input.missingContextSkipped,
    },
    s6: getOpsStoreSnapshot().lastS6,
    openIncidents: incidents.filter((i) => i.status === 'OPEN' || i.status === 'ESCALATED'),
    recentIncidents: incidents.slice(0, 80),
    incidentsLast24h: view24h.counts,
    incidentsLast7d: view7d.counts,
    hourlyIncidents24h: view24h.timeline,
    incidentView24h: toPeriodView(view24h),
    incidentView7d: toPeriodView(view7d),
    remediationsLast24h: countRemediationsByPlaybookSince(remediations, since24h),
    remediationsLast7d: countRemediationsByPlaybookSince(remediations, since7d),
    humanActionRequired: actionRequired.needed,
    remediations: remediations.slice(0, 40),
    notifications: listOpsNotifications().slice(0, 40),
    thresholds: getThresholdDefinitions(),
    notificationChannels: getNotificationChannelStatuses(),
    simulationMode: Boolean(getOpsSimulation()),
    concurrencyGuard: {
      corendon: CORENDON_LIVE_MATCHSET_CONCURRENCY,
      sunweb: SUNWEB_LIVE_MATCHSET_CONCURRENCY,
      eliza: ELIZA_LIVE_PAGE1_CONCURRENCY,
      unchanged: true,
    },
    incidentCountRule: INCIDENT_COUNT_RULE,
  };
}
