/**
 * The two Corendon homepage actions, per market.
 *
 * Amounts follow the Corendon homepage actions the owner recorded.
 * The CTA is the campaign tracking URL (`m=0`) plus the encoded landing
 * the public homepage banner already points at. It is assembled and then
 * checked by `promotionClickHref`. No request to `/c` is made here.
 * Images are the mapped 780×320 HPTO files, stored under
 * tradetracker-creatives/homepage-actions. Kaching and materials
 * 2499691–2499700 are not here.
 */

import type { EditorialOffer } from './editorial-offers';
import { corendonActionClickHref } from './promotion-click';
import type { VacationWebPromotionMarket } from './select-displayable';

const WINTER_IMAGE = '/aanbiedingen/creative-images/homepage/warme-winter-weken-780x320.png';
const LAST_MINUTE_IMAGE = '/aanbiedingen/creative-images/homepage/last-minutes-oktober-november-780x320.png';

function action(offer: Omit<EditorialOffer, 'clickUrl' | 'conditionsUrl'> & { landingUrl: string }): EditorialOffer | null {
  const clickUrl = corendonActionClickHref(offer.market, offer.landingUrl);
  if (!clickUrl) {
    return null;
  }
  return {
    ...offer,
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
      imageUrl: WINTER_IMAGE,
      imageAlt: 'Warme Winter Weken',
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
      imageUrl: LAST_MINUTE_IMAGE,
      imageAlt: 'Last minutes oktober en november',
      landingUrl: lastMinuteLanding,
      sources: [{ label: 'Corendon topdeals', url: lastMinuteLanding }],
    }),
  ];
  return offers.filter((offer): offer is EditorialOffer => offer !== null);
}
