import { existsSync } from 'node:fs';
import type { DestinationMediaPool, DestinationMediaPoolAsset } from './types';
import { getVacationWebNextRoot, masterAbsolutePath } from './paths';

export type ListFinalOptions = {
  root?: string;
  /** Require master file on disk (default true). */
  requireMasterPresent?: boolean;
};

/**
 * FINAL_VERIFIED_USABLE assets for THIS pool destination only.
 * Drops cross-destination rows and missing masters.
 */
export function listFinalVerifiedUsableAssets(
  pool: DestinationMediaPool,
  options: ListFinalOptions = {},
): DestinationMediaPoolAsset[] {
  const root = options.root ?? getVacationWebNextRoot();
  const requireMaster = options.requireMasterPresent !== false;

  return pool.assets.filter((a) => {
    if (!a || typeof a !== 'object') return false;
    if (a.destinationId !== pool.destinationId) return false;
    if (a.pipelineStatus !== 'FINAL_VERIFIED_USABLE') return false;
    if (typeof a.assetId !== 'string' || !a.assetId.trim()) return false;
    if (typeof a.masterPath !== 'string' || !a.masterPath.trim()) return false;
    if (requireMaster) {
      const abs = masterAbsolutePath(a.masterPath, root);
      if (!existsSync(abs)) return false;
    }
    return true;
  });
}
