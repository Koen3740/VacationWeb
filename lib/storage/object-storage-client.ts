import fs from 'node:fs';
import {
  GetObjectCommand,
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

export async function putOffersObject(localFilePath: string): Promise<{
  bucket: string;
  key: string;
  byteSize: number;
}> {
  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Local offers file not found: ${localFilePath}`);
  }

  const fileBuffer = fs.readFileSync(localFilePath);
  const config = getObjectStorageConfig();
  const client = createS3Client(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: config.offersKey,
      Body: fileBuffer,
      ContentType: 'application/json',
    }),
  );

  return {
    bucket: config.bucket,
    key: config.offersKey,
    byteSize: fileBuffer.byteLength,
  };
}

export async function getOffersObject(): Promise<string> {
  const config = getObjectStorageConfig();
  const client = createS3Client(config);

  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: config.offersKey,
    }),
  );

  if (!response.Body) {
    throw new Error(`Object Storage returned an empty body for ${config.offersKey}`);
  }

  return response.Body.transformToString();
}
