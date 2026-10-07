import type { SearchParams } from '@/types/travel';

export type SiteMarket = 'be' | 'nl';

/**
 * vacationweb.be vs vacationweb.nl (www and apex). The domain selects the Results market:
 * Results inventory is market-isolated (SUB 33D, replaces PD-020). A BE-only offer is not
 * eligible for NL Results, and an NL-only offer is not eligible for BE Results.
 * See `market-inventory.ts`. localhost and other hosts have no market and see the full catalog.
 */
export function resolveSiteMarketFromHost(host: string | undefined | null): SiteMarket | undefined {
  const hostname = (host ?? '').split(',')[0]?.trim().split(':')[0]?.toLowerCase() ?? '';
  if (!hostname) {
    return undefined;
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return undefined;
  }
  if (hostname === 'nl' || hostname.endsWith('.nl')) {
    return 'nl';
  }
  if (hostname === 'be' || hostname.endsWith('.be')) {
    return 'be';
  }
  return undefined;
}

/** NL and BE hosts, including www, each map to their own market. Other hosts see both. */
export function promotionMarketsForHost(host: string | undefined | null): SiteMarket[] {
  const market = resolveSiteMarketFromHost(host);
  if (market === 'nl' || market === 'be') {
    return [market];
  }
  return ['nl', 'be'];
}

export function attachSiteMarket(params: SearchParams, host: string | undefined | null): SearchParams {
  const siteMarket = resolveSiteMarketFromHost(host);
  if (!siteMarket) {
    return params;
  }
  return { ...params, siteMarket };
}
