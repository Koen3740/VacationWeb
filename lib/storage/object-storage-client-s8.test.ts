/**
 * D-v2 S8 (owner GO 25-09 17:10): catalogue object-storage client bounds (review
 * timeout table row F, T23): connect 3000 ms, 15000 ms per attempt (throw on request
 * timeout), 1 retry (maxAttempts 2); live-price L2 client unchanged. No network, no
 * local HTTP server, no port: the transport is an injected request handler.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { GetObjectCommand, HeadObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import {
  CATALOG_STORAGE_CLIENT_OPTIONS,
  CATALOG_STORAGE_CONNECT_TIMEOUT_MS,
  CATALOG_STORAGE_MAX_ATTEMPTS,
  CATALOG_STORAGE_REQUEST_TIMEOUT_MS,
  buildCatalogStorageS3Client,
} from '@/lib/storage/object-storage-client';
import { buildLivePriceL2S3Client } from '@/lib/search/live-price-l2-store';

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const CONFIG = {
  bucket: 'b',
  offersKey: 'offers.json',
  region: 'auto',
  accessKeyId: 'id',
  secretAccessKey: 'secret',
  endpoint: 'https://example.invalid',
};

type HandlerConfig = { connectionTimeout?: number; requestTimeout?: number; throwOnRequestTimeout?: boolean };

async function resolvedHandlerConfig(client: S3Client): Promise<HandlerConfig> {
  const handler = client.config.requestHandler as unknown as { configProvider: Promise<HandlerConfig> };
  return handler.configProvider;
}

/** Replace the transport (read by the SDK at send time) with a scripted handler. */
function injectHandler(
  client: S3Client,
  handle: (attempt: number) => Promise<{ response: unknown }>,
): { calls: number[] } {
  const state = { calls: [] as number[] };
  const t0 = Date.now();
  (client.config as unknown as { requestHandler: unknown }).requestHandler = {
    handle: () => {
      state.calls.push(Date.now() - t0);
      return handle(state.calls.length);
    },
    updateHttpClientConfig: () => {},
    httpHandlerConfigs: () => ({}),
  };
  return state;
}

/** Same error shape the SDK NodeHttpHandler throws when requestTimeout elapses. */
function requestTimeoutError(ms: number): Error {
  return Object.assign(new Error(`Connection timed out after ${ms} ms`), { name: 'TimeoutError' });
}

test('T23 config: catalogue client connect 3000, request 15000 + throw, maxAttempts 2', async () => {
  assert.equal(CATALOG_STORAGE_CONNECT_TIMEOUT_MS, 3_000);
  assert.equal(CATALOG_STORAGE_REQUEST_TIMEOUT_MS, 15_000);
  assert.equal(CATALOG_STORAGE_MAX_ATTEMPTS, 2);
  assert.equal(CATALOG_STORAGE_CLIENT_OPTIONS.requestHandler.throwOnRequestTimeout, true);
  const client = buildCatalogStorageS3Client(CONFIG);
  try {
    assert.equal(await client.config.maxAttempts(), 2);
    const resolved = await resolvedHandlerConfig(client);
    assert.equal(resolved.connectionTimeout, 3_000);
    assert.equal(resolved.requestTimeout, 15_000);
    assert.equal(resolved.throwOnRequestTimeout, true);
  } finally {
    client.destroy();
  }
});

test('S8: live-price L2 client timeouts unchanged (separate client: 1000 / 2000 / 1 attempt)', async () => {
  const client = buildLivePriceL2S3Client(CONFIG);
  try {
    assert.equal(await client.config.maxAttempts(), 1);
    const resolved = await resolvedHandlerConfig(client);
    assert.equal(resolved.connectionTimeout, 1_000);
    assert.equal(resolved.requestTimeout, 2_000);
    assert.equal(resolved.throwOnRequestTimeout, true);
  } finally {
    client.destroy();
  }
});

test('T23 timeout: each attempt times out -> exactly 2 attempts, then the existing error propagates', async () => {
  const client = buildCatalogStorageS3Client(CONFIG);
  const attemptMs = 60; // stands in for the 15 s per-attempt bound enforced by the SDK handler
  const state = injectHandler(
    client,
    () => new Promise((_, reject) => setTimeout(() => reject(requestTimeoutError(attemptMs)), attemptMs)),
  );
  try {
    await assert.rejects(
      client.send(new HeadObjectCommand({ Bucket: 'b', Key: 'current.json' })),
      (error: Error & { $metadata?: { attempts?: number } }) => {
        assert.equal(error.name, 'TimeoutError');
        assert.equal(error.$metadata?.attempts, 2);
        return true;
      },
    );
    assert.equal(state.calls.length, 2, '1 retry (maxAttempts 2)');
    assert.ok(state.calls[1]! >= attemptMs, 'second attempt starts after the first timed out');
  } finally {
    client.destroy();
  }
});

test('T23 retry recovers: first attempt times out, second succeeds -> catalogue body returned', async () => {
  const client = buildCatalogStorageS3Client(CONFIG);
  const state = injectHandler(client, async (attempt) => {
    if (attempt === 1) throw requestTimeoutError(15_000);
    return {
      response: { statusCode: 200, headers: { 'content-type': 'application/json' }, body: Readable.from([Buffer.from('{"ok":2}')]) },
    };
  });
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: 'b', Key: 'offers.json' }));
    assert.equal(await out.Body?.transformToString(), '{"ok":2}');
    assert.equal(state.calls.length, 2);
  } finally {
    client.destroy();
  }
});

test('S8 normal catalogue load: one attempt, body returned unchanged', async () => {
  const client = buildCatalogStorageS3Client(CONFIG);
  const state = injectHandler(client, async () => ({
    response: { statusCode: 200, headers: { 'content-type': 'application/json' }, body: Readable.from([Buffer.from('[{"id":"x"}]')]) },
  }));
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: 'b', Key: 'offers.json' }));
    assert.equal(await out.Body?.transformToString(), '[{"id":"x"}]');
    assert.equal(state.calls.length, 1);
  } finally {
    client.destroy();
  }
});

test('S8 source: catalogue client uses the bounded builder; catalogue failure path unchanged', () => {
  const client = read('lib/storage/object-storage-client.ts');
  assert.match(client, /function createS3Client\(config: ObjectStorageConfig\): S3Client \{\r?\n\s+return buildCatalogStorageS3Client\(config\);/);
  const loader = read('lib/offers/load-runtime-dataset.ts');
  assert.match(loader, /return getStorageObject\(key\);/);
  assert.match(loader, /const head = await headStorageObject\(CURRENT_POINTER_KEY\);/);
  assert.match(loader, /Promise\.allSettled\(/);
});
