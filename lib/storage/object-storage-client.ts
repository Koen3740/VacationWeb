import fs from 'node:fs';
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

  const fileBuffer = fs.readFileSync(localFilePath);
  const config = getObjectStorageConfig();
  const client = createS3Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: 'application/json',
    }),
  );

  return {
    bucket: config.bucket,
    key,
    byteSize: fileBuffer.byteLength,
  };
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
  const config = getObjectStorageConfig();
  const client = createS3Client(config);

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
  const config = getObjectStorageConfig();
  const client = createS3Client(config);

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

export async function getOffersObject(): Promise<string> {
  const config = getObjectStorageConfig();
  return getStorageObject(config.offersKey);
}
