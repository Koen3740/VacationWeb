import { mergeCorendonOffers } from './corendon-merge';
import { mergeSunwebOffers } from './sunweb-merge';
import { CORENDON_PROVIDER_NAME } from '../../providers/corendon/constants';
import { SUNWEB_PROVIDER_NAME } from '../../providers/sunweb/constants';
import type { StoredOffer } from '../types/stored-offer';

/**
 * Last merge before compact runtime publish. Same bookable Sunweb/Corendon
 * context stays one StoredOffer with listings retained. Other providers pass through.
 */
export function mergeEnabledProviderCatalog(offers: StoredOffer[]): StoredOffer[] {
  const corendon: StoredOffer[] = [];
  const sunweb: StoredOffer[] = [];
  const others: StoredOffer[] = [];

  for (const offer of offers) {
    if (offer.provider === CORENDON_PROVIDER_NAME) {
      corendon.push(offer);
      continue;
    }
    if (offer.provider === SUNWEB_PROVIDER_NAME) {
      sunweb.push(offer);
      continue;
    }
    others.push(offer);
  }

  return [
    ...mergeCorendonOffers(corendon).offers,
    ...mergeSunwebOffers(sunweb).offers,
    ...others,
  ];
}
