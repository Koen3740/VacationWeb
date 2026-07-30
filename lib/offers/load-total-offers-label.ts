import { loadOffers } from '@/lib/offers/load-offers';

export function loadTotalOffersLabel(): string {
  const offers = loadOffers().length;
  const thousands = Math.floor(offers / 1000);
  return `${thousands.toLocaleString('nl-NL')}.000+ vakanties`;
}
