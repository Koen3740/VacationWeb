import offers from '@/data/phase1a-proof/offers.json';
import { normalizeOffer } from '@/lib/feeds/canonical/normalize-offer';
import { StoredOffer } from '@/lib/feeds/types/stored-offer';
import { TravelOffer } from '@/types/travel';

export function loadOffers(): TravelOffer[] {
  return (offers as StoredOffer[]).map(normalizeOffer);
}
