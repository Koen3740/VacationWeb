import {
  assertCanonicalIdentitiesAssignable,
  detailObjectSha256,
  detailProviderSlug,
  type DetailProviderSlug,
} from './canonical-offer-identity';
import type { OfferDetailRecord } from './compact-runtime';
import { deriveFilterOptions } from './derive-filter-options';
import { splitStoredCatalog } from './compact-runtime';
import { normalizeOffer } from '../feeds/canonical/normalize-offer';
import type { StoredOffer } from '../feeds/types/stored-offer';
import { buildGenerationId, sha256HexBytes } from './generation-id';
import {
  generationCatalogKey,
  generationCatalogShardKey,
  generationDetailObjectKey,
  generationDetailsIndexKey,
  generationDetailsPrefix,
  generationFilterOptionsKey,
  generationManifestKey,
} from './generation-paths';
import {
  GENERATION_DETAILS_LAYOUT,
  type CatalogShardPointer,
  type DetailsIndex,
  type DetailsIndexEntry,
  type GenerationManifest,
} from './generation-types';
import type { FilterOptions } from '../../types/travel';
import {
  excludeParkedProvidersFromStoredCatalog,
  orderedCatalogProviders,
  partitionStoredOffersByProvider,
  shardSlugForProvider,
  type CatalogShardMeta,
} from './catalog-shards';

export type GenerationDetailBody = {
  externalId: string;
  canonicalOfferIdentity: string;
  providerSlug: DetailProviderSlug;
  key: string;
  sha256: string;
  body: string;
};

export type GenerationCatalogShard = CatalogShardMeta & {
  offers: StoredOffer[];
  json: string;
};

export type GenerationArtifacts = {
  generationId: string;
  catalog: StoredOffer[];
  catalogJson: string;
  catalogSha256: string;
  catalogBytes: number;
  catalogShards: GenerationCatalogShard[];
  catalogShardPointers: CatalogShardPointer[];
  filterOptions: FilterOptions;
  filterOptionsJson: string;
  filterOptionsSha256: string;
  filterOptionsBytes: number;
  detailsIndex: DetailsIndex;
  detailsIndexJson: string;
  detailsIndexSha256: string;
  detailsIndexBytes: number;
  details: GenerationDetailBody[];
  providers: Record<string, number>;
};

function countProviders(offers: StoredOffer[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const offer of offers) {
    counts[offer.provider] = (counts[offer.provider] ?? 0) + 1;
  }
  return counts;
}

function buildCatalogShards(
  generationId: string,
  catalog: StoredOffer[],
): GenerationCatalogShard[] {
  const byProvider = partitionStoredOffersByProvider(catalog);
  const shards: GenerationCatalogShard[] = [];
  for (const provider of orderedCatalogProviders(byProvider.keys())) {
    const offers = byProvider.get(provider) ?? [];
    const slug = shardSlugForProvider(provider);
    if (!slug) {
      throw new Error(`Unsupported provider for catalog shard: ${provider}`);
    }
    const json = JSON.stringify(offers);
    shards.push({
      provider,
      slug,
      key: generationCatalogShardKey(generationId, slug),
      offerCount: offers.length,
      byteSize: Buffer.byteLength(json),
      sha256: sha256HexBytes(json),
      offers,
      json,
    });
  }
  return shards;
}

export function buildGenerationArtifacts(
  runtimeOffers: StoredOffer[],
  sidecarDetails: Record<string, OfferDetailRecord>,
  date = new Date(),
): GenerationArtifacts {
  if (runtimeOffers.length === 0) {
    throw new Error('Refusing to build a generation from an empty catalog');
  }

  const identified = assertCanonicalIdentitiesAssignable(runtimeOffers);
  const { runtime, details: splitDetails } = splitStoredCatalog(identified);
  const catalog = runtime;
  const catalogJson = JSON.stringify(catalog);
  const generationId = buildGenerationId(catalogJson, date);
  const catalogShards = buildCatalogShards(generationId, catalog);
  const catalogShardPointers: CatalogShardPointer[] = catalogShards.map((shard) => ({
    provider: shard.provider,
    slug: shard.slug,
    key: shard.key,
  }));
  // Filter metadata for Results: active providers only (parked Prijsvrij excluded).
  const filterOptions = deriveFilterOptions(
    excludeParkedProvidersFromStoredCatalog(catalog).map(normalizeOffer),
  );
  const filterOptionsJson = JSON.stringify(filterOptions, null, 2);

  const byExternalId: Record<string, DetailsIndexEntry> = {};
  const details: GenerationDetailBody[] = [];

  for (const offer of catalog) {
    const identity = offer.canonicalOfferIdentity;
    if (!identity) {
      throw new Error(`Missing canonicalOfferIdentity after assignment: ${offer.externalId}`);
    }
    const slug = detailProviderSlug(offer.provider);
    if (!slug) {
      throw new Error(`Unsupported provider on catalog row: ${offer.externalId}`);
    }
    const payload = sidecarDetails[offer.externalId] ?? splitDetails[offer.externalId] ?? {};
    const body = JSON.stringify(payload);
    const sha256 = detailObjectSha256(identity);
    const key = generationDetailObjectKey(generationId, slug, sha256);
    details.push({
      externalId: offer.externalId,
      canonicalOfferIdentity: identity,
      providerSlug: slug,
      key,
      sha256,
      body,
    });
    byExternalId[offer.externalId] = {
      externalId: offer.externalId,
      canonicalOfferIdentity: identity,
      provider: offer.provider,
      providerSlug: slug,
      sha256,
      key,
    };
  }

  const detailsIndex: DetailsIndex = {
    schemaVersion: 1,
    generationId,
    byExternalId,
  };
  const detailsIndexJson = JSON.stringify(detailsIndex);

  return {
    generationId,
    catalog,
    catalogJson,
    catalogSha256: sha256HexBytes(catalogJson),
    catalogBytes: Buffer.byteLength(catalogJson),
    catalogShards,
    catalogShardPointers,
    filterOptions,
    filterOptionsJson,
    filterOptionsSha256: sha256HexBytes(filterOptionsJson),
    filterOptionsBytes: Buffer.byteLength(filterOptionsJson),
    detailsIndex,
    detailsIndexJson,
    detailsIndexSha256: sha256HexBytes(detailsIndexJson),
    detailsIndexBytes: Buffer.byteLength(detailsIndexJson),
    details,
    providers: countProviders(catalog),
  };
}

export function buildCompleteManifest(artifacts: GenerationArtifacts): GenerationManifest {
  return {
    schemaVersion: 1,
    generationId: artifacts.generationId,
    status: 'complete',
    createdAt: new Date().toISOString(),
    offerCount: artifacts.catalog.length,
    providers: artifacts.providers,
    catalog: {
      key: generationCatalogKey(artifacts.generationId),
      sha256: artifacts.catalogSha256,
      byteSize: artifacts.catalogBytes,
    },
    filterOptions: {
      key: generationFilterOptionsKey(artifacts.generationId),
      sha256: artifacts.filterOptionsSha256,
      byteSize: artifacts.filterOptionsBytes,
    },
    detailsIndex: {
      key: generationDetailsIndexKey(artifacts.generationId),
      sha256: artifacts.detailsIndexSha256,
      byteSize: artifacts.detailsIndexBytes,
    },
    details: {
      prefix: generationDetailsPrefix(artifacts.generationId),
      objectCount: artifacts.details.length,
      layout: GENERATION_DETAILS_LAYOUT,
    },
  };
}

export { generationManifestKey };
