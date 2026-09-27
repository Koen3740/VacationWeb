/**
 * C0: object-storage config reads `.env.local` / `.env` once per process;
 * precedence and missing-config errors are unchanged.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, mock, test } from 'node:test';
import {
  getObjectStorageConfig,
  resetObjectStorageEnvFilesForTests,
} from './object-storage-config';

const KEYS = [
  'OBJECT_STORAGE_BUCKET',
  'OBJECT_STORAGE_REGION',
  'OBJECT_STORAGE_ACCESS_KEY_ID',
  'OBJECT_STORAGE_SECRET_ACCESS_KEY',
  'OBJECT_STORAGE_ENDPOINT',
  'OBJECT_STORAGE_OFFERS_KEY',
] as const;

const FULL_LOCAL =
  'OBJECT_STORAGE_BUCKET=b\nOBJECT_STORAGE_REGION=auto\nOBJECT_STORAGE_ACCESS_KEY_ID=id\nOBJECT_STORAGE_SECRET_ACCESS_KEY=secret\n';

let saved: Record<string, string | undefined> = {};
let originalCwd = '';
let tmp = '';

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  originalCwd = process.cwd();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c0-env-'));
  process.chdir(tmp);
  resetObjectStorageEnvFilesForTests();
});

afterEach(() => {
  mock.restoreAll();
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetObjectStorageEnvFilesForTests();
});

test('C0: env files are read once across N getObjectStorageConfig calls', () => {
  fs.writeFileSync('.env.local', FULL_LOCAL);
  const exists = mock.method(fs, 'existsSync');
  const read = mock.method(fs, 'readFileSync');
  for (let i = 0; i < 50; i += 1) {
    assert.equal(getObjectStorageConfig().bucket, 'b');
  }
  // One pass: existsSync for .env.local + .env, readFileSync only for .env.local.
  assert.equal(exists.mock.callCount(), 2);
  assert.equal(read.mock.callCount(), 1);
});

test('C0: precedence unchanged (non-empty process.env > .env.local > .env; empty env var is filled)', () => {
  fs.writeFileSync('.env.local', 'OBJECT_STORAGE_BUCKET=local-bucket\nOBJECT_STORAGE_REGION="local-region"\n');
  fs.writeFileSync(
    '.env',
    [
      '# comment',
      'OBJECT_STORAGE_BUCKET=env-bucket',
      'OBJECT_STORAGE_REGION=env-region',
      'OBJECT_STORAGE_ACCESS_KEY_ID=env-id',
      "OBJECT_STORAGE_SECRET_ACCESS_KEY='env-secret'",
      'OBJECT_STORAGE_OFFERS_KEY=env-offers.json',
      '',
    ].join('\n'),
  );
  process.env.OBJECT_STORAGE_ACCESS_KEY_ID = 'proc-id';
  process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY = '';
  const config = getObjectStorageConfig();
  assert.deepEqual(config, {
    bucket: 'local-bucket',
    offersKey: 'env-offers.json',
    region: 'local-region',
    accessKeyId: 'proc-id',
    secretAccessKey: 'env-secret',
    endpoint: undefined,
  });
  assert.deepEqual(getObjectStorageConfig(), config);
});

test('C0: missing required variable throws the same error on every call', () => {
  fs.writeFileSync('.env', 'OBJECT_STORAGE_REGION=r\n');
  for (let i = 0; i < 3; i += 1) {
    assert.throws(
      () => getObjectStorageConfig(),
      /Missing required environment variable: OBJECT_STORAGE_BUCKET/,
    );
  }
});

test('C0: config is not frozen - process.env changes after the first load are honoured', () => {
  fs.writeFileSync('.env.local', FULL_LOCAL);
  assert.equal(getObjectStorageConfig().bucket, 'b');
  process.env.OBJECT_STORAGE_BUCKET = 'changed';
  process.env.OBJECT_STORAGE_ENDPOINT = 'https://r2.example';
  const config = getObjectStorageConfig();
  assert.equal(config.bucket, 'changed');
  assert.equal(config.endpoint, 'https://r2.example');
});
