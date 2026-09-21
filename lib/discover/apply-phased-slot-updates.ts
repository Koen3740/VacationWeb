import type {
  DiscoverHomepageSlot,
  DiscoverHomepageSlotState,
  DiscoverSlotIndex,
} from './types';

export type PhasedSlotUpdate = {
  slotIndex: DiscoverSlotIndex;
  destinationId: string | null;
};

export type ApplyPhasedSlotUpdatesResult =
  | { ok: true; state: DiscoverHomepageSlotState }
  | { ok: false; reason: string };

/**
 * Apply caller-provided slot updates with phased-rotation readiness rule.
 *
 * When setting a new destinationId different from current, set
 * previousDestinationId to the old current (if non-null) — enables failsafe.
 *
 * Phased rule: never replace ALL currently-filled slots in one update batch.
 * - filledCount = slots with non-null destinationId
 * - changeCount = updates that change a filled slot's destinationId to a different id (or null)
 * - If changeCount >= filledCount AND filledCount >= 2 → reject
 *
 * NO cron, NO auto pick from pool beyond what caller passes.
 */
export function applyPhasedSlotUpdates(
  state: DiscoverHomepageSlotState,
  updates: PhasedSlotUpdate[],
): ApplyPhasedSlotUpdatesResult {
  const slots: DiscoverHomepageSlot[] = state.slots.map((s) => ({ ...s }));

  const filledCount = slots.filter((s) => s.destinationId != null).length;

  let changeCount = 0;
  for (const update of updates) {
    const slot = slots.find((s) => s.slotIndex === update.slotIndex);
    if (!slot) {
      return {
        ok: false,
        reason: `Unknown slotIndex ${update.slotIndex}`,
      };
    }
    const wasFilled = slot.destinationId != null;
    const changes =
      wasFilled && slot.destinationId !== update.destinationId;
    if (changes) changeCount += 1;
  }

  if (filledCount >= 2 && changeCount >= filledCount) {
    return {
      ok: false,
      reason: `Phased rotation rule: cannot replace all ${filledCount} filled slots in one update batch (changeCount=${changeCount}). Apply updates in phases.`,
    };
  }

  for (const update of updates) {
    const idx = slots.findIndex((s) => s.slotIndex === update.slotIndex);
    if (idx < 0) {
      return {
        ok: false,
        reason: `Unknown slotIndex ${update.slotIndex}`,
      };
    }
    const slot = slots[idx];
    const oldId = slot.destinationId;
    const newId = update.destinationId;

    if (oldId !== newId) {
      const previous =
        oldId != null ? oldId : (slot.previousDestinationId ?? null);
      slots[idx] = {
        ...slot,
        destinationId: newId,
        previousDestinationId: previous,
      };
    }
  }

  return { ok: true, state: { slots } };
}
