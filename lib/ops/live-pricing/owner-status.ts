/**
 * N-065 owner display semantics (cockpit status layer only).
 * Does not change S6 engine or live-pricing concurrency.
 *
 * IDLE  = no pricing signal (no attempts, no S6 run recorded, no coverage progress)
 * GREEN = normal ops AND no unresolved product coverage shortfall
 * Technical recovery ≠ product goal met
 */

import type {
  CoverageOpsView,
  OpsEvaluationInput,
  OpsZone,
} from './types';
import { maxZone, type ZoneTrigger } from './zones';

export type OwnerDisplayStatus = 'IDLE' | OpsZone;

export type OwnerActionCard = {
  needed: boolean;
  answer: 'JA' | 'NEE';
  title: string;
  detail: string;
};

export type ProductCoverageState = {
  productGoalMet: boolean;
  shortfall: boolean;
  s6Filling: boolean;
  label: string;
};

export function hasPricingSignal(input: Pick<OpsEvaluationInput, 'attempts' | 'coverage'>): boolean {
  const cov = input.coverage;
  return (
    input.attempts > 0 ||
    cov.attempts > 0 ||
    cov.s6Active ||
    cov.lastS6At != null ||
    cov.presentableB > 0 ||
    Boolean(cov.s6StopReason)
  );
}

export function isProductGoalMet(cov: CoverageOpsView): boolean {
  if (cov.presentableB >= cov.targetB) {
    return true;
  }
  return cov.s6StopReason === 'target_met' || cov.s6StopReason === 'already_met';
}

export function getProductCoverageState(cov: CoverageOpsView): ProductCoverageState {
  const productGoalMet = isProductGoalMet(cov);
  const shortfall = !productGoalMet && cov.deficit > 0;
  const s6Filling = cov.s6Active && shortfall;
  let label = 'Productdoel gehaald (150 presentable B)';
  if (s6Filling) {
    label = 'S6 vult aan tot 150 presentable B';
  } else if (shortfall) {
    label = `Productdoel niet gehaald — ${cov.presentableB}/${cov.targetB} B (${cov.s6StopReason ?? 'geen stopreason'})`;
  } else if (!cov.lastS6At && cov.presentableB === 0) {
    label = 'Nog geen S6/coverage-meting';
  }
  return { productGoalMet, shortfall, s6Filling, label };
}

/**
 * Owner-facing status. Coverage shortfall (after S6 stopped) never presents as plain GREEN.
 * Cold system with no pricing signal → IDLE (not GREEN with 0/150).
 */
export function resolveOwnerDisplayStatus(
  technicalZone: OpsZone,
  input: OpsEvaluationInput,
): OwnerDisplayStatus {
  const signal = hasPricingSignal(input);
  const cov = getProductCoverageState(input.coverage);

  if (!signal && technicalZone === 'GREEN') {
    return 'IDLE';
  }

  if (cov.s6Filling && technicalZone === 'GREEN') {
    // Filling toward 150 is operationally healthy but not "product goal met".
    // Keep GREEN for technical health; UI shows S6 ACTIVE + progress separately.
    return 'GREEN';
  }

  if (cov.shortfall && !cov.s6Filling) {
    // Ensure at least YELLOW on the owner surface when product goal missed.
    return maxZone(technicalZone, 'YELLOW') as OwnerDisplayStatus;
  }

  return technicalZone;
}

export function buildOwnerActionCard(
  status: OwnerDisplayStatus,
  coverage: ProductCoverageState,
): OwnerActionCard {
  if (status === 'IDLE') {
    return {
      needed: false,
      answer: 'NEE',
      title: 'NEE',
      detail: 'Geen actieve pricing-run. Idle — wacht op zoekverkeer.',
    };
  }
  if (status === 'GREEN') {
    if (coverage.s6Filling) {
      return {
        needed: false,
        answer: 'NEE',
        title: 'NEE',
        detail: 'Technisch gezond. S6 vult nog aan tot 150 presentable B.',
      };
    }
    if (coverage.shortfall) {
      return {
        needed: false,
        answer: 'NEE',
        title: 'NEE',
        detail:
          'Technische metrics groen, maar productdoel 150 B nog niet gehaald — zie Live Coverage.',
      };
    }
    return {
      needed: false,
      answer: 'NEE',
      title: 'NEE',
      detail: 'Geen actie nodig.',
    };
  }
  if (status === 'YELLOW') {
    return {
      needed: false,
      answer: 'NEE',
      title: 'NEE',
      detail:
        'Het systeem detecteerde een kleine afwijking en probeert deze automatisch op te lossen.',
    };
  }
  if (status === 'ORANGE') {
    return {
      needed: true,
      answer: 'JA',
      title: 'JA',
      detail:
        'Er is een serieuze afwijking. Automatische remediation is actief en de eigenaar is geïnformeerd.',
    };
  }
  return {
    needed: true,
    answer: 'JA',
    title: 'JA',
    detail:
      'Kritieke situatie. Beschermingsmaatregelen zijn actief en menselijke opvolging kan nodig zijn.',
  };
}

export function ownerStatusHeadline(status: OwnerDisplayStatus): { emoji: string; title: string; subtitle: string } {
  switch (status) {
    case 'IDLE':
      return { emoji: '⚪', title: 'IDLE', subtitle: 'Geen actieve pricing-run' };
    case 'GREEN':
      return { emoji: '🟢', title: 'GREEN', subtitle: 'Alles normaal' };
    case 'YELLOW':
      return { emoji: '🟡', title: 'YELLOW', subtitle: 'Systeem herstelt automatisch' };
    case 'ORANGE':
      return { emoji: '🟠', title: 'ORANGE', subtitle: 'Aandacht vereist' };
    case 'RED':
      return { emoji: '🔴', title: 'RED', subtitle: 'Actie vereist' };
  }
}

/** Metrics that represent product coverage — must not auto-resolve on technical GREEN alone. */
export function isProductCoverageMetric(metric: string): boolean {
  return metric === 'coverage_deficit' || metric === 's6_no_progress';
}

export function elevateTriggersForCoverage(
  triggers: ZoneTrigger[],
  input: OpsEvaluationInput,
): ZoneTrigger[] {
  // zones.ts already emits coverage triggers; this is a safety net for owner eval.
  return triggers;
}
