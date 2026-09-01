export const GENERATION_SCHEMA_VERSION = 1;
export const CURRENT_POINTER_KEY = 'current.json';
export const GENERATION_DETAILS_LAYOUT = 'details/{provider}/{sha256}.json';

export type CatalogShardPointer = {
  provider: string;
  slug: string;
  key: string;
};

export type CurrentPointer = {
  schemaVersion: 1;
  generationId: string;
  catalogKey: string;
  detailsPrefix: string;
  filterOptionsKey: string;
  updatedAt: string;
  /**
   * Optional per-provider catalog shards. When present, runtime loads only
   * active (non-parked) shards and never fetches parked provider objects.
   * Full `catalogKey` remains for fallback / reversibility.
   */
  catalogShards?: CatalogShardPointer[];
};

export type GenerationFileMeta = {
  key: string;
  sha256: string;
  byteSize: number;
};

export type GenerationManifest = {
  schemaVersion: 1;
  generationId: string;
  status: 'complete' | 'incomplete';
  createdAt: string;
  offerCount: number;
  providers: Record<string, number>;
  catalog: GenerationFileMeta;
  filterOptions: GenerationFileMeta;
  detailsIndex: GenerationFileMeta;
  details: {
    prefix: string;
    objectCount: number;
    layout: typeof GENERATION_DETAILS_LAYOUT;
  };
};

export type DetailsIndexEntry = {
  externalId: string;
  canonicalOfferIdentity: string;
  provider: string;
  providerSlug: string;
  sha256: string;
  key: string;
};

export type DetailsIndex = {
  schemaVersion: 1;
  generationId: string;
  byExternalId: Record<string, DetailsIndexEntry>;
};

export type PreSub19BackupNote = {
  backupId: string;
  timestamp: string;
  sourceKeys: {
    catalog: string;
    details: string;
  };
  source: {
    catalogBytes: number;
    detailsBytes: number;
    catalogSha256: string;
    detailsSha256: string;
    offerCount: number;
    detailCount: number;
    providers?: Record<string, number>;
  };
  backupKeys: {
    catalog: string;
    details: string;
    note: string;
  };
  backup: {
    catalogBytes: number;
    detailsBytes: number;
    catalogSha256: string;
    detailsSha256: string;
    offerCount: number;
    detailCount: number;
  };
  verified: boolean;
};
