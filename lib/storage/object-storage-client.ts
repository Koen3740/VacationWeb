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

function createS3Client(config: ObjectStorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
  });
}

function getS3Client(): { config: ObjectStorageConfig; client: S3Client } {
  const config = getObjectStorageConfig();
  const fingerprint = `${config.bucket}|${config.region}|${config.endpoint ?? ''}|${config.accessKeyId}`;
  if (!cachedClient || cachedClient.fingerprint !== fingerprint) {
    cachedClient = { fingerprint, client: createS3Client(config) };
  }
  return { config, client: cachedClient.client };
}

export async function putStorageBytes(
  key: string,
  body: Buffer | string,
  contentType = 'application/json',
): Promise<{
  bucket: string;
  key: string;
  byteSize: number;
}> {
  const { config, client } = getS3Client();
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
): Promise<{
  bucket: string;
  key: string;
  byteSize: number;
}> {
  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Local Object Storage file not found: ${localFilePath}`);
  }

  return putStorageBytes(key, fs.readFileSync(localFilePath));
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

  return response.Body.transformToString();
}

export async function downloadStorageObject(
  key: string,
  localFilePath: string,
): Promise<{ byteSize: number; sha256: string }> {
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
