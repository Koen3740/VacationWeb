/**
 * t364u: R2/S3 adapter for the generation pruner. Deliberately tiny and locked down:
 *  - lists ONLY Prefix `generations/` (ListObjectsV2, all pages; cap => truncated);
 *  - GET only `current.json` and `generations/<id>/manifest.json`;
 *  - DeleteObjects only for keys that parse as `generations/<valid id>/<known layout>`, and only
 *    when `allowDelete` is true (dry-run passes false: the delete path then throws);
 *  - no PutObject import at all: this module cannot write or overwrite `current.json`.
 * Reuses the catalogue S3 client (timeouts 3 s connect / 15 s per attempt) and the shared env config
 * (OBJECT_STORAGE_BUCKET / _REGION / _ENDPOINT / _ACCESS_KEY_ID / _SECRET_ACCESS_KEY).
 */
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  type S3Client,
} from '@aws-sdk/client-s3';
import { buildCatalogStorageS3Client } from '../storage/object-storage-client';
import { getObjectStorageConfig } from '../storage/object-storage-config';
import { CURRENT_POINTER_KEY } from './generation-types';
import {
  GENERATIONS_PREFIX,
  parseGenerationId,
  parseGenerationObjectKey,
  type PruneObject,
  type PruneStorage,
} from './prune-generations-core';

/** Safety cap on list pages (1000 keys each). Hitting it reports `truncated` => the run STOPs. */
export const MAX_LIST_PAGES = 2000;

const MANIFEST_KEY_PATTERN = /^generations\/(g[0-9T]+Z-[0-9a-f]{12})\/manifest\.json$/;

function isReadableKey(key: string): boolean {
  if (key === CURRENT_POINTER_KEY) return true;
  const m = MANIFEST_KEY_PATTERN.exec(key);
  return m !== null && parseGenerationId(m[1]) !== null;
}

export function createR2PruneStorage(options: {
  client: Pick<S3Client, 'send'>;
  bucket: string;
  allowDelete: boolean;
}): PruneStorage {
  const { client, bucket, allowDelete } = options;
  return {
    async listGenerationObjects() {
      const objects: PruneObject[] = [];
      let token: string | undefined;
      for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
        const response = await client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: GENERATIONS_PREFIX,
            ContinuationToken: token,
          }),
        );
        for (const item of response.Contents ?? []) {
          if (!item.Key || item.LastModified === undefined || item.Size === undefined) {
            return { objects, truncated: true };
          }
          objects.push({ key: item.Key, size: item.Size, lastModified: item.LastModified });
        }
        if (!response.IsTruncated) {
          return { objects, truncated: false };
        }
        token = response.NextContinuationToken;
        if (!token) {
          return { objects, truncated: true };
        }
      }
      return { objects, truncated: true };
    },

    async getText(key: string) {
      if (!isReadableKey(key)) {
        throw new Error(`prune adapter refuses to read ${JSON.stringify(key)}`);
      }
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!response.Body) {
          return null;
        }
        return await response.Body.transformToString();
      } catch (error) {
        const name = error instanceof Error ? error.name : '';
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (name === 'NoSuchKey' || name === 'NotFound' || status === 404) {
          return null;
        }
        throw error;
      }
    },

    async deleteObjects(keys: string[]) {
      if (!allowDelete) {
        throw new Error('prune adapter: delete is disabled (dry-run)');
      }
      for (const key of keys) {
        if (!parseGenerationObjectKey(key)) {
          throw new Error(`prune adapter refuses to delete ${JSON.stringify(key)} (not generations/<id>/<known layout>)`);
        }
      }
      if (keys.length === 0 || keys.length > 1000) {
        throw new Error(`prune adapter: invalid delete batch size ${keys.length}`);
      }
      const response = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: false },
        }),
      );
      const errors = (response.Errors ?? []).map((e) => `${e.Key ?? '?'}: ${e.Code ?? 'error'}`);
      return { deleted: (response.Deleted ?? []).length, errors };
    },
  };
}

/** Production wiring: config from OBJECT_STORAGE_* env (also read from .env.local by the shared config). */
export function createR2PruneStorageFromEnv(allowDelete: boolean): PruneStorage {
  const config = getObjectStorageConfig();
  return createR2PruneStorage({
    client: buildCatalogStorageS3Client(config),
    bucket: config.bucket,
    allowDelete,
  });
}