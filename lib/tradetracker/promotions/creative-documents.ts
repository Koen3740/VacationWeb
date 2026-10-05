import { TRADETRACKER_CREATIVE_CANONICAL_SITE, type TradeTrackerCredentialMarket } from './constants';
import { selectedCreativeFileName } from './select-creatives';
import { getStorageObject, putStorageBytes } from '../../storage/object-storage-client';
import { getObjectStorageConfig } from '../../storage/object-storage-config';

/**
 * JSON documents for `/aanbiedingen`, same isolated prefix as banner bytes.
 * Local files win when they exist. Object storage is the production copy.
 * These keys never overlap offers, catalog generations, current.json, or live-price.
 */

export const CREATIVE_DOCUMENT_STORAGE_PREFIX = 'tradetracker-creatives';
export const CREATIVE_IMAGE_MANIFEST_STORAGE_KEY = 'tradetracker-creatives/creative-image-manifest.json';

const DOCUMENT_KEYS = new Set<string>([
  'tradetracker-creatives/selected-nl-512226.json',
  'tradetracker-creatives/selected-be-511873.json',
  CREATIVE_IMAGE_MANIFEST_STORAGE_KEY,
]);

export function selectedCreativeStorageKey(market: TradeTrackerCredentialMarket): string {
  const key = `${CREATIVE_DOCUMENT_STORAGE_PREFIX}/${selectedCreativeFileName(market, TRADETRACKER_CREATIVE_CANONICAL_SITE[market])}`;
  assertIsolatedCreativeDocumentKey(key);
  return key;
}

export function assertIsolatedCreativeDocumentKey(key: string): void {
  if (!DOCUMENT_KEYS.has(key) || key.includes('..') || key.split('/').some((part) => part === '.' || part === '..')) {
    throw new Error('creative document key is outside the isolated prefix');
  }
  if (!key.startsWith(`${CREATIVE_DOCUMENT_STORAGE_PREFIX}/`)) {
    throw new Error('creative document key is outside the isolated prefix');
  }
  const forbidden = ['offers.json', 'current.json', 'generations', 'live-price', 'catalog'];
  if (forbidden.some((part) => key.includes(part))) {
    throw new Error('creative document key overlaps catalog storage');
  }
}

function isStorageNotFound(error: unknown): boolean {
  const name = error instanceof Error ? error.name : '';
  const httpStatus = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  return name === 'NotFound' || name === 'NoSuchKey' || httpStatus === 404;
}

async function defaultReadIsolatedDocument(key: string): Promise<string | null> {
  try {
    getObjectStorageConfig();
  } catch {
    return null;
  }
  try {
    return await getStorageObject(key);
  } catch (error) {
    if (isStorageNotFound(error)) {
      return null;
    }
    throw error;
  }
}

async function defaultPublishIsolatedDocument(key: string, body: string): Promise<void> {
  getObjectStorageConfig();
  await putStorageBytes(key, body, 'application/json');
}

export async function readIsolatedCreativeDocument(
  key: string,
  readObject: (key: string) => Promise<string | null> = defaultReadIsolatedDocument,
): Promise<string | null> {
  assertIsolatedCreativeDocumentKey(key);
  return readObject(key);
}

/** Upload one isolated JSON document. Returns unavailable when object-storage env is absent. */
export async function publishIsolatedCreativeDocument(
  key: string,
  body: string,
  publish: (key: string, body: string) => Promise<void> = defaultPublishIsolatedDocument,
): Promise<'stored' | 'unavailable'> {
  assertIsolatedCreativeDocumentKey(key);
  try {
    await publish(key, body);
    return 'stored';
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('Missing required environment variable:')) {
      return 'unavailable';
    }
    throw error;
  }
}
