import assert from 'node:assert/strict';
import { getStorageObject, headStorageObject } from '../lib/storage/object-storage-client';
import { CURRENT_POINTER_KEY } from '../lib/offers/generation-types';
import { generationManifestKey } from '../lib/offers/build-generation-artifacts';

const GENERATION_ID = process.env.VACATIONWEB_TEST_GENERATION_ID?.trim();
if (!GENERATION_ID) {
  throw new Error('Set VACATIONWEB_TEST_GENERATION_ID');
}

const SAMPLE_KEYS = (process.env.VACATIONWEB_TEST_SAMPLE_KEYS ?? '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

async function main(): Promise<void> {
  const currentHead = await headStorageObject(CURRENT_POINTER_KEY);
  const manifestKey = generationManifestKey(GENERATION_ID!);
  assert.ok(await headStorageObject(manifestKey), `manifest missing: ${manifestKey}`);

  const manifest = JSON.parse(await getStorageObject(manifestKey)) as {
    status: string;
    offerCount: number;
    details: { objectCount: number };
  };
  assert.equal(manifest.status, 'complete');
  assert.equal(manifest.offerCount, 76760);
  assert.equal(manifest.details.objectCount, 76760);
  assert.ok(await headStorageObject(`generations/${GENERATION_ID}/catalog.json`));
  assert.ok(await headStorageObject(`generations/${GENERATION_ID}/filter-options.json`));
  assert.ok(await headStorageObject(`generations/${GENERATION_ID}/details-index.json`));

  assert.ok(SAMPLE_KEYS.length >= 3, 'expected at least 3 sample detail keys');
  for (const key of SAMPLE_KEYS) {
    assert.ok(await headStorageObject(key), `detail object missing: ${key}`);
    const parsed = JSON.parse(await getStorageObject(key));
    assert.equal(typeof parsed, 'object');
  }

  console.log(JSON.stringify({
    generationId: GENERATION_ID,
    currentJsonPresentInR2: Boolean(currentHead),
    r2DetailReads: SAMPLE_KEYS.length,
    pointerFlipped: false,
    liveKeysUntouched: ['offers.json', 'offers.detail.json'],
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
