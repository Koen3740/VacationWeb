import type { FetchLike } from '@/lib/providers/prijsvrij/auth';
import { priceLiveRequiredMatchset } from '@/lib/providers/prijsvrij';
import {
  CORENDON_PROVIDER_NAME,
  ELIZA_PROVIDER_NAME,
  hasValidPresentablePrice,
  PRIJSVRIJ_PROVIDER_NAME,
  SUNWEB_PROVIDER_NAME,
} from '@/lib/search/presentable-price';
import { applyResultsLivePriceOverlay } from '@/lib/search/results-live-price-cache';
import type { SearchParams, TravelOffer } from '@/types/travel';
import { isSunwebFourTravellerTwoRoomSearch } from '@/lib/providers/sunweb';

function withCatalogPriceHidden(offer: TravelOffer): TravelOffer {
  return {
    ...offer,
    livePriceStatus: 'unavailable',
    livePriceSource: undefined,
  };
}

/**
 * Detail uses the same live overlay as Results for Corendon / Eliza /
 * Sunweb 4 travellers / 2 rooms. Prijsvrij Receipt is PARKED: reuse a proven
 * cache hit only; never call Receipt; never present feed € as live.
 */
export async function priceOfferForDetail(
  offer: TravelOffer,
  params: SearchParams,
  options: { fetchImpl?: FetchLike } = {},
): Promise<TravelOffer> {
  if (offer.provider === PRIJSVRIJ_PROVIDER_NAME) {
    const overlaid = applyResultsLivePriceOverlay(offer, params);
    if (hasValidPresentablePrice(overlaid)) {
      return overlaid;
    }
    return withCatalogPriceHidden(offer);
  }

  if (offer.provider === CORENDON_PROVIDER_NAME || offer.provider === ELIZA_PROVIDER_NAME) {
    const [priced] = await priceLiveRequiredMatchset([offer], params, {
      fetchImpl: options.fetchImpl,
    });
    return priced;
  }

  if (offer.provider === SUNWEB_PROVIDER_NAME && isSunwebFourTravellerTwoRoomSearch(params)) {
    const [priced] = await priceLiveRequiredMatchset([offer], params, {
      fetchImpl: options.fetchImpl,
    });
    return priced;
  }

  return applyResultsLivePriceOverlay(offer, params);
}
