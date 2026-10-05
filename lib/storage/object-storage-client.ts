import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  getObjectStorageConfig,
  type ObjectStorageConfig,
} from './object-storage-config';

let cachedClient: { fingerprint: string; client: S3Client } | null = null;

/**
 * D-v2 S8 (owner GO 25-09 17:10; review timeout table row F): catalogue client bounds.
 * Separate from the live-price L2 client (`LIVE_PRICE_L2_R2_CLIENT_OPTIONS`, unchanged).
 * connect 3000 ms, 15000 ms per attempt (throw on request timeout), 1 retry
 * (maxAttempts 2) -> max ~30 s (+ SDK backoff) for a cold-process catalogue read.
 * On timeout the SDK error propagates to the existing catalogue failure path
 * (`load-runtime-dataset.ts`, unchanged).
 */
export const CATALOG_STORAGE_CONNECT_TIMEOUT_MS = 3_000;
export const CATALOG_STORAGE_REQUEST_TIMEOUT_MS = 15_000;
export const CATALOG_STORAGE_MAX_ATTEMPTS = 2;

export const CATALOG_STORAGE_CLIENT_OPTIONS = {
  requestHandler: {
    connectionTimeout: CATALOG_STORAGE_CONNECT_TIMEOUT_MS,
    requestTimeout: CATALOG_STORAGE_REQUEST_TIMEOUT_MS,
    throwOnRequestTimeout: true,
  },
  maxAttempts: CATALOG_STORAGE_MAX_ATTEMPTS,
} as const;

export function buildCatalogStorageS3Client(config: ObjectStorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
    requestHandler: { ...CATALOG_STORAGE_CLIENT_OPTIONS.requestHandler },
    maxAttempts: CATALOG_STORAGE_CLIENT_OPTIONS.maxAttempts,
  });
}

function createS3Client(config: ObjectStorageConfig): S3Client {
  return buildCatalogStorageS3Client(config);
}

/**
 * Backup / bulk-transfer client (ops scripts only: `backup:pre-sub19`).
 * Root cause of the 2026-10-01 backup failures: the runtime catalogue client above bounds every
 * request to 15 s (D-v2 S8). Uploading the 103 MB `offers.detail.json` needs more than 15 s on a
 * normal uplink, so the SDK threw "request has exceeded the configured 15000 ms requestTimeout".
 * Live request paths keep the S8 bounds; only callers that pass `{ longTransfer: true }` use this.
 * Timeout is configurable via VACATIONWEB_BULK_REQUEST_TIMEOUT_MS (default 600 s, minimum 15 s).
 */
export const BULK_STORAGE_CONNECT_TIMEOUT_MS = 10_000;
export const BULK_STORAGE_DEFAULT_REQUEST_TIMEOUT_MS = 600_000;
export const BULK_STORAGE_MAX_ATTEMPTS = 3;

export function resolveBulkStorageRequestTimeoutMs(raw: string | undefined): number {
  const parsed = Number(raw?.trim());
  return Number.isFinite(parsed) && parsed >= 15_000 ? Math.floor(parsed) : BULK_STORAGE_DEFAULT_REQUEST_TIMEOUT_MS;
}

export function buildBulkStorageS3Client(config: ObjectStorageConfig, requestTimeoutMs?: number): S3Client {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
    requestHandler: {
      connectionTimeout: BULK_STORAGE_CONNECT_TIMEOUT_MS,
      requestTimeout:
        requestTimeoutMs ?? resolveBulkStorageRequestTimeoutMs(process.env.VACATIONWEB_BULK_REQUEST_TIMEOUT_MS),
      throwOnRequestTimeout: true,
    },
    maxAttempts: BULK_STORAGE_MAX_ATTEMPTS,
  });
}

export type StorageTransferOptions = { longTransfer?: boolean };

let cachedBulkClient: { fingerprint: string; client: S3Client } | null = null;

function getS3Client(options?: StorageTransferOptions): { config: ObjectStorageConfig; client: S3Client } {
  const config = getObjectStorageConfig();
  const fingerprint = `${config.bucket}|${config.region}|${config.endpoint ?? ''}|${config.accessKeyId}`;
  if (options?.longTransfer) {
    if (!cachedBulkClient || cachedBulkClient.fingerprint !== fingerprint) {
      cachedBulkClient = { fingerprint, client: buildBulkStorageS3Client(config) };
    }
    return { config, client: cachedBulkClient.client };
  }
  if (!cachedClient || cachedClient.fingerprint !== fingerprint) {
    cachedClient = { fingerprint, client: createS3Client(config) };
  }
  return { config, client: cachedClient.client };
}

export async function putStorageBytes(
  key: string,
  body: Buffer | string,
  contentType = 'application/json',
  options?: StorageTransferOptions,
): Promise<{
  bucket: string;
  key: string;
  byteSize: number;
}> {
  const { config, client } = getS3Client(options);
  const payload = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: payload,
      ContentType: contentType,
    }),
  );

  return {
    bucket: config.bucket,
    key,
    byteSize: payload.byteLength,
  };
}

export async function putStorageObject(
  key: string,
  localFilePath: string,
  options?: StorageTransferOptions,
): Promise<{
  bucket: string;
  key: string;
  byteSize: number;
}> {
  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Local Object Storage file not found: ${localFilePath}`);
  }

  return putStorageBytes(key, fs.readFileSync(localFilePath), 'application/json', options);
}

export async function putOffersObject(localFilePath: string): Promise<{
  bucket: string;
  key: string;
  byteSize: number;
}> {
  const config = getObjectStorageConfig();
  return putStorageObject(config.offersKey, localFilePath);
}

export async function headStorageObject(
  key: string,
): Promise<{ contentLength: number } | null> {
  const { config, client } = getS3Client();

  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: key,
      }),
    );

    return { contentLength: response.ContentLength ?? 0 };
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    const httpStatus = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    if (name === 'NotFound' || name === 'NoSuchKey' || httpStatus === 404) {
      return null;
    }
    throw error;
  }
}

export async function getStorageObject(key: string): Promise<string> {
  const bytes = await getStorageObjectBytes(key);
  return bytes.toString('utf8');
}

export async function getStorageObjectBytes(key: string): Promise<Buffer> {
  const { config, client } = getS3Client();

  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`Object Storage returned an empty body for ${key}`);
  }

  const bytes = await response.Body.transformToByteArray();
  return Buffer.from(bytes);
}

export async function downloadStorageObject(
  key: string,
  localFilePath: string,
  options?: StorageTransferOptions,
): Promise<{ byteSize: number; sha256: string }> {
  const { config, client } = getS3Client(options);
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );

  if (!response.Body) {
    throw new Error(`Object Storage returned an empty body for ${key}`);
  }

  fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
  const hash = createHash('sha256');
  const body = response.Body as Readable;
  const out = fs.createWriteStream(localFilePath);

  body.on('data', (chunk: Buffer) => {
    hash.update(chunk);
  });

  await pipeline(body, out);

  return {
    byteSize: fs.statSync(localFilePath).size,
    sha256: hash.digest('hex'),
  };
}

export async function getOffersObject(): Promise<string> {
  const config = getObjectStorageConfig();
  return getStorageObject(config.offersKey);
}
