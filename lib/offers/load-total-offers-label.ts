import { loadPresentedFilterOptions } from '@/lib/offers/present-active-filter-options';

export function formatTotalOffersLabel(offerCount: number): string {
  const thousands = Math.floor(offerCount / 1000);
  return `${thousands.toLocaleString('nl-NL')}.000+ vakanties`;
}

export async function loadTotalOffersLabel(): Promise<string> {
  const totalOffers = (await loadPresentedFilterOptions()).totalOffers;
  return formatTotalOffersLabel(typeof totalOffers === 'number' ? totalOffers : 0);
}
