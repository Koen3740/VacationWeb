import {
  applyPhasedSlotUpdates,
  type ApplyPhasedSlotUpdatesResult,
  type PhasedSlotUpdate,
} from './apply-phased-slot-updates';
import { getDiscoverPool } from './discover-pool';
import {
  loadHomepageDiscoverSlotState,
  saveHomepageDiscoverSlotState,
} from './homepage-discover-slot-state-io';
import type { DiscoverHomepageSlotState } from './types';

export type UpdateHomepageDiscoverSlotsOptions = {
  /** Override path for persisted slot state JSON. */
  filePath?: string;
  /** Optional in-memory state (skips load). Still saves on success. */
  state?: DiscoverHomepageSlotState;
};

/**
 * Apply explicit caller slot updates and persist on success.
 *
 * Flow:
 * 1. Load state (or use options.state)
 * 2. For each update with destinationId != null: must exist in getDiscoverPool()
 * 3. applyPhasedSlotUpdates(state, updates)
 * 4. if ok → saveHomepageDiscoverSlotState
 * 5. return result
 *
 * NO random, NO scheduler, NO picking next from pool.
 */
export function updateHomepageDiscoverSlots(
  updates: PhasedSlotUpdate[],
  options: UpdateHomepageDiscoverSlotsOptions = {},
): ApplyPhasedSlotUpdatesResult {
  const state =
    options.state ??
    loadHomepageDiscoverSlotState(
      options.filePath ? { filePath: options.filePath } : undefined,
    );

  const pool = getDiscoverPool();
  const poolIds = new Set(pool.map((d) => d.destinationId));

  for (const update of updates) {
    if (update.destinationId != null && !poolIds.has(update.destinationId)) {
      return {
        ok: false,
        reason: `destinationId not in Discover pool: ${update.destinationId}`,
      };
    }
  }

  const result = applyPhasedSlotUpdates(state, updates);
  if (result.ok) {
    saveHomepageDiscoverSlotState(result.state, {
      filePath: options.filePath,
    });
  }
  return result;
}
