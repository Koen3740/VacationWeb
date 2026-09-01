import fs from 'node:fs';
import path from 'node:path';
import { publishInactiveGeneration } from '../lib/offers/publish-generation';

function latestVerifiedBackup(): { backupId: string; verified: boolean } | null {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    return null;
  }
  const files = fs
    .readdirSync(dataDir)
    .filter((name) => name.startsWith('_pre-sub19-backup-') && name.endsWith('.json'))
    .sort();
  if (files.length === 0) {
    return null;
  }
  const latest = files[files.length - 1];
  const parsed = JSON.parse(fs.readFileSync(path.join(dataDir, latest), 'utf8')) as {
    backupId?: string;
    verified?: boolean;
  };
  return {
    backupId: String(parsed.backupId ?? latest),
    verified: parsed.verified === true,
  };
}

async function main(): Promise<void> {
  const backup = latestVerifiedBackup();
  const cutoverEnv = process.env.VACATIONWEB_CUTOVER?.trim();
  const wantCutover = cutoverEnv !== '0';
  if (wantCutover && (!backup || !backup.verified)) {
    throw new Error(
      'Refusing pointer flip: verified pre-sub19 backup note not found. Run npm run backup:pre-sub19 first.',
    );
  }

  const fromLocal = process.env.VACATIONWEB_PUBLISH_FROM_LOCAL === '1';
  const result = await publishInactiveGeneration({
    fromLocal,
    flipPointer: wantCutover && backup?.verified === true,
  });

  console.log(JSON.stringify({
    ...result,
    backupId: backup?.backupId ?? null,
    backupVerified: backup?.verified ?? false,
    liveKeysUntouched: ['offers.json', 'offers.detail.json'],
  }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Publish generation failed: ${message}`);
  process.exitCode = 1;
});
