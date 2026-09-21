/**
 * AN-064 zone thresholds — evidence-backed, not invented round numbers.
 *
 * Evidence status labels:
 * - MEASURED: direct empirical value from C-logs / AN-*
 * - DERIVED: calculated from MEASURED anchors (e.g. multiple of quiet C-rate)
 * - POLICY: already encoded in product code / CHG (must align)
 * - UNKNOWN: insufficient evidence — safe temporary boundary only
 */

import type { ThresholdDefinition } from './types';

/** Align with CHG-039 ops alarm already in live-price-observability. */
export const OPS_MIN_ATTEMPTS_FOR_RATE = 20;

/**
 * Quiet-band unique C-rate ~0.8–0.94% (C08/C09 MEASURED).
 * YELLOW floor = ~5× quiet band → 5% DERIVED (not a round aesthetic pick;
 * chosen as first meaningful elevation above noise without waiting for CHG-039 alarm).
 */
export const OPS_C_RATE_YELLOW = 0.05;

/**
 * Mid band between quiet (~1%) and CHG-039 alarm (25%).
 * DERIVED midpoint of [YELLOW, RED) for ORANGE escalation.
 */
export const OPS_C_RATE_ORANGE = 0.15;

/**
 * POLICY = existing LIVE_PRICE_C_RATE_ALARM_THRESHOLD (0.25) from CHG-039.
 * Also aligns with storm territory vs quiet ~1% (AN-048 / C07 contrast).
 */
export const OPS_C_RATE_RED = 0.25;

/**
 * A-rate YELLOW: Spain/quiet mixes often have substantial A (unavailable).
 * Without a stable prod A-rate SSOT, treat elevated A as informational YELLOW
 * only when A dominates outcomes (A > B and A-rate ≥ 40%) — DERIVED from
 * "A is expected; domination is not".
 */
export const OPS_A_RATE_YELLOW = 0.4;

/**
 * B-rate floor for ORANGE when attempts ≥ min: useful B below ~35%
 * while C is also elevated is a throughput concern (AN-048 useful B/s framing).
 * DERIVED — not a product SLA; UNKNOWN for absolute floor alone.
 */
export const OPS_B_RATE_ORANGE = 0.35;

/**
 * Coverage deficit while S6 stopped without target_met.
 * POLICY: product target is 150 presentable B (AN-063 / S6_TARGET).
 */
export const OPS_COVERAGE_TARGET_B = 150;

/**
 * Circuit opens in process window.
 * C03: 5 failures → one open. Multiple opens = repeated storms.
 * YELLOW ≥1 MEASURED trigger existence; ORANGE ≥3 DERIVED (repeated);
 * RED ≥5 DERIVED (sustained storm class).
 */
export const OPS_CIRCUIT_OPENS_YELLOW = 1;
export const OPS_CIRCUIT_OPENS_ORANGE = 3;
export const OPS_CIRCUIT_OPENS_RED = 5;

/**
 * Transport subtype share of C (network_error codes).
 * C05: UND_ERR_CONNECT_TIMEOUT dominant for Sunweb NE.
 * YELLOW when a single code ≥ 50% of transport-tagged C and count ≥ 5 — DERIVED.
 */
export const OPS_TRANSPORT_DOMINANCE_SHARE = 0.5;
export const OPS_TRANSPORT_DOMINANCE_MIN = 5;

export const LIVE_PRICING_OPS_THRESHOLDS: ThresholdDefinition[] = [
  {
    id: 'c_rate_yellow',
    metric: 'c_rate',
    zone: 'YELLOW',
    threshold: OPS_C_RATE_YELLOW,
    window: `rolling process attempts ≥ ${OPS_MIN_ATTEMPTS_FOR_RATE}`,
    source: 'C08/C09 quiet C≈0.8–0.94%; 5× quiet ≈5%',
    evidenceStatus: 'DERIVED',
    rationale:
      'First meaningful elevation above quiet-band C without waiting for the CHG-039 25% alarm.',
    autoAction: 'incident + continue_s6_cursor / respect_circuit_skip / collect_telemetry',
  },
  {
    id: 'c_rate_orange',
    metric: 'c_rate',
    zone: 'ORANGE',
    threshold: OPS_C_RATE_ORANGE,
    window: `rolling process attempts ≥ ${OPS_MIN_ATTEMPTS_FOR_RATE}`,
    source: 'Midpoint between YELLOW 5% and CHG-039 RED 25%',
    evidenceStatus: 'DERIVED',
    rationale: 'Serious deviation; owner notify while safe playbooks still apply.',
    autoAction: 'incident + remediation + owner notification',
  },
  {
    id: 'c_rate_red',
    metric: 'c_rate',
    zone: 'RED',
    threshold: OPS_C_RATE_RED,
    window: `rolling process attempts ≥ ${OPS_MIN_ATTEMPTS_FOR_RATE}`,
    source: 'LIVE_PRICE_C_RATE_ALARM_THRESHOLD / CHG-039; AN-048 alarm alignment',
    evidenceStatus: 'POLICY',
    rationale: 'Matches existing ops alarm; critical C storm territory vs quiet ~1%.',
    autoAction: 'incident CRITICAL + protect_no_config_change + immediate notify/escalate',
  },
  {
    id: 'a_rate_yellow',
    metric: 'a_rate',
    zone: 'YELLOW',
    threshold: OPS_A_RATE_YELLOW,
    window: `attempts ≥ ${OPS_MIN_ATTEMPTS_FOR_RATE} and A > B`,
    source: 'A/B/C SSOT; A expected but domination is unusual for browse windows',
    evidenceStatus: 'DERIVED',
    rationale: 'High confirmed-unavailable share — monitor; do not treat A as B.',
    autoAction: 'incident + continue_s6_cursor (skip settled A overlays)',
  },
  {
    id: 'b_rate_orange',
    metric: 'b_rate',
    zone: 'ORANGE',
    threshold: OPS_B_RATE_ORANGE,
    window: `attempts ≥ ${OPS_MIN_ATTEMPTS_FOR_RATE} and c_rate ≥ YELLOW`,
    source: 'AN-048 useful-B framing; absolute floor UNKNOWN alone',
    evidenceStatus: 'DERIVED',
    rationale: 'Low useful B combined with elevated C indicates throughput stress.',
    autoAction: 'incident + isolate_provider_fault + notify',
  },
  {
    id: 'circuit_opens_yellow',
    metric: 'circuit_opens',
    zone: 'YELLOW',
    threshold: OPS_CIRCUIT_OPENS_YELLOW,
    window: 'process lifetime / sim window',
    source: 'C03 circuit 5 failures → open 30s',
    evidenceStatus: 'MEASURED',
    rationale: 'Any circuit open means selection must skip that provider (CHG-039).',
    autoAction: 'respect_circuit_skip',
  },
  {
    id: 'circuit_opens_orange',
    metric: 'circuit_opens',
    zone: 'ORANGE',
    threshold: OPS_CIRCUIT_OPENS_ORANGE,
    window: 'process lifetime / sim window',
    source: 'Repeated opens beyond single storm (DERIVED from C03 unit)',
    evidenceStatus: 'DERIVED',
    rationale: 'Repeated opens → provider isolation + owner awareness.',
    autoAction: 'isolate_provider_fault + notify',
  },
  {
    id: 'circuit_opens_red',
    metric: 'circuit_opens',
    zone: 'RED',
    threshold: OPS_CIRCUIT_OPENS_RED,
    window: 'process lifetime / sim window',
    source: 'Sustained storm class (DERIVED); concurrency must NOT be raised (C04)',
    evidenceStatus: 'DERIVED',
    rationale: 'Protect platform; escalate; never auto-raise Sunweb concurrency.',
    autoAction: 'protect_no_config_change + escalate',
  },
  {
    id: 'coverage_deficit_yellow',
    metric: 'coverage_deficit',
    zone: 'YELLOW',
    threshold: 1,
    window: 'last S6 telemetry / live coverage view',
    source: 'AN-063 S6_TARGET_PRESENTABLE_B=150 POLICY',
    evidenceStatus: 'POLICY',
    rationale: 'Any deficit vs 150 B while S6 inactive/stopped without target_met is visible YELLOW.',
    autoAction: 'continue_s6_cursor when eligible candidates remain; else document stopReason',
  },
  {
    id: 's6_no_progress_orange',
    metric: 's6_no_progress',
    zone: 'ORANGE',
    threshold: 1,
    window: 'last S6 stopReason=no_progress|max_attempts with deficit>0',
    source: 'AN-063 stopReasons',
    evidenceStatus: 'POLICY',
    rationale: 'S6 gave up with B<150 — owner should see coverage risk.',
    autoAction: 'collect_telemetry + notify; no concurrency change',
  },
  {
    id: 'transport_dominance_yellow',
    metric: 'transport_subtype_share',
    zone: 'YELLOW',
    threshold: OPS_TRANSPORT_DOMINANCE_SHARE,
    window: `transport-tagged C ≥ ${OPS_TRANSPORT_DOMINANCE_MIN}`,
    source: 'C05 UND_ERR_CONNECT_TIMEOUT dominant for Sunweb NE',
    evidenceStatus: 'MEASURED',
    rationale: 'Dominant subtype guides diagnosis; KA/timeout changes remain human DEC.',
    autoAction: 'collect_telemetry + respect_circuit_skip; no timeout/concurrency edit',
  },
];

export function getThresholdDefinitions(): ThresholdDefinition[] {
  return LIVE_PRICING_OPS_THRESHOLDS.map((t) => ({ ...t }));
}
