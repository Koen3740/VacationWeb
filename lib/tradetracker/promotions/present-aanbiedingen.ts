import type { AanbiedingenCard } from './compose-aanbiedingen';
import { editorialOffersFromCards, type EditorialOffer } from './editorial-offers';
import { sortOffersNewestFirst } from './sort-offers';
import type { VacationWebPromotionMarket } from './select-displayable';

/**
 * Offers for `/aanbiedingen` come only from the TradeTracker cards already
 * loaded for this market. An empty stream stays empty. Homepage actions are
 * not added here.
 */
export function presentAanbiedingenOffers(
  market: VacationWebPromotionMarket,
  cards: readonly AanbiedingenCard[],
  asOfMs = Date.now(),
): EditorialOffer[] {
  const stream = editorialOffersFromCards(cards, asOfMs).filter((offer) => offer.market === market);
  return sortOffersNewestFirst(stream);
}
