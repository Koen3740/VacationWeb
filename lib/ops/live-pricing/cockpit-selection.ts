/**
 * N-065.4 — keep cockpit modal selection bound to the current snapshot.
 */

import type { LivePricingCockpitSnapshot, OpsIncident, ProviderOpsRow } from './types';

export function rebindSelectedProvider(
  prev: ProviderOpsRow | null,
  providers: readonly ProviderOpsRow[],
): ProviderOpsRow | null {
  if (!prev) {
    return null;
  }
  return providers.find((p) => p.provider === prev.provider) ?? null;
}

export function rebindSelectedIncident(
  prev: OpsIncident | null,
  snapshot: LivePricingCockpitSnapshot,
): OpsIncident | null {
  if (!prev) {
    return null;
  }
  const pools = [
    snapshot.openIncidents,
    snapshot.recentIncidents,
    snapshot.incidentView24h.incidents,
    snapshot.incidentView7d.incidents,
  ];
  for (const pool of pools) {
    const hit = pool.find((i) => i.id === prev.id);
    if (hit) {
      return hit;
    }
  }
  return null;
}

/** Apply snapshot selection rebind for provider + incident modals. */
export function rebindOpsCockpitSelection(
  snapshot: LivePricingCockpitSnapshot,
  selectedProvider: ProviderOpsRow | null,
  selectedIncident: OpsIncident | null,
): {
  selectedProvider: ProviderOpsRow | null;
  selectedIncident: OpsIncident | null;
} {
  return {
    selectedProvider: rebindSelectedProvider(selectedProvider, snapshot.providers),
    selectedIncident: rebindSelectedIncident(selectedIncident, snapshot),
  };
}
