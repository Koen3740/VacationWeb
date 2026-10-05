/**
 * The two Corendon homepage actions, per market.
 *
 * Amounts follow the Corendon homepage actions the owner recorded.
 * The CTA is the campaign tracking URL (`m=0`) plus the encoded landing
 * the public homepage banner already points at. It is assembled and then
 * checked by `promotionClickHref`. No request to `/c` is made here.
 * No CorendonResources file is used as imagery. A TradeTracker creative
 * for these two actions is not in the banner set, so the page is set in type.
 * Kaching and materials 2499691–2499700 are not here.
 */

import type { EditorialOffer } from './editorial-offers';
import { corendonActionClickHref } from './promotion-click';
import type { VacationWebPromotionMarket } from './select-displayable';

function action(offer: Omit<EditorialOffer, 'clickUrl' | 'conditionsUrl' | 'imageUrl'> & { landingUrl: string }): EditorialOffer | null {
  const clickUrl = corendonActionClickHref(offer.market, offer.landingUrl);
  if (!clickUrl) {
    return null;
  }
  return {
    ...offer,
    imageUrl: '',
    clickUrl,
    conditionsUrl: '',
  };
}

export function corendonHomepageActions(market: VacationWebPromotionMarket): EditorialOffer[] {
  const winterLanding = market === 'be' ? 'https://www.corendon.be/winterzon' : 'https://www.corendon.nl/winterzon';
  const lastMinuteLanding = market === 'be' ? 'https://www.corendon.be/topdeals' : 'https://www.corendon.nl/topdeals';
  const winterSummary =
    market === 'be'
      ? 'Tot €600 extra korting per boeking naar populaire winterzonbestemmingen zoals Curaçao, Bonaire, Kaapverdië, Gambia, Turkije, Spanje en Egypte.'
      : 'Tot € 600 extra korting per boeking naar populaire winterzonbestemmingen zoals Egypte en de Canarische Eilanden.';
  const offers = [
    action({
      id: `${market}:corendon:warme-winter-weken`,
      market,
      providerName: 'Corendon',
      placement: 'hero',
      title: 'Warme Winter Weken',
      benefitLead: 'tot',
      benefitAmount: '€600',
      benefitTail: 'extra korting',
      summary: winterSummary,
      conditions: '',
      imageAlt: '',
      landingUrl: winterLanding,
      sources: [{ label: 'Corendon winterzon', url: winterLanding }],
    }),
    action({
      id: `${market}:corendon:last-minutes`,
      market,
      providerName: 'Corendon',
      placement: 'supporting',
      title: 'Last minutes',
      benefitLead: 'tot',
      benefitAmount: '€200',
      benefitTail: 'extra korting',
      summary: 'Last minute naar de zon in oktober of november, met tot € 200 korting.',
      conditions: '',
      imageAlt: '',
      landingUrl: lastMinuteLanding,
      sources: [{ label: 'Corendon topdeals', url: lastMinuteLanding }],
    }),
  ];
  return offers.filter((offer): offer is EditorialOffer => offer !== null);
}
