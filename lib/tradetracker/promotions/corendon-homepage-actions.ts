/**
 * The two Corendon homepage actions, per market.
 *
 * Copy is the sentence on the public action page that the live homepage
 * banner links to (fetched 2026-10-05). Images are the homepage HPTO files
 * stored under tradetracker-creatives/homepage-actions. The click is the
 * campaign deeplink that HEAD proved lands on that page with VacationWeb
 * attribution. Kaching and the generic last-minute materials are not here.
 */

import type { EditorialOffer } from './editorial-offers';
import { corendonActionClickHref } from './promotion-click';
import type { VacationWebPromotionMarket } from './select-displayable';

const WINTER_IMAGE = '/aanbiedingen/creative-images/homepage/warme-winter-weken-1168x500.jpg';
const LAST_MINUTE_IMAGE = '/aanbiedingen/creative-images/homepage/last-minutes-oktober-november-1168x500.jpg';

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
