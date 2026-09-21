import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { DestinationMediaPoolAsset } from './types';
import {
  getVacationWebNextRoot,
  masterAbsolutePath,
  verifiedAbsoluteDir,
  verifiedPublicUrl,
} from './paths';

export type EnsureVerifiedWebPathOptions = {
  root?: string;
  /** When false, do not copy — only return URL if file already present. Default true. */
  copyIfMissing?: boolean;
};

/**
 * Ensure master is available under public/images/verified/{destinationId}/
 * (AN-013 web serve path). Returns public URL or null.
 */
export function ensureVerifiedWebPath(
  asset: DestinationMediaPoolAsset,
  options: EnsureVerifiedWebPathOptions = {},
): string | null {
  const root = options.root ?? getVacationWebNextRoot();
  const copyIfMissing = options.copyIfMissing !== false;

  const masterAbs = masterAbsolutePath(asset.masterPath, root);
  if (!existsSync(masterAbs)) return null;

  const ext = path.extname(masterAbs) || '.jpg';
  const fileName = `${asset.assetId}${ext}`;
  const destDir = verifiedAbsoluteDir(asset.destinationId, root);
  const destAbs = path.join(destDir, fileName);
  const publicUrl = verifiedPublicUrl(asset.destinationId, fileName);

  if (!existsSync(destAbs)) {
    if (!copyIfMissing) return null;
    mkdirSync(destDir, { recursive: true });
    copyFileSync(masterAbs, destAbs);
  }

  return publicUrl;
}
