import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FEED_PATHS } from '../feeds/feed-paths';
import type { OfferDetailRecord } from './compact-runtime';
import type { StoredOffer } from '../feeds/types/stored-offer';
import {
  buildCompleteManifest,
  buildGenerationArtifacts,
  type GenerationArtifacts,
} from './build-generation-artifacts';
import {
  CURRENT_POINTER_KEY,
  type CurrentPointer,
} from './generation-types';
import {
  generationCatalogKey,
  generationDetailsIndexKey,
  generationFilterOptionsKey,
  generationManifestKey,
  buildCurrentPointer,
} from './generation-paths';
import {
  assertGenerationArtifactsValid,
  assertManifestComplete,
} from './validate-generation';
import {
  downloadStorageObject,
  getStorageObject,
  headStorageObject,
  putStorageBytes,
} from '../storage/object-storage-client';
import {
  mapWithBoundedConcurrency,
  resolveDetailUploadConcurrency,
} from '../storage/bounded-concurrency';

export type PublishGenerationResult = {
  generationId: string;
  offerCount: number;
  detailObjectCount: number;
  concurrency: number;
  elapsedMs: number;
  successfulUploads: number;
  failedUploads: number;
  retries: number;
  catalogBytes: number;
  totalDetailBytes: number;
  pointerFlipped: boolean;
  sampleKeys: string[];
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRuntimeCatalog(raw: string): StoredOffer[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Catalog is not a non-empty JSON array');
  }
  return parsed as StoredOffer[];
}

function parseSidecar(raw: string): Record<string, OfferDetailRecord> {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Detail sidecar is not a JSON object');
  }
  return parsed as Record<string, OfferDetailRecord>;
}

async function putWithRetry(
  key: string,
  body: string,
  attempts: number,
): Promise<{ retries: number }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await putStorageBytes(key, body);
      return { retries: attempt };
    } catch (error) {
      lastError = error;
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Upload failed for ${key}: ${String(lastError)}`);
}

export async function loadSourceCatalogAndDetails(options: {
  fromLocal?: boolean;
}): Promise<{
  runtime: StoredOffer[];
  sidecar: Record<string, OfferDetailRecord>;
}> {
  if (options.fromLocal) {
    const runtime = parseRuntimeCatalog(fs.readFileSync(FEED_PATHS.offers, 'utf8'));
    const sidecar = parseSidecar(fs.readFileSync(FEED_PATHS.offerDetails, 'utf8'));
    return { runtime, sidecar };
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vw-gen-src-'));
  try {
    const catalogPath = path.join(workDir, 'offers.json');
    const detailsPath = path.join(workDir, 'offers.detail.json');
    await downloadStorageObject(FEED_PATHS.offersObjectKey, catalogPath);
    await downloadStorageObject(FEED_PATHS.offerDetailsObjectKey, detailsPath);
    const runtime = parseRuntimeCatalog(fs.readFileSync(catalogPath, 'utf8'));
    const sidecar = parseSidecar(fs.readFileSync(detailsPath, 'utf8'));
    return { runtime, sidecar };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

function previousProviderCounts(runtime: StoredOffer[]): Record<string, number> {
  const providers: Record<string, number> = {};
  for (const offer of runtime) {
    providers[offer.provider] = (providers[offer.provider] ?? 0) + 1;
  }
  return providers;
}

async function sampleDetailKeys(artifacts: GenerationArtifacts): Promise<string[]> {
  const byProvider = new Map<string, string>();
  for (const detail of artifacts.details) {
    if (!byProvider.has(detail.providerSlug)) {
      byProvider.set(detail.providerSlug, detail.key);
    }
  }
  const preferred = ['corendon', 'sunweb', 'eliza', 'prijsvrij'];
  const keys: string[] = [];
  for (const slug of preferred) {
    const key = byProvider.get(slug);
    if (key) {
      keys.push(key);
    }
  }
  for (const key of byProvider.values()) {
    if (keys.length >= 3) {
      break;
    }
    if (!keys.includes(key)) {
      keys.push(key);
    }
  }
  return keys.slice(0, 3);
}

export async function publishInactiveGeneration(options: {
  fromLocal?: boolean;
  concurrency?: number;
  flipPointer?: boolean;
}): Promise<PublishGenerationResult> {
  const started = Date.now();
  const concurrency =
    options.concurrency ??
    resolveDetailUploadConcurrency(process.env.VACATIONWEB_DETAIL_UPLOAD_CONCURRENCY);
  const source = await loadSourceCatalogAndDetails({ fromLocal: options.fromLocal === true });
  const artifacts = buildGenerationArtifacts(source.runtime, source.sidecar);
  assertGenerationArtifactsValid(artifacts, {
    providers: previousProviderCounts(source.runtime),
  });

  let successfulUploads = 0;
  let failedUploads = 0;
  let retries = 0;
  let totalDetailBytes = 0;

  await mapWithBoundedConcurrency(artifacts.details, concurrency, async (detail) => {
    try {
      const result = await putWithRetry(detail.key, detail.body, 3);
      retries += result.retries;
      successfulUploads += 1;
      totalDetailBytes += Buffer.byteLength(detail.body);
    } catch (error) {
      failedUploads += 1;
      throw error;
    }
  });

  if (failedUploads > 0) {
    throw new Error(`Detail upload failed for ${failedUploads} object(s); pointer not flipped`);
  }

  await putStorageBytes(generationDetailsIndexKey(artifacts.generationId), artifacts.detailsIndexJson);
  await putStorageBytes(generationCatalogKey(artifacts.generationId), artifacts.catalogJson);
  await putStorageBytes(generationFilterOptionsKey(artifacts.generationId), artifacts.filterOptionsJson);
  for (const shard of artifacts.catalogShards) {
    await putStorageBytes(shard.key, shard.json);
  }

  const missing: string[] = [];
  await mapWithBoundedConcurrency(artifacts.details, concurrency, async (detail) => {
    const head = await headStorageObject(detail.key);
    if (!head) {
      missing.push(detail.key);
    }
  });
  if (missing.length > 0) {
    throw new Error(
      `HEAD validation failed: ${missing.length} detail object(s) missing, e.g. ${missing[0]}`,
    );
  }

  const sampleKeys = await sampleDetailKeys(artifacts);
  for (const key of sampleKeys) {
    const raw = await getStorageObject(key);
    JSON.parse(raw);
  }

  const manifest = buildCompleteManifest(artifacts);
  assertManifestComplete(manifest, artifacts);
  await putStorageBytes(generationManifestKey(artifacts.generationId), JSON.stringify(manifest));

  let pointerFlipped = false;
  if (options.flipPointer) {
    const pointer: CurrentPointer = buildCurrentPointer(
      artifacts.generationId,
      new Date().toISOString(),
      artifacts.catalogShardPointers,
    );
    await putStorageBytes(CURRENT_POINTER_KEY, JSON.stringify(pointer));
    const verified = JSON.parse(await getStorageObject(CURRENT_POINTER_KEY)) as CurrentPointer;
    if (verified.generationId !== artifacts.generationId) {
      throw new Error('current.json verification failed after pointer write');
    }
    pointerFlipped = true;
  }

  return {
    generationId: artifacts.generationId,
    offerCount: artifacts.catalog.length,
    detailObjectCount: artifacts.details.length,
    concurrency,
    elapsedMs: Date.now() - started,
    successfulUploads,
    failedUploads,
    retries,
    catalogBytes: artifacts.catalogBytes,
    totalDetailBytes,
    pointerFlipped,
    sampleKeys,
  };
}
