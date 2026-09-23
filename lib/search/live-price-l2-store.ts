/**
 * Shared L2 live-price store (Cloudflare R2) — AN-076 / approved design.
 *
 * L1 remains process-local (`results-live-price-cache.ts`).
 * This module is storage + short-lived claim only — not a pricing engine.
 */
import { createHash } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  getObjectStorageConfig,
  type ObjectStorageConfig,
} from '../storage/object-storage-config';
import {
  noteLivePriceL2Event,
  type LivePriceL2Event,
} from './live-price-l2-observability';

/** Overlay payload — mirrors ResultsLivePriceOverlay without importing L1 module (avoid cycles). */
export type LivePriceL2OverlayPayload = {
  price: number;
  pricePerDay: number;
  livePriceStatus?: string;
  livePriceSource?: string;
  liveTotalPrice?: number;
  liveTotalPriceField?: string;
  livePriceFailureReason?: string;
  deepLink?: string;
  listingHost?: string;
  feedSourceId?: string;
  affiliateCampaignId?: string;
};

export const LIVE_PRICE_L2_SCHEMA_VERSION = 1 as const;
export const LIVE_PRICE_L2_PREFIX = 'live-price/v1' as const;
/** Short-lived claim TTL (above provider hop ~15s). */
export const LIVE_PRICE_L2_LOCK_TTL_MS = 25_000;
/** Max wait while another isolate holds the claim before falling back to provider. */
export const LIVE_PRICE_L2_LOCK_POLL_MS = 2_500;
export const LIVE_PRICE_L2_LOCK_POLL_INTERVAL_MS = 150;

export type LivePriceL2Record = {
  schemaVersion: typeof LIVE_PRICE_L2_SCHEMA_VERSION;
  cacheKey: string;
  cachedAtMs: number;
  ttlMs: number;
  overlay: LivePriceL2OverlayPayload;
};

export type LivePriceL2LockRecord = {
  ownerId: string;
  expiresAtMs: number;
};

export type LivePriceL2Backend = {
  get(objectKey: string): Promise<string | null>;
  put(objectKey: string, body: string): Promise<void>;
  /** Create-only. Returns 'exists' if object already present. */
  putIfAbsent(objectKey: string, body: string): Promise<'created' | 'exists'>;
  delete(objectKey: string): Promise<void>;
};

type MemoryEntry = { body: string };

function createMemoryBackend(): LivePriceL2Backend {
  const map = new Map<string, MemoryEntry>();
  return {
    async get(objectKey) {
      return map.get(objectKey)?.body ?? null;
    },
    async put(objectKey, body) {
      map.set(objectKey, { body });
    },
    async putIfAbsent(objectKey, body) {
      if (map.has(objectKey)) {
        return 'exists';
      }
      map.set(objectKey, { body });
      return 'created';
    },
    async delete(objectKey) {
      map.delete(objectKey);
    },
  };
}

let memoryBackendSingleton: LivePriceL2Backend | null = null;
let backendOverride: LivePriceL2Backend | null = null;
let enabledOverride: boolean | null = null;
let r2ClientCache: { fingerprint: string; client: S3Client; config: ObjectStorageConfig } | null =
  null;

function getR2Client(): { client: S3Client; config: ObjectStorageConfig } {
  const config = getObjectStorageConfig();
  const fingerprint = `${config.bucket}|${config.region}|${config.endpoint ?? ''}|${config.accessKeyId}`;
  if (!r2ClientCache || r2ClientCache.fingerprint !== fingerprint) {
    r2ClientCache = {
      fingerprint,
      config,
      client: new S3Client({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        endpoint: config.endpoint,
        forcePathStyle: Boolean(config.endpoint),
      }),
    };
  }
  return r2ClientCache;
}

function createR2Backend(): LivePriceL2Backend {
  return {
    async get(objectKey) {
      const { client, config } = getR2Client();
      try {
        const response = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
        );
        if (!response.Body) {
          return null;
        }
        return await response.Body.transformToString();
      } catch (error) {
        const name = error instanceof Error ? error.name : '';
        const httpStatus = (error as { $metadata?: { httpStatusCode?: number } })
          .$metadata?.httpStatusCode;
        if (name === 'NoSuchKey' || name === 'NotFound' || httpStatus === 404) {
          return null;
        }
        throw error;
      }
    },
    async put(objectKey, body) {
      const { client, config } = getR2Client();
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: objectKey,
          Body: body,
          ContentType: 'application/json',
        }),
      );
    },
    async putIfAbsent(objectKey, body) {
      const { client, config } = getR2Client();
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: objectKey,
            Body: body,
            ContentType: 'application/json',
            IfNoneMatch: '*',
          }),
        );
        return 'created';
      } catch (error) {
        const httpStatus = (error as { $metadata?: { httpStatusCode?: number } })
          .$metadata?.httpStatusCode;
        const name = error instanceof Error ? error.name : '';
        if (httpStatus === 412 || name === 'PreconditionFailed') {
          return 'exists';
        }
        throw error;
      }
    },
    async delete(objectKey) {
      const { client, config } = getR2Client();
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey }),
        );
      } catch {
        // best-effort release
      }
    },
  };
}

export function isLivePriceL2Enabled(): boolean {
  if (enabledOverride != null) {
    return enabledOverride;
  }
  const raw = process.env.LIVE_PRICE_L2_ENABLED?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

export function setLivePriceL2EnabledForTests(enabled: boolean | null): void {
  enabledOverride = enabled;
}

export function setLivePriceL2BackendForTests(backend: LivePriceL2Backend | null): void {
  backendOverride = backend;
}

export function getLivePriceL2MemoryBackendForTests(): LivePriceL2Backend {
  if (!memoryBackendSingleton) {
    memoryBackendSingleton = createMemoryBackend();
  }
  return memoryBackendSingleton;
}

export function resetLivePriceL2MemoryBackendForTests(): void {
  memoryBackendSingleton = createMemoryBackend();
  backendOverride = memoryBackendSingleton;
}

function resolveBackend(): LivePriceL2Backend | null {
  if (!isLivePriceL2Enabled()) {
    return null;
  }
  if (backendOverride) {
    return backendOverride;
  }
  if (process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT) {
    if (!memoryBackendSingleton) {
      memoryBackendSingleton = createMemoryBackend();
    }
    return memoryBackendSingleton;
  }
  try {
    return createR2Backend();
  } catch {
    noteLivePriceL2Event('STORE_ERROR');
    return null;
  }
}

export function hashLivePriceCacheKey(cacheKey: string): string {
  return createHash('sha256').update(cacheKey, 'utf8').digest('hex');
}

export function livePriceL2ObjectKey(cacheKey: string): string {
  return `${LIVE_PRICE_L2_PREFIX}/${hashLivePriceCacheKey(cacheKey)}.json`;
}

export function livePriceL2LockObjectKey(cacheKey: string): string {
  return `${LIVE_PRICE_L2_PREFIX}/lock/${hashLivePriceCacheKey(cacheKey)}.json`;
}

function nowMs(): number {
  return Date.now();
}

function parseRecord(raw: string): LivePriceL2Record | null {
  try {
    const parsed = JSON.parse(raw) as LivePriceL2Record;
    if (
      !parsed ||
      parsed.schemaVersion !== LIVE_PRICE_L2_SCHEMA_VERSION ||
      typeof parsed.cacheKey !== 'string' ||
      typeof parsed.cachedAtMs !== 'number' ||
      typeof parsed.ttlMs !== 'number' ||
      !parsed.overlay ||
      typeof parsed.overlay !== 'object'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isFreshRecord(record: LivePriceL2Record, atMs: number = nowMs()): boolean {
  return atMs - record.cachedAtMs <= record.ttlMs;
}

function emit(event: LivePriceL2Event): void {
  noteLivePriceL2Event(event);
}

export async function readLivePriceL2Record(
  cacheKey: string,
): Promise<LivePriceL2Record | null> {
  const backend = resolveBackend();
  if (!backend) {
    return null;
  }
  try {
    const raw = await backend.get(livePriceL2ObjectKey(cacheKey));
    if (raw == null) {
      emit('L2_MISS');
      return null;
    }
    const record = parseRecord(raw);
    if (!record || record.cacheKey !== cacheKey) {
      emit('STORE_ERROR');
      return null;
    }
    if (!isFreshRecord(record)) {
      emit('L2_MISS');
      return null;
    }
    emit('L2_HIT');
    return record;
  } catch {
    emit('STORE_ERROR');
    return null;
  }
}

export async function writeLivePriceL2Record(
  cacheKey: string,
  overlay: LivePriceL2OverlayPayload,
  options: { cachedAtMs?: number; ttlMs: number },
): Promise<boolean> {
  const backend = resolveBackend();
  if (!backend) {
    return false;
  }
  const record: LivePriceL2Record = {
    schemaVersion: LIVE_PRICE_L2_SCHEMA_VERSION,
    cacheKey,
    cachedAtMs: options.cachedAtMs ?? nowMs(),
    ttlMs: options.ttlMs,
    overlay,
  };
  try {
    await backend.put(livePriceL2ObjectKey(cacheKey), JSON.stringify(record));
    emit('L2_WRITE');
    return true;
  } catch {
    emit('STORE_ERROR');
    return false;
  }
}

function parseLock(raw: string): LivePriceL2LockRecord | null {
  try {
    const parsed = JSON.parse(raw) as LivePriceL2LockRecord;
    if (
      !parsed ||
      typeof parsed.ownerId !== 'string' ||
      typeof parsed.expiresAtMs !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Short-lived create-only claim. Stale locks (past expiresAtMs) may be reclaimed.
 */
export async function tryClaimLivePriceL2Lock(
  cacheKey: string,
  ownerId: string = `pid-${process.pid}-${nowMs()}`,
): Promise<'claimed' | 'busy' | 'disabled' | 'error'> {
  const backend = resolveBackend();
  if (!backend) {
    return 'disabled';
  }
  const lockKey = livePriceL2LockObjectKey(cacheKey);
  const body = JSON.stringify({
    ownerId,
    expiresAtMs: nowMs() + LIVE_PRICE_L2_LOCK_TTL_MS,
  } satisfies LivePriceL2LockRecord);

  try {
    const created = await backend.putIfAbsent(lockKey, body);
    if (created === 'created') {
      emit('LOCK_CLAIM');
      return 'claimed';
    }

    const existingRaw = await backend.get(lockKey);
    const existing = existingRaw ? parseLock(existingRaw) : null;
    if (existing && existing.expiresAtMs <= nowMs()) {
      await backend.put(lockKey, body);
      emit('LOCK_CLAIM');
      return 'claimed';
    }
    emit('LOCK_WAIT');
    return 'busy';
  } catch {
    emit('STORE_ERROR');
    return 'error';
  }
}

export async function releaseLivePriceL2Lock(cacheKey: string): Promise<void> {
  const backend = resolveBackend();
  if (!backend) {
    return;
  }
  try {
    await backend.delete(livePriceL2LockObjectKey(cacheKey));
  } catch {
    emit('STORE_ERROR');
  }
}

/**
 * While another isolate may be pricing: poll L2 for a fresh overlay.
 */
export async function waitForLivePriceL2Record(
  cacheKey: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<LivePriceL2Record | null> {
  const timeoutMs = options.timeoutMs ?? LIVE_PRICE_L2_LOCK_POLL_MS;
  const intervalMs = options.intervalMs ?? LIVE_PRICE_L2_LOCK_POLL_INTERVAL_MS;
  const deadline = nowMs() + timeoutMs;
  while (nowMs() < deadline) {
    const record = await readLivePriceL2Record(cacheKey);
    if (record) {
      return record;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/**
 * Run provider work only after L2 claim coordination (best-effort).
 * On busy lock: poll L2 briefly; if still missing, run provider anyway.
 *
 * When skipped due to L2 hit, caller must hydrate L1 from the record via onL2Hit.
 */
export async function withLivePriceL2ProviderGate(
  cacheKey: string,
  work: () => Promise<void>,
  onL2Hit?: (record: LivePriceL2Record) => void,
): Promise<'skipped_l2_hit' | 'ran' | 'ran_without_lock'> {
  if (!isLivePriceL2Enabled()) {
    await work();
    return 'ran_without_lock';
  }

  const existing = await readLivePriceL2Record(cacheKey);
  if (existing) {
    onL2Hit?.(existing);
    return 'skipped_l2_hit';
  }

  const claim = await tryClaimLivePriceL2Lock(cacheKey);
  if (claim === 'busy') {
    const waited = await waitForLivePriceL2Record(cacheKey);
    if (waited) {
      onL2Hit?.(waited);
      return 'skipped_l2_hit';
    }
    await work();
    return 'ran_without_lock';
  }

  if (claim === 'error' || claim === 'disabled') {
    await work();
    return 'ran_without_lock';
  }

  try {
    const again = await readLivePriceL2Record(cacheKey);
    if (again) {
      onL2Hit?.(again);
      return 'skipped_l2_hit';
    }
    await work();
    return 'ran';
  } finally {
    await releaseLivePriceL2Lock(cacheKey);
  }
}
