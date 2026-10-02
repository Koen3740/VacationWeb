/**
 * Results sidebar provider filter — subsets the proven-B (effective) Results pool.
 *
 * NOT a catalog/pre-live filter. Counts and membership come from
 * {@link bookableResultsMembership} only. URL `?provider=` matches
 * `TravelOffer.provider` exactly.
 */
import type { SearchParams, TravelOffer } from '@/types/travel';

export const PROVIDER_FILTER_PARAM = 'provider';

export type ProviderPoolCount = {
  provider: string;
  count: number;
};

export type ProviderFilterOptions = {
  /** Full effective Results pool size (Alle aanbieders). */
  total: number;
  /** Per-provider counts within that same pool (providers with count > 0). */
  providers: ProviderPoolCount[];
};

/** Parse URL `provider` — exact TravelOffer.provider string; empty → undefined. */
export function parseProviderParam(raw: string | null | undefined): string | undefined {
  if (typeof raw !== 'string') {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function serializeProviderParam(provider: string | undefined): string | undefined {
  const trimmed = provider?.trim();
  return trimmed ? trimmed : undefined;
}

/** Strip provider so prepare / facet option counts use the full effective pool. */
export function omitProviderFilter(params: SearchParams): SearchParams {
  if (params.provider === undefined) {
    return params;
  }
  const { provider: _removed, ...rest } = params;
  return rest;
}

export function offerMatchesProviderFilter(
  offer: Pick<TravelOffer, 'provider'>,
  provider: string | undefined,
): boolean {
  if (!provider) {
    return true;
  }
  return offer.provider === provider;
}

/**
 * Scope a ranked matchset / candidate window to the active Results provider filter.
 * No-op when `provider` is unset (Alle aanbieders). Used by Page-1 discovery/overlay
 * so settle/freeze/page1Ids stay inside the same effective provider pool as heading.
 */
export function scopeOffersToProviderFilter<T extends Pick<TravelOffer, 'provider'>>(
  offers: readonly T[],
  params: Pick<SearchParams, 'provider'> | undefined,
): T[] {
  if (!params?.provider) {
    return offers as T[];
  }
  return offers.filter((offer) => offerMatchesProviderFilter(offer, params.provider));
}

/**
 * Count providers inside an already-computed effective Results pool
 * (proven B / bookable membership). Never call with the raw catalog matchset
 * when that set is larger than the effective pool.
 */
export function countProvidersInEffectivePool(
  effectivePool: readonly Pick<TravelOffer, 'provider'>[],
): ProviderFilterOptions {
  const counts = new Map<string, number>();
  for (const offer of effectivePool) {
    const name = typeof offer.provider === 'string' ? offer.provider.trim() : '';
    if (!name) {
      continue;
    }
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const providers = [...counts.entries()]
    .map(([provider, count]) => ({ provider, count }))
    .sort((left, right) => left.provider.localeCompare(right.provider, 'nl'));
  return {
    total: effectivePool.length,
    providers,
  };
}

/**
 * t334u: providers PRESENT in the catalog matchset of this search (distinct, trimmed,
 * sorted nl). Known as soon as the matchset is prepared - independent of live pricing,
 * so the sidebar can list Corendon / Sunweb / Eliza was here while pricing is still
 * running. Selecting one still subsets the proven-B pool (membership unchanged).
 */
export function listProvidersInMatchset(
  matchset: readonly Pick<TravelOffer, 'provider'>[],
): string[] {
  const names = new Set<string>();
  for (const offer of matchset) {
    const name = typeof offer.provider === 'string' ? offer.provider.trim() : '';
    if (name) {
      names.add(name);
    }
  }
  return [...names].sort((left, right) => left.localeCompare(right, 'nl'));
}
