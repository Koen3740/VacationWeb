import {
  CURRENT_POINTER_KEY,
  type CurrentPointer,
} from './generation-types';
import type { DetailProviderSlug } from './canonical-offer-identity';

export function generationPrefix(generationId: string): string {
  return `generations/${generationId}`;
}

export function generationCatalogKey(generationId: string): string {
  return `${generationPrefix(generationId)}/catalog.json`;
}

export function generationCatalogShardsPrefix(generationId: string): string {
  return `${generationPrefix(generationId)}/shards/`;
}

export function generationCatalogShardKey(
  generationId: string,
  providerSlug: string,
): string {
  return `${generationCatalogShardsPrefix(generationId)}${providerSlug}.json`;
}

export function generationManifestKey(generationId: string): string {
  return `${generationPrefix(generationId)}/manifest.json`;
}

export function generationFilterOptionsKey(generationId: string): string {
  return `${generationPrefix(generationId)}/filter-options.json`;
}

export function generationDetailsIndexKey(generationId: string): string {
  return `${generationPrefix(generationId)}/details-index.json`;
}

export function generationDetailsPrefix(generationId: string): string {
  return `${generationPrefix(generationId)}/details/`;
}

export function generationDetailObjectKey(
  generationId: string,
  providerSlug: DetailProviderSlug,
  sha256: string,
): string {
  return `${generationDetailsPrefix(generationId)}${providerSlug}/${sha256}.json`;
}

export function backupPrefix(backupId: string): string {
  return `backups/pre-sub19/${backupId}`;
}

export function backupCatalogKey(backupId: string): string {
  return `${backupPrefix(backupId)}/offers.json`;
}

export function backupDetailsKey(backupId: string): string {
  return `${backupPrefix(backupId)}/offers.detail.json`;
}

export function backupNoteKey(backupId: string): string {
  return `${backupPrefix(backupId)}/note.json`;
}

export function buildCurrentPointer(
  generationId: string,
  updatedAt = new Date().toISOString(),
  catalogShards?: CurrentPointer['catalogShards'],
): CurrentPointer {
  return {
    schemaVersion: 1,
    generationId,
    catalogKey: generationCatalogKey(generationId),
    detailsPrefix: generationDetailsPrefix(generationId),
    filterOptionsKey: generationFilterOptionsKey(generationId),
    updatedAt,
    ...(catalogShards && catalogShards.length > 0 ? { catalogShards } : {}),
  };
}

export { CURRENT_POINTER_KEY };
