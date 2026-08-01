import fs from 'node:fs';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import { putOffersObject } from '../lib/storage/object-storage-client';

function validateOffersFile(filePath: string): number {
  const raw = fs.readFileSync(filePath, 'utf8');
  const offers = JSON.parse(raw) as unknown;

  if (!Array.isArray(offers)) {
    throw new Error('offers.json must contain a JSON array');
  }

  if (offers.length === 0) {
    throw new Error('offers.json must contain at least one offer');
  }

  return offers.length;
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const offerCount = validateOffersFile(FEED_PATHS.offers);
  const result = await putOffersObject(FEED_PATHS.offers);
  const durationMs = Date.now() - startedAt;

  console.log(`✔ ${offerCount} offers uploaded to Object Storage`);
  console.log(`  - bucket: ${result.bucket}`);
  console.log(`  - key: ${result.key}`);
  console.log(`  - size: ${result.byteSize.toLocaleString('nl-NL')} bytes`);
  console.log(`  - duration: ${durationMs.toLocaleString('nl-NL')} ms`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Upload failed: ${message}`);
  process.exitCode = 1;
});
