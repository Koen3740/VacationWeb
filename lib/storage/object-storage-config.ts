export type ObjectStorageConfig = {
  bucket: string;
  offersKey: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getObjectStorageConfig(): ObjectStorageConfig {
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
