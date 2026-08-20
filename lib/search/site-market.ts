import type { SearchParams } from '@/types/travel';

export type SiteMarket = 'be' | 'nl';

/**
 * vacationmap.be vs vacationmap.nl. Domain does not lock inventory.
 * Used only as a listing-preference signal after departure airport.
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

export function attachSiteMarket(params: SearchParams, host: string | undefined | null): SearchParams {
  const siteMarket = resolveSiteMarketFromHost(host);
  if (!siteMarket) {
    return params;
  }
  return { ...params, siteMarket };
}
