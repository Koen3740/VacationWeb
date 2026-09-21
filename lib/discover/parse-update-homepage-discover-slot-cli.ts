/**
 * BUILD 04 — CLI arg parse for updateHomepageDiscoverSlots caller.
 * No pool/selection/rotation logic — only argv shape → { slotIndex, destinationId }.
 */
import type { DiscoverSlotIndex } from './types';
import type { PhasedSlotUpdate } from './apply-phased-slot-updates';

export type ParseUpdateHomepageDiscoverSlotCliResult =
  | {
      ok: true;
      update: PhasedSlotUpdate;
      filePath?: string;
    }
  | { ok: false; reason: string };

function isSlotIndex(n: number): n is DiscoverSlotIndex {
  return Number.isInteger(n) && n >= 0 && n <= 4;
}

/**
 * Parse argv tokens after node/script.
 * Accepted:
 *   --slot <0-4> --destinationId <id>
 *   --slot <0-4> --clear
 * Optional:
 *   --file <path>  (state JSON override for tests)
 */
export function parseUpdateHomepageDiscoverSlotCliArgs(
  argv: string[],
): ParseUpdateHomepageDiscoverSlotCliResult {
  let slotRaw: string | undefined;
  let destinationId: string | undefined;
  let clear = false;
  let filePath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--slot') {
      slotRaw = argv[++i];
      continue;
    }
    if (a === '--destinationId') {
      destinationId = argv[++i];
      continue;
    }
    if (a === '--clear') {
      clear = true;
      continue;
    }
    if (a === '--file') {
      filePath = argv[++i];
      continue;
    }
    if (a === '--help' || a === '-h') {
      return {
        ok: false,
        reason:
          'Usage: --slot <0-4> (--destinationId <poolId> | --clear) [--file <path>]',
      };
    }
    return { ok: false, reason: `Unknown argument: ${a}` };
  }

  if (slotRaw == null || slotRaw === '') {
    return { ok: false, reason: 'Missing --slot <0-4>' };
  }
  const slotNum = Number(slotRaw);
  if (!isSlotIndex(slotNum)) {
    return { ok: false, reason: `Invalid --slot (must be integer 0-4): ${slotRaw}` };
  }

  if (clear && destinationId != null) {
    return {
      ok: false,
      reason: 'Use either --destinationId or --clear, not both',
    };
  }
  if (!clear && (destinationId == null || destinationId === '')) {
    return {
      ok: false,
      reason: 'Missing --destinationId <id> or --clear',
    };
  }

  const update: PhasedSlotUpdate = {
    slotIndex: slotNum,
    destinationId: clear ? null : (destinationId as string),
  };

  return filePath
    ? { ok: true, update, filePath }
    : { ok: true, update };
}