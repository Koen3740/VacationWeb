import type { TradeTrackerCredentialMarket } from './constants';

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
