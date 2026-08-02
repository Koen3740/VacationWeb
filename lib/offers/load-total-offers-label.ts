import { loadOffers } from '@/lib/offers/load-offers';

export function formatTotalOffersLabel(offerCount: number): string {
  const thousands = Math.floor(offerCount / 1000);
  return `${thousands.toLocaleString('nl-NL')}.000+ vakanties`;
}

export async function loadTotalOffersLabel(): Promise<string> {
  return formatTotalOffersLabel((await loadOffers()).length);
}
