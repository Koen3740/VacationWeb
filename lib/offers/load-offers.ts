import offers from '@/data/phase1a-proof/offers.json';
import { normalizeOffer } from '@/lib/feeds/canonical/normalize-offer';
import { TravelOffer } from '@/types/travel';

export function loadOffers(): TravelOffer[] {
  return offers.map(normalizeOffer);
}
