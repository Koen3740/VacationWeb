import { headers } from 'next/headers';
import { resolveSiteMarketFromHost, type SiteMarket } from '@/lib/search/site-market';

/**
 * Market of the current request host, resolved exactly like Results and detail
 * (`x-forwarded-host`, else `host`). Server components only (SUB 33D).
 */
export function requestSiteMarket(): SiteMarket | undefined {
  const requestHeaders = headers();
  return resolveSiteMarketFromHost(requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host'));
}
