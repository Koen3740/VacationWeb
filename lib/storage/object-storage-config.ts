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

/** Load `.env.local` / `.env` into process.env for CLI scripts (no dotenv dependency). */
function loadLocalEnvFiles(): void {
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
