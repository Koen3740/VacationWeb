import { loadFilterOptions } from '@/lib/offers/load-filter-options';
import { loadOffers } from '@/lib/offers/load-offers';

export function formatTotalOffersLabel(offerCount: number): string {
  const thousands = Math.floor(offerCount / 1000);
  return `${thousands.toLocaleString('nl-NL')}.000+ vakanties`;
}

export async function loadTotalOffersLabel(): Promise<string> {
  const totalOffers = loadFilterOptions().totalOffers;
  if (typeof totalOffers === 'number' && totalOffers > 0) {
    return formatTotalOffersLabel(totalOffers);
  }

  return formatTotalOffersLabel((await loadOffers()).length);
}
