import fs from 'node:fs';
import path from 'node:path';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import type { StoredOffer } from '../lib/feeds/types/stored-offer';
import { isCompactStoredOffer } from '../lib/offers/compact-runtime';
import {
  getOffersObject,
  getStorageObject,
  putOffersObject,
  putStorageObject,
} from '../lib/storage/object-storage-client';

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

function assertApprovedCompactUpload(offers: unknown[]): void {
  const first = offers[0];
  if (typeof first !== 'object' || first === null) {
    return;
  }

  if (
    isCompactStoredOffer(first as StoredOffer)
    && process.env.VACATIONWEB_UPLOAD_COMPACT !== '1'
  ) {
    throw new Error(
      'Local offers.json is a compact runtime catalog. Refusing to overwrite production R2 until compact upload is explicitly requested.',
    );
  }
}

function validateOfferDetailsFile(filePath: string): number {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Compact catalog requires local ${path.basename(filePath)} before upload`,
    );
  }

  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('offers.detail.json must be a JSON object keyed by offer id');
  }

  const count = Object.keys(parsed as Record<string, unknown>).length;
  if (count === 0) {
    throw new Error('offers.detail.json must contain at least one record');
  }

  return count;
}

async function verifyRemoteDetailCount(expectedCount: number): Promise<void> {
  const raw = await getStorageObject(FEED_PATHS.offerDetailsObjectKey);
  const remote: unknown = JSON.parse(raw);

  if (typeof remote !== 'object' || remote === null || Array.isArray(remote)) {
    throw new Error('Post-upload verification failed: remote offers.detail.json is not a JSON object');
  }

  const count = Object.keys(remote as Record<string, unknown>).length;
  if (count !== expectedCount) {
    throw new Error(
      `Post-upload verification failed: expected ${expectedCount} detail records, remote has ${count}`,
    );
  }
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
  const parsed = JSON.parse(fs.readFileSync(FEED_PATHS.offers, 'utf8')) as unknown[];
  assertApprovedCompactUpload(parsed);

  const first = parsed[0];
  const isCompact =
    typeof first === 'object'
    && first !== null
    && isCompactStoredOffer(first as StoredOffer);
  const detailCount = isCompact ? validateOfferDetailsFile(FEED_PATHS.offerDetails) : 0;

  const result = await putOffersObject(FEED_PATHS.offers);

  console.log('… verifying remote Object Storage object after upload');
  await verifyRemoteOfferCount(offerCount);

  let detailResult: { bucket: string; key: string; byteSize: number } | undefined;
  if (isCompact) {
    detailResult = await putStorageObject(
      FEED_PATHS.offerDetailsObjectKey,
      FEED_PATHS.offerDetails,
    );
    console.log('… verifying remote offer-detail sidecar after upload');
    await verifyRemoteDetailCount(detailCount);
  }

  const durationMs = Date.now() - startedAt;

  console.log(`✔ ${offerCount} offers uploaded to Object Storage`);
  console.log(`  - bucket: ${result.bucket}`);
  console.log(`  - key: ${result.key}`);
  console.log(`  - size: ${result.byteSize.toLocaleString('nl-NL')} bytes`);
  if (detailResult) {
    console.log(`✔ ${detailCount} detail records uploaded to Object Storage`);
    console.log(`  - bucket: ${detailResult.bucket}`);
    console.log(`  - key: ${detailResult.key}`);
    console.log(`  - size: ${detailResult.byteSize.toLocaleString('nl-NL')} bytes`);
  }
  console.log(`  - duration: ${durationMs.toLocaleString('nl-NL')} ms`);
  console.log('  - remote verification: OK (non-empty, count matches)');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Upload failed: ${message}`);
  process.exitCode = 1;
});
