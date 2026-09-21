import { existsSync, readFileSync } from 'node:fs';
import type { DestinationMediaPool } from './types';
import {
  destinationMediaPoolFilePath,
  getVacationWebNextRoot,
} from './paths';

export type LoadDestinationMediaPoolOptions = {
  root?: string;
};

function stripBom(text: string): string {
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) {
    return text.slice(1);
  }
  return text;
}

/**
 * Load Destination Media Pool JSON for one destinationId.
 * Returns null when file missing or invalid — caller keeps Discover seed image.
 */
export function loadDestinationMediaPool(
  destinationId: string,
  options: LoadDestinationMediaPoolOptions = {},
): DestinationMediaPool | null {
  const root = options.root ?? getVacationWebNextRoot();
  const filePath = destinationMediaPoolFilePath(destinationId, root);
  if (!existsSync(filePath)) return null;

  try {
    const rawText = stripBom(readFileSync(filePath, 'utf8'));
    const raw = JSON.parse(rawText) as DestinationMediaPool;
    if (!raw || typeof raw !== 'object') return null;
    if (raw.destinationId !== destinationId) return null;
    if (!Array.isArray(raw.assets)) return null;
    return raw;
  } catch {
    return null;
  }
}
