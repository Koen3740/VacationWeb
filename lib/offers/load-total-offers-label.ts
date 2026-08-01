import { loadOffers } from '@/lib/offers/load-offers';

export async function loadTotalOffersLabel(): Promise<string> {
  const offers = (await loadOffers()).length;
  const thousands = Math.floor(offers / 1000);
  return `${thousands.toLocaleString('nl-NL')}.000+ vakanties`;
}
