import type { StoredOffer } from '../feeds/types/stored-offer';
import {
  CORENDON_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
  isParkedResultsProvider,
  PRIJSVRIJ_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
} from '../search/presentable-price';
import {
  detailProviderSlug,
  type DetailProviderSlug,
} from './canonical-offer-identity';

/** Providers loaded into the runtime Results catalog (Prijsvrij stays parked / shard-only). */
export const RUNTIME_CATALOG_ACTIVE_PROVIDERS = [
  CORENDON_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
] as const;

export type RuntimeCatalogActiveProvider = (typeof RUNTIME_CATALOG_ACTIVE_PROVIDERS)[number];

export type CatalogShardMeta = {
  provider: string;
  slug: DetailProviderSlug;
  key: string;
  offerCount: number;
  byteSize: number;
  sha256: string;
};

export function isRuntimeCatalogActiveProvider(provider: string): boolean {
  return (RUNTIME_CATALOG_ACTIVE_PROVIDERS as readonly string[]).includes(provider);
}

export function excludeParkedProvidersFromStoredCatalog(
  offers: readonly StoredOffer[],
): StoredOffer[] {
  return offers.filter((offer) => !isParkedResultsProvider(offer.provider));
}

export function partitionStoredOffersByProvider(
  offers: readonly StoredOffer[],
): Map<string, StoredOffer[]> {
  const byProvider = new Map<string, StoredOffer[]>();
  for (const offer of offers) {
    const list = byProvider.get(offer.provider);
    if (list) {
      list.push(offer);
    } else {
      byProvider.set(offer.provider, [offer]);
    }
  }
  return byProvider;
}

export function shardSlugForProvider(provider: string): DetailProviderSlug | null {
  return detailProviderSlug(provider);
}

/** Stable shard order for writes/tests (parked last). */
export function orderedCatalogProviders(providers: Iterable<string>): string[] {
  const preferred = [
    CORENDON_PROVIDER_NAME,
    SUNWEB_PROVIDER_NAME,
    ELIZA_PROVIDER_NAME,
    PRIJSVRIJ_PROVIDER_NAME,
  ];
  const set = new Set(providers);
  const ordered: string[] = [];
  for (const name of preferred) {
    if (set.has(name)) {
      ordered.push(name);
      set.delete(name);
    }
  }
  for (const name of [...set].sort()) {
    ordered.push(name);
  }
  return ordered;
}
