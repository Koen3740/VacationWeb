import { loadPresentedFilterOptions } from '@/lib/offers/present-active-filter-options';
import type { SiteMarket } from '@/lib/search/site-market';

export function formatTotalOffersLabel(offerCount: number): string {
  const thousands = Math.floor(offerCount / 1000);
  return `${thousands.toLocaleString('nl-NL')}.000+ vakanties`;
}

/** SUB 33D: on a market host the total is that market's universe. */
export async function loadTotalOffersLabel(siteMarket?: SiteMarket): Promise<string> {
  const totalOffers = (await loadPresentedFilterOptions(siteMarket)).totalOffers;
  return formatTotalOffersLabel(typeof totalOffers === 'number' ? totalOffers : 0);
}
