/**
 * AN-064 simulation scenarios + auth helpers.
 */

import { setOpsSimulation, clearOpsStoreForTests, getOpsSimulation } from './store';
import { evaluateLivePricingOps, getLivePricingCockpitSnapshot } from './evaluate';
import type { LivePricingCockpitSnapshot, SimulatedOpsInput } from './types';

export function runOpsSimulation(
  scenario: SimulatedOpsInput['scenario'],
  overrides: Partial<SimulatedOpsInput> = {},
): LivePricingCockpitSnapshot {
  setOpsSimulation({ scenario, ...overrides });
  return getLivePricingCockpitSnapshot();
}

export function clearOpsSimulation(): LivePricingCockpitSnapshot {
  setOpsSimulation(null);
  return getLivePricingCockpitSnapshot();
}

export function resetOpsSimulationStateForTests(): void {
  clearOpsStoreForTests();
}

export function getActiveOpsSimulation(): SimulatedOpsInput | null {
  return getOpsSimulation();
}

/** Force a fresh evaluation without changing simulation. */
export function refreshOpsEvaluation(): ReturnType<typeof evaluateLivePricingOps> {
  return evaluateLivePricingOps();
}
