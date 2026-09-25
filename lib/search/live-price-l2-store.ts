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

/**
 * D-v2 S1: R2 bounds for the live-price L2 store (review table A).
 * Per-operation deadlines (AbortSignal + timer) are authoritative; the client
 * timeouts below are a safety net. Result semantics are unchanged in S1: a timed
 * out or failed read still returns null (miss path), a failed claim returns 'error'.
 */
export const LIVE_PRICE_L2_CONNECT_TIMEOUT_MS = 1_000;
export const LIVE_PRICE_L2_REQUEST_TIMEOUT_MS = 2_000;
export const LIVE_PRICE_L2_MAX_ATTEMPTS = 1;
/** A: record read (hydrate, gate, poll, background, price-sort, home). */
export const LIVE_PRICE_L2_RECORD_READ_TIMEOUT_MS = 2_000;
/** B1 lock read + C lock write / reclaim, per operation. */
export const LIVE_PRICE_L2_LOCK_OP_TIMEOUT_MS = 1_500;
/** D: lock release (not awaited by the gate; lock TTL stays the safety net). */
export const LIVE_PRICE_L2_LOCK_RELEASE_TIMEOUT_MS = 2_000;
/** E: L2 write-through (callers do not await it). */
export const LIVE_PRICE_L2_WRITE_TIMEOUT_MS = 2_000;
/** Gate: total R2 time per slot before the provider call; exhausted = provider without lock. */
export const LIVE_PRICE_L2_GATE_R2_BUDGET_MS = 3_000;

/**
 * D-v2 S2: explicit read outcome. Only `not_found` means "no usable record in L2"
 * (absent, stale or unparsable). timeout / error / skipped mean "L2 unknown".
 */
export type LivePriceL2ReadStatus = 'found' | 'not_found' | 'timeout' | 'error' | 'skipped';
export type LivePriceL2ReadResult =
  | { status: 'found'; record: LivePriceL2Record }
  | { status: Exclude<LivePriceL2ReadStatus, 'found'>; record: null };

/** S2 single-flight: max concurrently shared record reads; above the cap reads run unshared. */
export const LIVE_PRICE_L2_INFLIGHT_READ_CAP = 2_000;
/** S2 R2 circuit: timeout/error events within the window that open the circuit. */
export const LIVE_PRICE_L2_CIRCUIT_FAILURE_THRESHOLD = 5;
export const LIVE_PRICE_L2_CIRCUIT_WINDOW_MS = 10_000;
/** S2 R2 circuit: open period before one probe read is allowed (half-open). */
export const LIVE_PRICE_L2_CIRCUIT_OPEN_MS = 30_000;

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

/**
 * `signal` is aborted when the per-operation deadline expires. Backends may ignore
 * it (memory/test backends); the store bounds the wait independently.
 */
export type LivePriceL2Backend = {
  get(objectKey: string, signal?: AbortSignal): Promise<string | null>;
  put(objectKey: string, body: string, signal?: AbortSignal): Promise<void>;
  /** Create-only. Returns 'exists' if object already present. */
  putIfAbsent(
    objectKey: string,
    body: string,
    signal?: AbortSignal,
  ): Promise<'created' | 'exists'>;
  delete(objectKey: string, signal?: AbortSignal): Promise<void>;
};

export class LivePriceL2TimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`live-price L2 operation exceeded ${timeoutMs} ms`);
    this.name = 'LivePriceL2TimeoutError';
  }
}

/**
 * Run one backend operation with a hard deadline. On expiry the signal is aborted
 * (R2: request destroyed) and the returned promise rejects; a late result is ignored.
 */
function runWithDeadline<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  if (!(timeoutMs > 0)) {
    const error = new LivePriceL2TimeoutError(0);
    controller.abort(error);
    return Promise.reject(error);
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new LivePriceL2TimeoutError(timeoutMs);
      controller.abort(error);
      reject(error);
    }, timeoutMs);
    let pending: Promise<T>;
    try {
      pending = operation(controller.signal);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
      return;
    }
    pending.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/** Deadline for one op: its own bound, capped by an optional absolute budget deadline. */
function boundedTimeoutMs(ownBoundMs: number, deadlineAtMs?: number): number {
  if (deadlineAtMs == null) {
    return ownBoundMs;
  }
  return Math.min(ownBoundMs, deadlineAtMs - nowMs());
}

/** S2: R2 op not started because the R2 circuit is open (or half-open with a probe in flight). */
export class LivePriceL2SkippedError extends Error {
  constructor() {
    super('live-price L2 circuit open: R2 operation skipped');
    this.name = 'LivePriceL2SkippedError';
  }
}

/**
 * S2 R2 circuit breaker (process-local, same shape as `lib/providers/live-price-circuit.ts`
 * but with a sliding window): opens after LIVE_PRICE_L2_CIRCUIT_FAILURE_THRESHOLD
 * timeout/error outcomes within LIVE_PRICE_L2_CIRCUIT_WINDOW_MS. While open every R2 op is
 * skipped. After LIVE_PRICE_L2_CIRCUIT_OPEN_MS exactly one record read runs as probe
 * (half-open): success (found/not_found) closes, timeout/error reopens.
 * 404 / 412 are successes (the backend maps them to null / 'exists').
 */
type LivePriceL2CircuitPhase = 'closed' | 'open' | 'half_open';
type LivePriceL2CircuitPermit = 'run' | 'probe' | 'skip';

let circuitPhase: LivePriceL2CircuitPhase = 'closed';
let circuitFailureTimesMs: number[] = [];
let circuitOpenedAtMs = 0;

function openCircuit(atMs: number): void {
  circuitPhase = 'open';
  circuitOpenedAtMs = atMs;
  circuitFailureTimesMs = [];
  emit('L2_CIRCUIT_OPEN');
}

function acquireCircuitPermit(kind: 'record_read' | 'other'): LivePriceL2CircuitPermit {
  if (circuitPhase === 'closed') {
    return 'run';
  }
  if (
    circuitPhase === 'open' &&
    kind === 'record_read' &&
    nowMs() - circuitOpenedAtMs >= LIVE_PRICE_L2_CIRCUIT_OPEN_MS
  ) {
    circuitPhase = 'half_open';
    return 'probe';
  }
  return 'skip';
}

function recordCircuitOutcome(permit: 'run' | 'probe', outcome: 'ok' | 'failure' | 'ignore'): void {
  const atMs = nowMs();
  if (permit === 'probe') {
    // Probe: only a real answer closes; any timeout (even a shortened one) or error reopens.
    if (outcome === 'ok') {
      circuitPhase = 'closed';
      circuitFailureTimesMs = [];
    } else {
      openCircuit(atMs);
    }
    return;
  }
  if (outcome !== 'failure' || circuitPhase !== 'closed') {
    return;
  }
  circuitFailureTimesMs = circuitFailureTimesMs.filter(
    (t) => atMs - t < LIVE_PRICE_L2_CIRCUIT_WINDOW_MS,
  );
  circuitFailureTimesMs.push(atMs);
  if (circuitFailureTimesMs.length >= LIVE_PRICE_L2_CIRCUIT_FAILURE_THRESHOLD) {
    openCircuit(atMs);
  }
}

/**
 * One R2 backend op under circuit + deadline. A timeout only counts as a circuit failure
 * when the op had its full bound (`timeoutMs >= fullBoundMs`); a deadline shortened by a
 * caller budget says nothing about R2 health. A non-positive deadline never reaches R2.
 */
async function runR2Op<T>(
  kind: 'record_read' | 'other',
  timeoutMs: number,
  fullBoundMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  if (!(timeoutMs > 0)) {
    throw new LivePriceL2TimeoutError(0);
  }
  const permit = acquireCircuitPermit(kind);
  if (permit === 'skip') {
    throw new LivePriceL2SkippedError();
  }
  try {
    const value = await runWithDeadline(timeoutMs, operation);
    recordCircuitOutcome(permit, 'ok');
    return value;
  } catch (error) {
    const countable = !(error instanceof LivePriceL2TimeoutError) || timeoutMs >= fullBoundMs;
    recordCircuitOutcome(permit, countable ? 'failure' : 'ignore');
    throw error;
  }
}

/** S2 single-flight map: cacheKey -> the one in-flight record read (never a cached result). */
type InflightRead = { promise: Promise<LivePriceL2ReadResult>; deadlineAtMs: number };
const inflightReads = new Map<string, InflightRead>();

/**
 * D-v2 A-43 fix (S2: one shared read per key, "geen dubbele GET"): when a Page-1 slot
 * joined the in-flight read (S6) and it ended WITHOUT a record (timeout / error /
 * not_found / skipped), that outcome is handed once to the provider gate for the same
 * key, so the gate does not start a second GET for the read that was just shared.
 * One-shot, valid for one read bound (2000 ms), capped like the in-flight map; a hit
 * is never kept here (it is seeded into L1 by the joiner).
 */
type JoinedReadOutcome = { result: LivePriceL2ReadResult; expiresAtMs: number };
const joinedReadOutcomes = new Map<string, JoinedReadOutcome>();

function rememberJoinedReadOutcome(cacheKey: string, result: LivePriceL2ReadResult): void {
  if (result.status === 'found') {
    return;
  }
  const atMs = nowMs();
  if (joinedReadOutcomes.size >= LIVE_PRICE_L2_INFLIGHT_READ_CAP) {
    for (const [key, entry] of joinedReadOutcomes) {
      if (entry.expiresAtMs <= atMs) joinedReadOutcomes.delete(key);
    }
    if (joinedReadOutcomes.size >= LIVE_PRICE_L2_INFLIGHT_READ_CAP) {
      return;
    }
  }
  joinedReadOutcomes.set(cacheKey, {
    result,
    expiresAtMs: atMs + LIVE_PRICE_L2_RECORD_READ_TIMEOUT_MS,
  });
}

function takeJoinedReadOutcome(cacheKey: string): LivePriceL2ReadResult | null {
  const entry = joinedReadOutcomes.get(cacheKey);
  if (!entry) {
    return null;
  }
  joinedReadOutcomes.delete(cacheKey);
  return entry.expiresAtMs > nowMs() ? entry.result : null;
}

function resetLivePriceL2RuntimeState(): void {
  circuitPhase = 'closed';
  circuitFailureTimesMs = [];
  circuitOpenedAtMs = 0;
  inflightReads.clear();
  joinedReadOutcomes.clear();
}

export function resetLivePriceL2CircuitForTests(): void {
  resetLivePriceL2RuntimeState();
}

export function getLivePriceL2CircuitSnapshotForTests(): {
  phase: LivePriceL2CircuitPhase;
  failuresInWindow: number;
  openedAtMs: number;
} {
  return {
    phase: circuitPhase,
    failuresInWindow: circuitFailureTimesMs.length,
    openedAtMs: circuitOpenedAtMs,
  };
}

export function getLivePriceL2InflightReadCountForTests(): number {
  return inflightReads.size;
}

export function getLivePriceL2JoinedOutcomeCountForTests(): number {
  return joinedReadOutcomes.size;
}

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

/** Client options for the live-price L2 client only (catalogue client is separate). */
export const LIVE_PRICE_L2_R2_CLIENT_OPTIONS = {
  requestHandler: {
    connectionTimeout: LIVE_PRICE_L2_CONNECT_TIMEOUT_MS,
    requestTimeout: LIVE_PRICE_L2_REQUEST_TIMEOUT_MS,
    throwOnRequestTimeout: true,
  },
  maxAttempts: LIVE_PRICE_L2_MAX_ATTEMPTS,
} as const;

export function buildLivePriceL2S3Client(config: ObjectStorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
    requestHandler: { ...LIVE_PRICE_L2_R2_CLIENT_OPTIONS.requestHandler },
    maxAttempts: LIVE_PRICE_L2_R2_CLIENT_OPTIONS.maxAttempts,
  });
}

function getR2Client(): { client: S3Client; config: ObjectStorageConfig } {
  const config = getObjectStorageConfig();
  const fingerprint = `${config.bucket}|${config.region}|${config.endpoint ?? ''}|${config.accessKeyId}`;
  if (!r2ClientCache || r2ClientCache.fingerprint !== fingerprint) {
    r2ClientCache = {
      fingerprint,
      config,
      client: buildLivePriceL2S3Client(config),
    };
  }
  return r2ClientCache;
}

function createR2Backend(): LivePriceL2Backend {
  return {
    async get(objectKey, signal) {
      const { client, config } = getR2Client();
      try {
        const response = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
          { abortSignal: signal },
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
    async put(objectKey, body, signal) {
      const { client, config } = getR2Client();
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: objectKey,
          Body: body,
          ContentType: 'application/json',
        }),
        { abortSignal: signal },
      );
    },
    async putIfAbsent(objectKey, body, signal) {
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
          { abortSignal: signal },
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
    async delete(objectKey, signal) {
      const { client, config } = getR2Client();
      try {
        await client.send(
          new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey }),
          { abortSignal: signal },
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
  resetLivePriceL2RuntimeState();
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
  resetLivePriceL2RuntimeState();
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

const READ_TIMEOUT_RESULT: LivePriceL2ReadResult = { status: 'timeout', record: null };

async function performRecordRead(
  backend: LivePriceL2Backend,
  cacheKey: string,
  timeoutMs: number,
): Promise<LivePriceL2ReadResult> {
  const objectKey = livePriceL2ObjectKey(cacheKey);
  let raw: string | null;
  try {
    raw = await runR2Op(
      'record_read',
      timeoutMs,
      LIVE_PRICE_L2_RECORD_READ_TIMEOUT_MS,
      (signal) => backend.get(objectKey, signal),
    );
  } catch (error) {
    if (error instanceof LivePriceL2SkippedError) {
      emit('L2_SKIPPED');
      return { status: 'skipped', record: null };
    }
    emit('STORE_ERROR');
    if (error instanceof LivePriceL2TimeoutError) {
      emit('L2_TIMEOUT');
      return READ_TIMEOUT_RESULT;
    }
    return { status: 'error', record: null };
  }
  if (raw == null) {
    emit('L2_MISS');
    return { status: 'not_found', record: null };
  }
  const record = parseRecord(raw);
  if (!record || record.cacheKey !== cacheKey) {
    emit('STORE_ERROR');
    return { status: 'not_found', record: null };
  }
  if (!isFreshRecord(record)) {
    emit('L2_MISS');
    return { status: 'not_found', record: null };
  }
  emit('L2_HIT');
  return { status: 'found', record };
}

/** Bound a joined read by the joiner's own (shorter) deadline without aborting the shared read. */
function boundJoinedRead(
  shared: InflightRead,
  timeoutMs: number,
): Promise<LivePriceL2ReadResult> {
  if (nowMs() + timeoutMs >= shared.deadlineAtMs) {
    return shared.promise;
  }
  return new Promise<LivePriceL2ReadResult>((resolve) => {
    const timer = setTimeout(() => {
      emit('STORE_ERROR');
      emit('L2_TIMEOUT');
      resolve(READ_TIMEOUT_RESULT);
    }, timeoutMs);
    void shared.promise.then((result) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
}

/**
 * A + S2: bounded, single-flight record read with an explicit outcome.
 * `timeoutMs` may only shorten the default 2000 ms bound. Concurrent callers for the
 * same cacheKey join the one in-flight read (deadline of the caller that started it;
 * a joiner with a shorter deadline gets a local 'timeout'). The map entry is removed
 * when the read settles; results are not cached here (L1 does that).
 */
export function readLivePriceL2RecordResult(
  cacheKey: string,
  options: { timeoutMs?: number } = {},
): Promise<LivePriceL2ReadResult> {
  const backend = resolveBackend();
  if (!backend) {
    return Promise.resolve({ status: 'skipped', record: null });
  }
  const timeoutMs = Math.min(
    LIVE_PRICE_L2_RECORD_READ_TIMEOUT_MS,
    options.timeoutMs ?? LIVE_PRICE_L2_RECORD_READ_TIMEOUT_MS,
  );
  if (!(timeoutMs > 0)) {
    emit('STORE_ERROR');
    emit('L2_TIMEOUT');
    return Promise.resolve(READ_TIMEOUT_RESULT);
  }
  const existing = inflightReads.get(cacheKey);
  if (existing) {
    emit('L2_READ_JOIN');
    return boundJoinedRead(existing, timeoutMs);
  }
  const promise = performRecordRead(backend, cacheKey, timeoutMs);
  if (inflightReads.size < LIVE_PRICE_L2_INFLIGHT_READ_CAP) {
    const entry: InflightRead = { promise, deadlineAtMs: nowMs() + timeoutMs };
    inflightReads.set(cacheKey, entry);
    void promise.then(() => {
      if (inflightReads.get(cacheKey) === entry) {
        inflightReads.delete(cacheKey);
      }
    });
  }
  return promise;
}

/**
 * D-v2 S6: join the in-flight record read for `cacheKey` WITHOUT starting a new one.
 * Returns the shared S2 single-flight promise (bounded by the 2000 ms read deadline of
 * the caller that started it), or null when no read is in flight.
 */
export function joinInflightLivePriceL2Read(
  cacheKey: string,
): Promise<LivePriceL2ReadResult> | null {
  const existing = inflightReads.get(cacheKey);
  if (!existing) {
    return null;
  }
  emit('L2_READ_JOIN');
  // D-v2 A-43: a non-hit outcome of this shared read is handed once to the gate.
  return existing.promise.then((result) => {
    rememberJoinedReadOutcome(cacheKey, result);
    return result;
  });
}

/**
 * Null adapter for existing callers (hydrate and everything routed through it):
 * record when found, otherwise null. Callers that must distinguish timeout/error/skipped
 * from not_found use `readLivePriceL2RecordResult`.
 */
export async function readLivePriceL2Record(
  cacheKey: string,
  options: { timeoutMs?: number } = {},
): Promise<LivePriceL2Record | null> {
  return (await readLivePriceL2RecordResult(cacheKey, options)).record;
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
  const objectKey = livePriceL2ObjectKey(cacheKey);
  const body = JSON.stringify(record);
  try {
    await runR2Op(
      'other',
      LIVE_PRICE_L2_WRITE_TIMEOUT_MS,
      LIVE_PRICE_L2_WRITE_TIMEOUT_MS,
      (signal) => backend.put(objectKey, body, signal),
    );
    emit('L2_WRITE');
    return true;
  } catch (error) {
    emit(error instanceof LivePriceL2SkippedError ? 'L2_SKIPPED' : 'STORE_ERROR');
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
 * S1: each R2 op (create, lock read, reclaim) is bounded to 1500 ms and, when
 * `deadlineAtMs` is given, to the remaining gate budget. Timeout = 'error'.
 * S2: circuit open = 'skipped' (no R2 op).
 */
export async function tryClaimLivePriceL2Lock(
  cacheKey: string,
  ownerId: string = `pid-${process.pid}-${nowMs()}`,
  options: { deadlineAtMs?: number } = {},
): Promise<'claimed' | 'busy' | 'disabled' | 'error' | 'skipped'> {
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
    const opMs = () => boundedTimeoutMs(LIVE_PRICE_L2_LOCK_OP_TIMEOUT_MS, options.deadlineAtMs);
    const lockOp = <T>(operation: (signal: AbortSignal) => Promise<T>) =>
      runR2Op('other', opMs(), LIVE_PRICE_L2_LOCK_OP_TIMEOUT_MS, operation);
    const created = await lockOp((signal) => backend.putIfAbsent(lockKey, body, signal));
    if (created === 'created') {
      emit('LOCK_CLAIM');
      return 'claimed';
    }

    const existingRaw = await lockOp((signal) => backend.get(lockKey, signal));
    const existing = existingRaw ? parseLock(existingRaw) : null;
    if (existing && existing.expiresAtMs <= nowMs()) {
      await lockOp((signal) => backend.put(lockKey, body, signal));
      emit('LOCK_CLAIM');
      return 'claimed';
    }
    emit('LOCK_WAIT');
    return 'busy';
  } catch (error) {
    if (error instanceof LivePriceL2SkippedError) {
      emit('L2_SKIPPED');
      return 'skipped';
    }
    emit('STORE_ERROR');
    return 'error';
  }
}

/** D: bounded release (2000 ms). Never rejects. The gate does not await it. */
export async function releaseLivePriceL2Lock(cacheKey: string): Promise<void> {
  const backend = resolveBackend();
  if (!backend) {
    return;
  }
  const lockKey = livePriceL2LockObjectKey(cacheKey);
  try {
    await runR2Op(
      'other',
      LIVE_PRICE_L2_LOCK_RELEASE_TIMEOUT_MS,
      LIVE_PRICE_L2_LOCK_RELEASE_TIMEOUT_MS,
      (signal) => backend.delete(lockKey, signal),
    );
  } catch (error) {
    emit(error instanceof LivePriceL2SkippedError ? 'L2_SKIPPED' : 'STORE_ERROR');
  }
}

/**
 * While another isolate may be pricing: poll L2 for a fresh overlay.
 * B2: total wait (including an in-flight read) is bounded by `timeoutMs`
 * (default 2500 ms); each read gets min(2000, remaining).
 * S2: keeps polling after not_found/timeout/error; stops at once on 'skipped' (circuit open).
 */
export async function waitForLivePriceL2Record(
  cacheKey: string,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<LivePriceL2Record | null> {
  const timeoutMs = options.timeoutMs ?? LIVE_PRICE_L2_LOCK_POLL_MS;
  const intervalMs = options.intervalMs ?? LIVE_PRICE_L2_LOCK_POLL_INTERVAL_MS;
  const deadline = nowMs() + timeoutMs;
  for (;;) {
    const remainingMs = deadline - nowMs();
    if (remainingMs <= 0) {
      return null;
    }
    const result = await readLivePriceL2RecordResult(cacheKey, { timeoutMs: remainingMs });
    if (result.status === 'found') {
      return result.record;
    }
    if (result.status === 'skipped') {
      return null;
    }
    const sleepMs = Math.min(intervalMs, deadline - nowMs());
    if (sleepMs <= 0) {
      return null;
    }
    await new Promise((r) => setTimeout(r, sleepMs));
  }
}

/**
 * Run provider work only after L2 claim coordination (best-effort).
 * On busy lock: poll L2 briefly; if still missing, run provider anyway.
 *
 * When skipped due to L2 hit, caller must hydrate L1 from the record via onL2Hit.
 *
 * S1: all R2 work before `work()` shares a 3000 ms budget per call. Once it is
 * exhausted the provider runs without (further) lock coordination. `work()` still
 * runs at most once per call (DEC-011 unchanged). Release is not awaited.
 *
 * S2: first read found -> onL2Hit, no provider. not_found -> bounded lock path, then
 * exactly one provider call. timeout / error / skipped -> NO lock attempt, exactly one
 * provider call ('ran_without_lock').
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

  const budgetDeadlineAtMs = nowMs() + LIVE_PRICE_L2_GATE_R2_BUDGET_MS;
  const remainingBudgetMs = () => budgetDeadlineAtMs - nowMs();

  // D-v2 A-43: after a Page-1 slot joined the shared read for this key (S6), reuse its
  // outcome instead of a second GET (S2 single read per key); otherwise read as before.
  const first =
    takeJoinedReadOutcome(cacheKey) ??
    (await readLivePriceL2RecordResult(cacheKey, { timeoutMs: remainingBudgetMs() }));
  if (first.status === 'found') {
    onL2Hit?.(first.record);
    return 'skipped_l2_hit';
  }

  if (first.status !== 'not_found' || remainingBudgetMs() <= 0) {
    await work();
    return 'ran_without_lock';
  }

  const claim = await tryClaimLivePriceL2Lock(cacheKey, undefined, {
    deadlineAtMs: budgetDeadlineAtMs,
  });
  if (claim === 'busy') {
    const waitMs = Math.min(LIVE_PRICE_L2_LOCK_POLL_MS, remainingBudgetMs());
    const waited =
      waitMs > 0 ? await waitForLivePriceL2Record(cacheKey, { timeoutMs: waitMs }) : null;
    if (waited) {
      onL2Hit?.(waited);
      return 'skipped_l2_hit';
    }
    await work();
    return 'ran_without_lock';
  }

  if (claim === 'error' || claim === 'disabled' || claim === 'skipped') {
    await work();
    return 'ran_without_lock';
  }

  try {
    const againMs = remainingBudgetMs();
    const again =
      againMs > 0 ? await readLivePriceL2RecordResult(cacheKey, { timeoutMs: againMs }) : null;
    if (again?.status === 'found') {
      onL2Hit?.(again.record);
      return 'skipped_l2_hit';
    }
    await work();
    return 'ran';
  } finally {
    void releaseLivePriceL2Lock(cacheKey);
  }
}
