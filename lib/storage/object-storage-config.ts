import fs from 'node:fs';
import path from 'node:path';

export type ObjectStorageConfig = {
  bucket: string;
  offersKey: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
};

/**
 * C0: `.env.local` / `.env` are read at most once per process. Before, every
 * getObjectStorageConfig() call ran loadLocalEnvFiles() 5x (up to 20 sync fs
 * calls), i.e. per L2 GET via getR2Client(). Precedence is unchanged:
 * non-empty process.env > .env.local > .env. Values are still read from
 * process.env on every call, so runtime env changes are honoured.
 */
let localEnvFilesLoaded = false;

/** Test-only: make the next config read load `.env.local` / `.env` again. */
export function resetObjectStorageEnvFilesForTests(): void {
  localEnvFilesLoaded = false;
}

/** Load `.env.local` / `.env` into process.env for CLI scripts (no dotenv dependency). */
function loadLocalEnvFiles(): void {
  if (localEnvFilesLoaded) {
    return;
  }
  const candidates = ['.env.local', '.env'];

  for (const filename of candidates) {
    const filePath = path.join(process.cwd(), filename);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const eq = trimmed.indexOf('=');
      if (eq <= 0) {
        continue;
      }

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env) || process.env[key] === '') {
        process.env[key] = value;
      }
    }
  }
  // Only after a complete pass: a read error still throws on the next call as before.
  localEnvFilesLoaded = true;
}

function requireEnv(name: string): string {
  loadLocalEnvFiles();
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getObjectStorageConfig(): ObjectStorageConfig {
  loadLocalEnvFiles();
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT?.trim();

  return {
    bucket: requireEnv('OBJECT_STORAGE_BUCKET'),
    offersKey: process.env.OBJECT_STORAGE_OFFERS_KEY?.trim() || 'offers.json',
    region: requireEnv('OBJECT_STORAGE_REGION'),
    accessKeyId: requireEnv('OBJECT_STORAGE_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('OBJECT_STORAGE_SECRET_ACCESS_KEY'),
    endpoint: endpoint || undefined,
  };
}
