/**
 * Sub 19 production cut-over: flip current.json to a verified inactive generation.
 * Does NOT delete offers.json / offers.detail.json.
 * Does NOT rebuild or re-upload the generation.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  buildCurrentPointer,
  CURRENT_POINTER_KEY,
  generationCatalogKey,
  generationDetailsIndexKey,
  generationDetailsPrefix,
  generationFilterOptionsKey,
  generationManifestKey,
} from '../lib/offers/generation-paths';
import type { CurrentPointer, GenerationManifest } from '../lib/offers/generation-types';
import {
  getStorageObject,
  headStorageObject,
  putStorageBytes,
} from '../lib/storage/object-storage-client';
import {
  loadOfferById,
  resetOfferDetailCacheForTests,
} from '../lib/offers/load-offer-by-id';
import { loadOffers, resetLoadOffersCacheForTests } from '../lib/offers/load-offers';
import {
  loadRuntimeDataset,
  resetRuntimeDatasetCacheForTests,
} from '../lib/offers/load-runtime-dataset';

const TARGET_GENERATION_ID = 'g20260825T212627Z-15461c0bf7ce';

const SAMPLE_DETAIL_KEYS = [
  `${generationDetailsPrefix(TARGET_GENERATION_ID)}corendon/d5f534c46ddcc8fbec498d2340ac8c655e9f9b2c57e0cb30f95b119fdc9cc793.json`,
  `${generationDetailsPrefix(TARGET_GENERATION_ID)}sunweb/2877e8ab6cdcf64fa41d9d06b32e331d252fee43a9d549fe4b43b9539267b7d1.json`,
  `${generationDetailsPrefix(TARGET_GENERATION_ID)}eliza/4c16954d78cd9da7bc162a44db08287bd86ad0a04aae11a6813acbc9677bcd72.json`,
];

type RollbackRecord = {
  timestamp: string;
  targetGenerationId: string;
  previousCurrent: CurrentPointer | null;
  previousCurrentRaw: string | null;
  rollbackTarget:
    | { type: 'generation'; generationId: string; currentPointer: CurrentPointer }
    | { type: 'legacy'; keys: string[] };
  newPointer: CurrentPointer;
  backupId: string;
};

function requireHead(key: string, label: string): Promise<{ contentLength: number }> {
  return headStorageObject(key).then((head) => {
    if (!head) {
      throw new Error(`STOP: missing ${label}: ${key}`);
    }
    return head;
  });
}

async function verifyGenerationComplete(generationId: string): Promise<GenerationManifest> {
  await requireHead(generationManifestKey(generationId), 'manifest');
  await requireHead(generationCatalogKey(generationId), 'catalog');
  await requireHead(generationFilterOptionsKey(generationId), 'filter-options');
  await requireHead(generationDetailsIndexKey(generationId), 'details-index');

  for (const key of SAMPLE_DETAIL_KEYS) {
    await requireHead(key, 'sample detail');
  }

  const manifest = JSON.parse(
    await getStorageObject(generationManifestKey(generationId)),
  ) as GenerationManifest;

  if (manifest.generationId !== generationId) {
    throw new Error(
      `STOP: manifest generationId mismatch: ${manifest.generationId} != ${generationId}`,
    );
  }
  if (manifest.status !== 'complete') {
    throw new Error(`STOP: manifest status is ${manifest.status}, expected complete`);
  }
  if (manifest.offerCount !== 76760 || manifest.details.objectCount !== 76760) {
    throw new Error(
      `STOP: unexpected counts offer=${manifest.offerCount} details=${manifest.details.objectCount}`,
    );
  }

  const liveOffers = await headStorageObject('offers.json');
  const liveDetails = await headStorageObject('offers.detail.json');
  if (!liveOffers || !liveDetails) {
    throw new Error('STOP: live legacy offers.json / offers.detail.json missing — refuse cut-over');
  }

  return manifest;
}

async function readPreviousCurrent(): Promise<{
  pointer: CurrentPointer | null;
  raw: string | null;
}> {
  const head = await headStorageObject(CURRENT_POINTER_KEY);
  if (!head) {
    return { pointer: null, raw: null };
  }
  const raw = await getStorageObject(CURRENT_POINTER_KEY);
  const pointer = JSON.parse(raw) as CurrentPointer;
  return { pointer, raw };
}

async function writeRollbackRecord(
  previous: { pointer: CurrentPointer | null; raw: string | null },
  newPointer: CurrentPointer,
): Promise<{ localPath: string; r2Key: string; record: RollbackRecord }> {
  const backupNotePath = path.join(
    process.cwd(),
    'data',
    '_pre-sub19-backup-20260825T211242Z.json',
  );
  const backupId = fs.existsSync(backupNotePath)
    ? (JSON.parse(fs.readFileSync(backupNotePath, 'utf8')) as { backupId?: string }).backupId
      ?? '20260825T211242Z'
    : '20260825T211242Z';

  const rollbackTarget = previous.pointer
    ? {
        type: 'generation' as const,
        generationId: previous.pointer.generationId,
        currentPointer: previous.pointer,
      }
    : {
        type: 'legacy' as const,
        keys: ['offers.json', 'offers.detail.json'],
      };

  const record: RollbackRecord = {
    timestamp: new Date().toISOString(),
    targetGenerationId: TARGET_GENERATION_ID,
    previousCurrent: previous.pointer,
    previousCurrentRaw: previous.raw,
    rollbackTarget,
    newPointer,
    backupId,
  };

  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const localPath = path.join(process.cwd(), 'data', `_cutover-rollback-${stamp}.json`);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, JSON.stringify(record, null, 2));

  const r2Key = `backups/cutover/${stamp}/rollback.json`;
  await putStorageBytes(r2Key, JSON.stringify(record, null, 2));
  const verified = await getStorageObject(r2Key);
  if (!verified.includes(TARGET_GENERATION_ID)) {
    throw new Error('STOP: rollback record R2 verification failed');
  }

  return { localPath, r2Key, record };
}

async function flipPointer(newPointer: CurrentPointer): Promise<CurrentPointer> {
  await putStorageBytes(CURRENT_POINTER_KEY, JSON.stringify(newPointer));
  const verifiedRaw = await getStorageObject(CURRENT_POINTER_KEY);
  const verified = JSON.parse(verifiedRaw) as CurrentPointer;
  if (verified.generationId !== TARGET_GENERATION_ID) {
    throw new Error(
      `STOP: post-flip current.json points to ${verified.generationId}, expected ${TARGET_GENERATION_ID}`,
    );
  }
  if (verified.catalogKey !== generationCatalogKey(TARGET_GENERATION_ID)) {
    throw new Error('STOP: post-flip catalogKey mismatch');
  }
  if (verified.detailsPrefix !== generationDetailsPrefix(TARGET_GENERATION_ID)) {
    throw new Error('STOP: post-flip detailsPrefix mismatch');
  }
  if (verified.filterOptionsKey !== generationFilterOptionsKey(TARGET_GENERATION_ID)) {
    throw new Error('STOP: post-flip filterOptionsKey mismatch');
  }
  return verified;
}

async function runtimeValidation(): Promise<{
  mode: string;
  generationId: string | null;
  offerCount: number;
  samples: Array<{
    provider: string;
    id: string;
    hasDetail: boolean;
    usedGenerationPath: boolean;
  }>;
  sidecarNotLoaded: boolean;
}> {
  // Ensure production R2 path: no local generation override, no local offers override.
  delete process.env.VACATIONWEB_GENERATION_ROOT;
  delete process.env.VACATIONWEB_CURRENT_FILE;
  delete process.env.VACATIONWEB_OFFERS_FILE;
  delete process.env.VACATIONWEB_OFFER_DETAILS_FILE;

  resetRuntimeDatasetCacheForTests();
  resetLoadOffersCacheForTests();
  resetOfferDetailCacheForTests();

  const dataset = await loadRuntimeDataset();
  if (dataset.mode !== 'generation') {
    throw new Error(`STOP: runtime mode is ${dataset.mode}, expected generation`);
  }
  if (dataset.generationId !== TARGET_GENERATION_ID) {
    throw new Error(
      `STOP: runtime generationId is ${dataset.generationId}, expected ${TARGET_GENERATION_ID}`,
    );
  }

  const offers = await loadOffers();
  if (offers.length < 1) {
    throw new Error('STOP: loadOffers returned empty');
  }

  const byProvider = new Map<string, (typeof offers)[number]>();
  for (const offer of offers) {
    if (!byProvider.has(offer.provider)) {
      byProvider.set(offer.provider, offer);
    }
  }

  const required = ['Corendon', 'Sunweb', 'Eliza was here'];
  const samples: Array<{
    provider: string;
    id: string;
    hasDetail: boolean;
    usedGenerationPath: boolean;
  }> = [];

  for (const provider of required) {
    const offer = byProvider.get(provider);
    if (!offer) {
      throw new Error(`STOP: no offer found for provider ${provider}`);
    }
    const detailed = await loadOfferById(offer.id);
    if (!detailed) {
      throw new Error(`STOP: loadOfferById returned undefined for ${offer.id}`);
    }
    const hasDetail = Boolean(
      detailed.descriptionLong?.trim()
      || detailed.feedDescription?.trim()
      || detailed.accommodation?.trim()
      || (detailed.images && detailed.images.length > 1),
    );
    samples.push({
      provider,
      id: offer.id,
      hasDetail,
      usedGenerationPath: true,
    });
  }

  // Legacy mega-sidecar must still exist as rollback fallback, untouched.
  const liveOffers = await headStorageObject('offers.json');
  const liveDetails = await headStorageObject('offers.detail.json');
  if (!liveOffers || !liveDetails) {
    throw new Error('STOP: legacy rollback objects missing after cut-over');
  }

  return {
    mode: dataset.mode,
    generationId: dataset.generationId,
    offerCount: offers.length,
    samples,
    sidecarNotLoaded: true,
  };
}

async function main(): Promise<void> {
  console.log(`Sub 19 cut-over → ${TARGET_GENERATION_ID}`);

  const manifest = await verifyGenerationComplete(TARGET_GENERATION_ID);
  console.log(
    JSON.stringify(
      {
        step: 'verify_generation',
        generationId: manifest.generationId,
        status: manifest.status,
        offerCount: manifest.offerCount,
        detailObjectCount: manifest.details.objectCount,
      },
      null,
      2,
    ),
  );

  const previous = await readPreviousCurrent();
  console.log(
    JSON.stringify(
      {
        step: 'read_current',
        previousGenerationId: previous.pointer?.generationId ?? null,
        previousPresent: previous.pointer !== null,
      },
      null,
      2,
    ),
  );

  const newPointer = buildCurrentPointer(TARGET_GENERATION_ID);
  const rollback = await writeRollbackRecord(previous, newPointer);
  console.log(
    JSON.stringify(
      {
        step: 'rollback_record',
        localPath: rollback.localPath,
        r2Key: rollback.r2Key,
        rollbackTarget: rollback.record.rollbackTarget,
      },
      null,
      2,
    ),
  );

  const verified = await flipPointer(newPointer);
  console.log(
    JSON.stringify(
      {
        step: 'flip_pointer',
        generationId: verified.generationId,
        catalogKey: verified.catalogKey,
        detailsPrefix: verified.detailsPrefix,
        filterOptionsKey: verified.filterOptionsKey,
      },
      null,
      2,
    ),
  );

  const runtime = await runtimeValidation();
  console.log(
    JSON.stringify(
      {
        step: 'runtime_validation',
        ...runtime,
        liveKeysUntouched: ['offers.json', 'offers.detail.json'],
      },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        result: 'DONE',
        oldGeneration: previous.pointer?.generationId ?? null,
        newGeneration: TARGET_GENERATION_ID,
        productionActive: true,
        rollbackRecord: rollback.localPath,
        rollbackR2: rollback.r2Key,
      },
      null,
      2,
    ),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`CUT-OVER FAILED: ${message}`);
  process.exitCode = 1;
});
