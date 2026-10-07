import { deriveFilterOptions } from '@/lib/offers/derive-filter-options';
import { canonicalizeFilterOptions, loadFilterOptions } from '@/lib/offers/load-filter-options';
import { loadRuntimeDataset } from '@/lib/offers/load-runtime-dataset';
import { excludeParkedResultsProviders } from '@/lib/search/presentable-price';
import { siteMarketUniverse } from '@/lib/search/market-inventory';
import type { SiteMarket } from '@/lib/search/site-market';
import type { FilterOptions } from '@/types/travel';
import type { TravelOffer } from '@/types/travel';

/** UI filter options for the same active provider set as Results. Catalog stays intact. */
export function presentActiveFilterOptions(offers: readonly TravelOffer[]): FilterOptions {
  return canonicalizeFilterOptions(deriveFilterOptions(excludeParkedResultsProviders(offers)));
}

/** Derived options per cached catalog array and market (pure function of that array). */
const presentedOptionsCache = new WeakMap<readonly TravelOffer[], Map<string, FilterOptions>>();

/** SUB 33D: on a market host the options and totals come from that market's universe. */
export async function loadPresentedFilterOptions(siteMarket?: SiteMarket): Promise<FilterOptions> {
  const catalog = (await loadRuntimeDataset()).offers;
  let byMarket = presentedOptionsCache.get(catalog);
  if (!byMarket) {
    byMarket = new Map();
    presentedOptionsCache.set(catalog, byMarket);
  }
  const key = siteMarket ?? 'all';
  let options = byMarket.get(key);
  if (!options) {
    options = presentActiveFilterOptions(siteMarketUniverse(catalog, siteMarket));
    byMarket.set(key, options);
  }
  return options;
}

/**
 * Host-facing counts and lists outside Results (homepage, /search, destination popup):
 * a market host (.be / .nl) gets its own market universe, the same set as Results (SUB 33D,
 * PD-033). Without a market (localhost, previews) the static build options stay unchanged.
 */
export async function loadHostFilterOptions(siteMarket?: SiteMarket): Promise<FilterOptions> {
  return siteMarket ? loadPresentedFilterOptions(siteMarket) : loadFilterOptions();
}
