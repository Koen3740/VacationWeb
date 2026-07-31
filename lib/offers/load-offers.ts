import offers from '@/data/offers.json';
import { normalizeOffer } from '@/lib/feeds/canonical/normalize-offer';
import { TravelOffer } from '@/types/travel';

export function loadOffers(): TravelOffer[] {
  return offers.map(normalizeOffer);
}
