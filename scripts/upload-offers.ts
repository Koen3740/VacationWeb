import fs from 'node:fs';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import { getOffersObject, putOffersObject } from '../lib/storage/object-storage-client';

function validateOffersFile(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Local offers file not found: ${filePath}`);
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const offers = JSON.parse(raw) as unknown;

  if (!Array.isArray(offers)) {
    throw new Error('offers.json must contain a JSON array');
  }

  if (offers.length === 0) {
    throw new Error('offers.json must contain at least one offer — refusing upload of empty dataset');
  }

  for (const [index, offer] of offers.entries()) {
    if (typeof offer !== 'object' || offer === null) {
      throw new Error(`offers.json contains invalid offer at index ${index}`);
    }

    const record = offer as Record<string, unknown>;

    if (typeof record.externalId !== 'string' || record.externalId.trim() === '') {
      throw new Error(`offers.json missing externalId at index ${index}`);
    }

    if (typeof record.provider !== 'string' || record.provider.trim() === '') {
      throw new Error(`offers.json missing provider at index ${index}`);
    }
  }

  return offers.length;
}

async function verifyRemoteOfferCount(expectedCount: number): Promise<void> {
  const raw = await getOffersObject();
  const remote = JSON.parse(raw) as unknown;

  if (!Array.isArray(remote)) {
    throw new Error('Post-upload verification failed: remote offers object is not a JSON array');
  }

  if (remote.length === 0) {
    throw new Error('Post-upload verification failed: remote offers object is empty');
  }

  if (remote.length !== expectedCount) {
    throw new Error(
      `Post-upload verification failed: expected ${expectedCount} offers, remote has ${remote.length}`,
    );
  }
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const offerCount = validateOffersFile(FEED_PATHS.offers);
  const result = await putOffersObject(FEED_PATHS.offers);

  console.log('… verifying remote Object Storage object after upload');
  await verifyRemoteOfferCount(offerCount);

  const durationMs = Date.now() - startedAt;

  console.log(`✔ ${offerCount} offers uploaded to Object Storage`);
  console.log(`  - bucket: ${result.bucket}`);
  console.log(`  - key: ${result.key}`);
  console.log(`  - size: ${result.byteSize.toLocaleString('nl-NL')} bytes`);
  console.log(`  - duration: ${durationMs.toLocaleString('nl-NL')} ms`);
  console.log('  - remote verification: OK (non-empty, count matches)');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Upload failed: ${message}`);
  process.exitCode = 1;
});
