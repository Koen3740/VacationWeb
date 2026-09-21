/**
 * AN-064 zone evaluation from ops metrics + thresholds.
 */

import type { OpsEvaluationInput, OpsMetricId, OpsZone } from './types';
import {
  OPS_A_RATE_YELLOW,
  OPS_B_RATE_ORANGE,
  OPS_C_RATE_ORANGE,
  OPS_C_RATE_RED,
  OPS_C_RATE_YELLOW,
  OPS_CIRCUIT_OPENS_ORANGE,
  OPS_CIRCUIT_OPENS_RED,
  OPS_CIRCUIT_OPENS_YELLOW,
  OPS_MIN_ATTEMPTS_FOR_RATE,
  OPS_TRANSPORT_DOMINANCE_MIN,
  OPS_TRANSPORT_DOMINANCE_SHARE,
} from './thresholds';

export type ZoneTrigger = {
  zone: OpsZone;
  metric: OpsMetricId;
  actualValue: number;
  threshold: number;
  provider: string | null;
  cSubtype: string | null;
  cause: string;
};

const ZONE_RANK: Record<OpsZone, number> = {
  GREEN: 0,
  YELLOW: 1,
  ORANGE: 2,
  RED: 3,
};

export function maxZone(a: OpsZone, b: OpsZone): OpsZone {
  return ZONE_RANK[a] >= ZONE_RANK[b] ? a : b;
}

function dominantTransport(input: OpsEvaluationInput): {
  code: string;
  count: number;
  share: number;
} | null {
  const entries = Object.entries(input.byTransportErrorCode);
  if (entries.length === 0) {
    return null;
  }
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  if (total < OPS_TRANSPORT_DOMINANCE_MIN) {
    return null;
  }
  entries.sort((a, b) => b[1] - a[1]);
  const [code, count] = entries[0]!;
  return { code, count, share: count / total };
}

export function evaluateOpsZoneTriggers(input: OpsEvaluationInput): ZoneTrigger[] {
  const triggers: ZoneTrigger[] = [];
  const ratesReady = input.attempts >= OPS_MIN_ATTEMPTS_FOR_RATE;

  if (ratesReady) {
    if (input.cRate >= OPS_C_RATE_RED) {
      triggers.push({
        zone: 'RED',
        metric: 'c_rate',
        actualValue: input.cRate,
        threshold: OPS_C_RATE_RED,
        provider: null,
        cSubtype: null,
        cause: `Overall C-rate ${(input.cRate * 100).toFixed(1)}% ≥ RED ${(OPS_C_RATE_RED * 100).toFixed(0)}% (CHG-039 alarm)`,
      });
    } else if (input.cRate >= OPS_C_RATE_ORANGE) {
      triggers.push({
        zone: 'ORANGE',
        metric: 'c_rate',
        actualValue: input.cRate,
        threshold: OPS_C_RATE_ORANGE,
        provider: null,
        cSubtype: null,
        cause: `Overall C-rate ${(input.cRate * 100).toFixed(1)}% ≥ ORANGE ${(OPS_C_RATE_ORANGE * 100).toFixed(0)}%`,
      });
    } else if (input.cRate >= OPS_C_RATE_YELLOW) {
      triggers.push({
        zone: 'YELLOW',
        metric: 'c_rate',
        actualValue: input.cRate,
        threshold: OPS_C_RATE_YELLOW,
        provider: null,
        cSubtype: null,
        cause: `Overall C-rate ${(input.cRate * 100).toFixed(1)}% ≥ YELLOW ${(OPS_C_RATE_YELLOW * 100).toFixed(0)}% (above quiet ~1%)`,
      });
    }

    if (input.aRate >= OPS_A_RATE_YELLOW && input.a > input.b) {
      triggers.push({
        zone: 'YELLOW',
        metric: 'a_rate',
        actualValue: input.aRate,
        threshold: OPS_A_RATE_YELLOW,
        provider: null,
        cSubtype: null,
        cause: `A-rate ${(input.aRate * 100).toFixed(1)}% with A>B — unavailable dominating`,
      });
    }

    if (input.bRate < OPS_B_RATE_ORANGE && input.cRate >= OPS_C_RATE_YELLOW) {
      triggers.push({
        zone: 'ORANGE',
        metric: 'b_rate',
        actualValue: input.bRate,
        threshold: OPS_B_RATE_ORANGE,
        provider: null,
        cSubtype: null,
        cause: `B-rate ${(input.bRate * 100).toFixed(1)}% < ${(OPS_B_RATE_ORANGE * 100).toFixed(0)}% with elevated C`,
      });
    }

    for (const [provider, row] of Object.entries(input.byProvider)) {
      if (row.attempts < OPS_MIN_ATTEMPTS_FOR_RATE) {
        continue;
      }
      if (row.cRate >= OPS_C_RATE_RED) {
        triggers.push({
          zone: 'RED',
          metric: 'provider_c_rate',
          actualValue: row.cRate,
          threshold: OPS_C_RATE_RED,
          provider,
          cSubtype: null,
          cause: `${provider} C-rate ${(row.cRate * 100).toFixed(1)}% ≥ RED`,
        });
      } else if (row.cRate >= OPS_C_RATE_ORANGE) {
        triggers.push({
          zone: 'ORANGE',
          metric: 'provider_c_rate',
          actualValue: row.cRate,
          threshold: OPS_C_RATE_ORANGE,
          provider,
          cSubtype: null,
          cause: `${provider} C-rate ${(row.cRate * 100).toFixed(1)}% ≥ ORANGE`,
        });
      } else if (row.cRate >= OPS_C_RATE_YELLOW) {
        triggers.push({
          zone: 'YELLOW',
          metric: 'provider_c_rate',
          actualValue: row.cRate,
          threshold: OPS_C_RATE_YELLOW,
          provider,
          cSubtype: null,
          cause: `${provider} C-rate ${(row.cRate * 100).toFixed(1)}% ≥ YELLOW`,
        });
      }
    }
  }

  if (input.circuitOpenCount >= OPS_CIRCUIT_OPENS_RED) {
    triggers.push({
      zone: 'RED',
      metric: 'circuit_opens',
      actualValue: input.circuitOpenCount,
      threshold: OPS_CIRCUIT_OPENS_RED,
      provider: null,
      cSubtype: null,
      cause: `Circuit opens ${input.circuitOpenCount} ≥ RED ${OPS_CIRCUIT_OPENS_RED}`,
    });
  } else if (input.circuitOpenCount >= OPS_CIRCUIT_OPENS_ORANGE) {
    triggers.push({
      zone: 'ORANGE',
      metric: 'circuit_opens',
      actualValue: input.circuitOpenCount,
      threshold: OPS_CIRCUIT_OPENS_ORANGE,
      provider: null,
      cSubtype: null,
      cause: `Circuit opens ${input.circuitOpenCount} ≥ ORANGE ${OPS_CIRCUIT_OPENS_ORANGE}`,
    });
  } else if (input.circuitOpenCount >= OPS_CIRCUIT_OPENS_YELLOW) {
    triggers.push({
      zone: 'YELLOW',
      metric: 'circuit_opens',
      actualValue: input.circuitOpenCount,
      threshold: OPS_CIRCUIT_OPENS_YELLOW,
      provider: null,
      cSubtype: null,
      cause: `Circuit open count ${input.circuitOpenCount} — CHG-039 skip path required`,
    });
  }

  const cov = input.coverage;
  const productGoalMet =
    cov.presentableB >= cov.targetB ||
    cov.s6StopReason === 'target_met' ||
    cov.s6StopReason === 'already_met';
  const hasCoverageSignal =
    input.attempts > 0 ||
    cov.attempts > 0 ||
    cov.s6Active ||
    cov.lastS6At != null ||
    cov.presentableB > 0 ||
    Boolean(cov.s6StopReason);

  // Product shortfall after S6 stopped (or known incomplete coverage) — never silent GREEN.
  // While S6 is actively filling, do not raise a coverage incident (progress is expected).
  if (hasCoverageSignal && cov.deficit > 0 && !productGoalMet && !cov.s6Active) {
    if (cov.s6StopReason === 'no_progress' || cov.s6StopReason === 'max_attempts') {
      triggers.push({
        zone: 'ORANGE',
        metric: 's6_no_progress',
        actualValue: cov.deficit,
        threshold: 1,
        provider: null,
        cSubtype: null,
        cause: `S6 stopped (${cov.s6StopReason}) with ${cov.presentableB}/${cov.targetB} presentable B — product goal not met`,
      });
    } else {
      triggers.push({
        zone: 'YELLOW',
        metric: 'coverage_deficit',
        actualValue: cov.deficit,
        threshold: 1,
        provider: null,
        cSubtype: null,
        cause: `Coverage ${cov.presentableB}/${cov.targetB} presentable B; stopReason=${cov.s6StopReason ?? 'unknown'} — product goal not met`,
      });
    }
  }

  const dom = dominantTransport(input);
  if (dom && dom.share >= OPS_TRANSPORT_DOMINANCE_SHARE) {
    triggers.push({
      zone: 'YELLOW',
      metric: 'transport_subtype_share',
      actualValue: dom.share,
      threshold: OPS_TRANSPORT_DOMINANCE_SHARE,
      provider: null,
      cSubtype: dom.code,
      cause: `Transport subtype ${dom.code} dominates (${(dom.share * 100).toFixed(0)}% of tagged C)`,
    });
  }

  return triggers;
}

export function resolveOverallZone(triggers: ZoneTrigger[]): OpsZone {
  let zone: OpsZone = 'GREEN';
  for (const t of triggers) {
    zone = maxZone(zone, t.zone);
  }
  return zone;
}
