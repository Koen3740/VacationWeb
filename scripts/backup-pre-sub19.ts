import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import { utcCompactTimestamp } from '../lib/offers/generation-id';
import {
  backupCatalogKey,
  backupDetailsKey,
  backupNoteKey,
} from '../lib/offers/generation-paths';
import type { PreSub19BackupNote } from '../lib/offers/generation-types';
import {
  downloadStorageObject,
  putStorageBytes,
  putStorageObject,
} from '../lib/storage/object-storage-client';

function countCatalog(raw: string): { offerCount: number; providers: Record<string, number> } {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Source offers.json is not a JSON array');
  }
  if (parsed.length === 0) {
    throw new Error('Source offers.json is empty — refusing backup of empty dataset');
  }
  const providers: Record<string, number> = {};
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const provider = String((item as { provider?: unknown }).provider ?? '').trim() || 'unknown';
    providers[provider] = (providers[provider] ?? 0) + 1;
  }
  return { offerCount: parsed.length, providers };
}

function countDetails(raw: string): number {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Source offers.detail.json is not a JSON object');
  }
  return Object.keys(parsed as Record<string, unknown>).length;
}

async function main(): Promise<void> {
  const backupId = utcCompactTimestamp();
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-pre-sub19-'));
  const sourceCatalogPath = path.join(workDir, 'source-offers.json');
  const sourceDetailsPath = path.join(workDir, 'source-offers.detail.json');
  const backupCatalogPath = path.join(workDir, 'backup-offers.json');
  const backupDetailsPath = path.join(workDir, 'backup-offers.detail.json');

  const catalogKey = FEED_PATHS.offersObjectKey;
  const detailsKey = FEED_PATHS.offerDetailsObjectKey;

  console.log(`Sub 19 backup ${backupId}`);
  console.log(`  source catalog key: ${catalogKey}`);
  console.log(`  source details key: ${detailsKey}`);

  const sourceCatalog = await downloadStorageObject(catalogKey, sourceCatalogPath);
  const sourceDetails = await downloadStorageObject(detailsKey, sourceDetailsPath);
  const catalogStats = countCatalog(fs.readFileSync(sourceCatalogPath, 'utf8'));
  const detailCount = countDetails(fs.readFileSync(sourceDetailsPath, 'utf8'));

  if (sourceCatalog.byteSize !== fs.statSync(sourceCatalogPath).size) {
    throw new Error('Source catalog byte size mismatch after download');
  }
  if (sourceDetails.byteSize !== fs.statSync(sourceDetailsPath).size) {
    throw new Error('Source details byte size mismatch after download');
  }

  const destCatalogKey = backupCatalogKey(backupId);
  const destDetailsKey = backupDetailsKey(backupId);
  const destNoteKey = backupNoteKey(backupId);

  await putStorageObject(destCatalogKey, sourceCatalogPath);
  await putStorageObject(destDetailsKey, sourceDetailsPath);

  const verifiedCatalog = await downloadStorageObject(destCatalogKey, backupCatalogPath);
  const verifiedDetails = await downloadStorageObject(destDetailsKey, backupDetailsPath);
  const backupCatalogStats = countCatalog(fs.readFileSync(backupCatalogPath, 'utf8'));
  const backupDetailCount = countDetails(fs.readFileSync(backupDetailsPath, 'utf8'));

  const verified =
    verifiedCatalog.sha256 === sourceCatalog.sha256 &&
    verifiedDetails.sha256 === sourceDetails.sha256 &&
    verifiedCatalog.byteSize === sourceCatalog.byteSize &&
    verifiedDetails.byteSize === sourceDetails.byteSize &&
    backupCatalogStats.offerCount === catalogStats.offerCount &&
    backupDetailCount === detailCount;

  const note: PreSub19BackupNote = {
    backupId,
    timestamp: new Date().toISOString(),
    sourceKeys: {
      catalog: catalogKey,
      details: detailsKey,
    },
    source: {
      catalogBytes: sourceCatalog.byteSize,
      detailsBytes: sourceDetails.byteSize,
      catalogSha256: sourceCatalog.sha256,
      detailsSha256: sourceDetails.sha256,
      offerCount: catalogStats.offerCount,
      detailCount,
      providers: catalogStats.providers,
    },
    backupKeys: {
      catalog: destCatalogKey,
      details: destDetailsKey,
      note: destNoteKey,
    },
    backup: {
      catalogBytes: verifiedCatalog.byteSize,
      detailsBytes: verifiedDetails.byteSize,
      catalogSha256: verifiedCatalog.sha256,
      detailsSha256: verifiedDetails.sha256,
      offerCount: backupCatalogStats.offerCount,
      detailCount: backupDetailCount,
    },
    verified,
  };

  await putStorageBytes(destNoteKey, JSON.stringify(note, null, 2));
  const localNote = path.join(process.cwd(), 'data', `_pre-sub19-backup-${backupId}.json`);
  fs.mkdirSync(path.dirname(localNote), { recursive: true });
  fs.writeFileSync(localNote, JSON.stringify(note, null, 2));

  console.log(JSON.stringify({
    backupId,
    verified,
    source: note.source,
    backup: note.backup,
    backupKeys: note.backupKeys,
    localNote,
  }, null, 2));

  fs.rmSync(workDir, { recursive: true, force: true });

  if (!verified) {
    throw new Error('Backup verification FAILED — SHA-256 / size / counts do not match. STOP.');
  }

  console.log('✔ Backup verification PASS');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Backup failed: ${message}`);
  process.exitCode = 1;
});
