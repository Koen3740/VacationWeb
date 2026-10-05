import {
  TRADETRACKER_CREATIVE_CAMPAIGNS_V1,
  TRADETRACKER_CREATIVE_CANONICAL_SITE,
  type TradeTrackerCredentialMarket,
} from './constants';

/**
 * Affiliate click for a banner offer.
 *
 * Clickflow: the card renders the stored `trackingClickUrlTemplate` as a normal
 * anchor. A real user click opens that URL. TradeTracker attributes it and
 * redirects to the Corendon campaign landing. Empty `u` means the campaign
 * default, not a VacationWeb deeplink. This module does not request the URL.
 *
 * One live check is enough for the current BE set. Material `2499693`
 * (Banner3-lastminute, 300×250) uses the same host, campaign `38103`, site
 * `511873`, and empty `r`/`u` as the other eight lastminute creatives.
 */
export const RECOMMENDED_LIVE_CLICK_MATERIAL_ID = '2499693';

const ALLOWED_KEYS = new Set(['c', 'm', 'a', 'r', 'u']);
const PII_VALUE = /@|gebdatum|geboorte|dateofbirth|\bdob\b|travell?er|passenger|passport/i;

export type PromotionClickSource = {
  market: TradeTrackerCredentialMarket;
  campaignId: string;
  affiliateSiteId: string;
  materialItemId: string;
  trackingClickUrlTemplate: string | null;
};

function expectedHost(market: TradeTrackerCredentialMarket): string {
  return market === 'be' ? 'referral.corendon.be' : 'referral.corendon.nl';
}

function countKey(keys: readonly string[], name: string): number {
  return keys.filter((key) => key === name).length;
}

/**
 * Return the stored click template when it belongs to this creative.
 * The string is not rebuilt and no query parameter is added.
 * A missing or mismatched template returns null.
 */
export function promotionClickHref(creative: PromotionClickSource): string | null {
  const raw = creative.trackingClickUrlTemplate?.trim() ?? '';
  if (!raw) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/c') {
    return null;
  }
  if (url.hostname !== expectedHost(creative.market)) {
    return null;
  }
  const keys = [...url.searchParams.keys()];
  if (keys.some((key) => !ALLOWED_KEYS.has(key))) {
    return null;
  }
  if (countKey(keys, 'c') !== 1 || countKey(keys, 'm') !== 1 || countKey(keys, 'a') !== 1) {
    return null;
  }
  if (countKey(keys, 'r') > 1 || countKey(keys, 'u') > 1) {
    return null;
  }
  if (url.searchParams.get('c') !== creative.campaignId) {
    return null;
  }
  if (url.searchParams.get('m') !== creative.materialItemId) {
    return null;
  }
  if (url.searchParams.get('a') !== creative.affiliateSiteId) {
    return null;
  }
  for (const key of keys) {
    if (PII_VALUE.test(url.searchParams.get(key) ?? '')) {
      return null;
    }
  }
  return raw;
}

/**
 * Campaign deeplink for a Corendon homepage action.
 *
 * HEAD on 2026-10-05: `m=0` with the canonical site and campaign returns 302
 * to the `u` landing, with TradeTracker attribution (`utm_source=tradetracker`,
 * `utm_medium=affiliate`, `utm_content=Vacationweb.nl`). Only the four action
 * pages that the live homepage banners link to are allowed. The string still
 * has to pass `promotionClickHref`.
 */
const ACTION_LANDING: Record<TradeTrackerCredentialMarket, ReadonlySet<string>> = {
  nl: new Set(['https://www.corendon.nl/winterzon', 'https://www.corendon.nl/topdeals']),
  be: new Set(['https://www.corendon.be/winterzon', 'https://www.corendon.be/topdeals']),
};

export function corendonActionClickHref(
  market: TradeTrackerCredentialMarket,
  landingUrl: string,
): string | null {
  if (!ACTION_LANDING[market].has(landingUrl)) {
    return null;
  }
  const campaignId = TRADETRACKER_CREATIVE_CAMPAIGNS_V1[market][0]?.campaignId;
  const affiliateSiteId = TRADETRACKER_CREATIVE_CANONICAL_SITE[market];
  if (!campaignId || !affiliateSiteId) {
    return null;
  }
  const template = `https://${expectedHost(market)}/c?c=${campaignId}&m=0&a=${affiliateSiteId}&r=&u=${encodeURIComponent(landingUrl)}`;
  return promotionClickHref({
    market,
    campaignId,
    affiliateSiteId,
    materialItemId: '0',
    trackingClickUrlTemplate: template,
  });
}
