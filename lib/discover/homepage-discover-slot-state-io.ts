import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE } from './homepage-discover-slots';
import {
  HOMEPAGE_DISCOVER_LIMIT,
  type DiscoverHomepageSlot,
  type DiscoverHomepageSlotState,
  type DiscoverSlotIndex,
} from './types';

/** Default relative path for persisted homepage Discover slot state. */
export const DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE_RELATIVE_PATH =
  'data/discover/homepage-discover-slots.json' as const;

/**
 * Resolve absolute path for the homepage Discover slot state JSON file.
 */
export function resolveHomepageDiscoverSlotStatePath(
  cwd: string = process.cwd(),
): string {
  return join(cwd, DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE_RELATIVE_PATH);
}

function isSlotIndex(value: unknown): value is DiscoverSlotIndex {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 4
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/**
 * Runtime guard for DiscoverHomepageSlotState loaded from JSON.
 * - slots array length 1..HOMEPAGE_DISCOVER_LIMIT
 * - each slotIndex 0..4
 * - destinationId string | null
 * - previousDestinationId string | null | undefined
 */
export function isValidHomepageDiscoverSlotState(
  value: unknown,
): value is DiscoverHomepageSlotState {
  if (value == null || typeof value !== 'object') return false;
  const slots = (value as { slots?: unknown }).slots;
  if (!Array.isArray(slots)) return false;
  if (slots.length < 1 || slots.length > HOMEPAGE_DISCOVER_LIMIT) return false;

  const seen = new Set<number>();
  for (const slot of slots) {
    if (slot == null || typeof slot !== 'object') return false;
    const s = slot as Record<string, unknown>;
    if (!isSlotIndex(s.slotIndex)) return false;
    if (seen.has(s.slotIndex)) return false;
    seen.add(s.slotIndex);
    if (!isNullableString(s.destinationId)) return false;
    if (
      s.previousDestinationId !== undefined &&
      !isNullableString(s.previousDestinationId)
    ) {
      return false;
    }
  }
  return true;
}

function cloneSlotState(
  state: DiscoverHomepageSlotState,
): DiscoverHomepageSlotState {
  return {
    slots: state.slots.map(
      (s): DiscoverHomepageSlot => ({
        slotIndex: s.slotIndex,
        destinationId: s.destinationId,
        previousDestinationId: s.previousDestinationId,
      }),
    ),
  };
}

export type LoadHomepageDiscoverSlotStateOptions = {
  filePath?: string;
};

/**
 * Load homepage Discover slot state from JSON.
 * Missing file / invalid JSON / invalid shape → deep clone of DEFAULT
 * (do NOT invent destinations; do NOT auto-write).
 */
export function loadHomepageDiscoverSlotState(
  options: LoadHomepageDiscoverSlotStateOptions = {},
): DiscoverHomepageSlotState {
  const filePath =
    options.filePath ?? resolveHomepageDiscoverSlotStatePath();

  if (!existsSync(filePath)) {
    return cloneSlotState(DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE);
  }

  let parsed: unknown;
  try {
    const raw = readFileSync(filePath, 'utf8');
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return cloneSlotState(DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE);
  }

  if (!isValidHomepageDiscoverSlotState(parsed)) {
    return cloneSlotState(DEFAULT_HOMEPAGE_DISCOVER_SLOT_STATE);
  }

  return cloneSlotState(parsed);
}

export type SaveHomepageDiscoverSlotStateOptions = {
  filePath?: string;
};

/**
 * Persist homepage Discover slot state as pretty UTF-8 JSON.
 * Creates parent directories as needed.
 */
export function saveHomepageDiscoverSlotState(
  state: DiscoverHomepageSlotState,
  options: SaveHomepageDiscoverSlotStateOptions = {},
): void {
  const filePath =
    options.filePath ?? resolveHomepageDiscoverSlotStatePath();
  mkdirSync(dirname(filePath), { recursive: true });
  const body = `${JSON.stringify(state, null, 2)}\n`;
  writeFileSync(filePath, body, 'utf8');
}
