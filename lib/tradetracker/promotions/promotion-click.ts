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
 * redirects to the campaign landing. Empty `u` means the campaign default,
 * not a VacationWeb deeplink. This module does not request the URL.
 *
 * Two TradeTracker click formats come out of getMaterialBannerImageItems:
 * - redirect: `https://referral.<advertiser>/c?c=<campaign>&m=<material>&a=<site>&r=&u=`
 *   (Corendon NL/BE/.com)
 * - direct link: `https://<advertiser host>/<path>?tt=<campaign>_<material>_<site>_<reference>&r=`
 *   (Sunweb BE, Eliza was here BE)
 *
 * Market: the site in the click must be that market's canonical site
 * (BE 511873, NL 512226) and the campaign is that market's own campaign.
 * A BE click is never used for NL and an NL click is never used for BE.
 *
 * One live check is enough for the current BE set. Material `2499693`
 * (Banner3-lastminute, 300×250) uses the same host, campaign `38103`, site
 * `511873`, and empty `r`/`u` as the other eight lastminute creatives.
 */
export const RECOMMENDED_LIVE_CLICK_MATERIAL_ID = '2499693';

const ALLOWED_KEYS = new Set(['c', 'm', 'a', 'r', 'u']);
const DIRECT_LINK_KEYS = new Set(['tt', 'r']);
const PII_VALUE = /@|gebdatum|geboorte|dateofbirth|\bdob\b|travell?er|passenger|passport/i;

export type PromotionClickSource = {
  market: TradeTrackerCredentialMarket;
  campaignId: string;
  affiliateSiteId: string;
  materialItemId: string;
  trackingClickUrlTemplate: string | null;
  /** TradeTracker campaign URL of this market's campaign. Selects the advertiser host. */
  campaignUrl?: string | null;
};

function legacyHost(market: TradeTrackerCredentialMarket): string {
  return market === 'be' ? 'referral.corendon.be' : 'referral.corendon.nl';
}

function campaignHost(campaignUrl: string | null | undefined): string | null {
  if (!campaignUrl) {
    return null;
  }
  try {
    const url = new URL(campaignUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return null;
    }
    const host = url.hostname.toLowerCase();
    if (!host || host.endsWith('tradetracker.net') || host.endsWith('tradetracker.com')) {
      return null;
    }
    // A tracking URL stored as campaign URL is not a merchant landing.
    if (url.pathname === '/c' || url.pathname === '/i' || url.pathname.endsWith('/i')) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}

/**
 * Redirect host: the proven Corendon host of this market, or `referral.<campaign domain>`
 * of this market's own campaign. Campaign, material, and site are still checked below.
 */
function redirectHostAllowed(host: string, creative: PromotionClickSource): boolean {
  if (host === legacyHost(creative.market)) {
    return true;
  }
  const merchant = campaignHost(creative.campaignUrl);
  if (!merchant) {
    return false;
  }
  const domain = merchant.replace(/^www\./, '');
  return host === `referral.${domain}`;
}

function countKey(keys: readonly string[], name: string): number {
  return keys.filter((key) => key === name).length;
}

function hasPii(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    if (PII_VALUE.test(url.searchParams.get(key) ?? '')) {
      return true;
    }
  }
  return false;
}

function directLinkHref(url: URL, raw: string, creative: PromotionClickSource): string | null {
  const merchant = campaignHost(creative.campaignUrl);
  if (!merchant || url.hostname.toLowerCase() !== merchant) {
    return null;
  }
  const keys = [...url.searchParams.keys()];
  if (keys.some((key) => !DIRECT_LINK_KEYS.has(key)) || countKey(keys, 'tt') !== 1 || countKey(keys, 'r') > 1) {
    return null;
  }
  const match = /^(\d+)_(\d+)_(\d+)_(.*)$/.exec(url.searchParams.get('tt') ?? '');
  if (!match) {
    return null;
  }
  if (match[1] !== creative.campaignId || match[2] !== creative.materialItemId || match[3] !== creative.affiliateSiteId) {
    return null;
  }
  if (PII_VALUE.test(match[4] ?? '') || hasPii(url)) {
    return null;
  }
  return raw;
}

/**
 * Return the stored click template when it belongs to this creative and market.
 * The string is not rebuilt and no query parameter is added.
 * A missing or mismatched template returns null.
 */
export function promotionClickHref(creative: PromotionClickSource): string | null {
  const raw = creative.trackingClickUrlTemplate?.trim() ?? '';
  if (!raw) {
    return null;
  }
  if (creative.affiliateSiteId !== TRADETRACKER_CREATIVE_CANONICAL_SITE[creative.market]) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    return null;
  }
  if (url.hostname === 'ti.tradetracker.net' || url.pathname === '/i' || url.pathname.endsWith('/i')) {
    return null;
  }
  if (url.pathname !== '/c') {
    return directLinkHref(url, raw, creative);
  }
  if (!redirectHostAllowed(url.hostname.toLowerCase(), creative)) {
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
  if (hasPii(url)) {
    return null;
  }
  return raw;
}

/**
 * Campaign deeplink for a Corendon homepage action.
 *
 * Shape comes from the feed campaign `trackingURL`:
 * `/c?c=<campaign>&m=0&a=<site>&r=&u=` plus `encodeURIComponent(landing)`.
 * Landings are the pages the public homepage banners already link to.
 * This function does not request `/c`. The string still has to pass
 * `promotionClickHref`.
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
  const template = `https://${legacyHost(market)}/c?c=${campaignId}&m=0&a=${affiliateSiteId}&r=&u=${encodeURIComponent(landingUrl)}`;
  return promotionClickHref({
    market,
    campaignId,
    affiliateSiteId,
    materialItemId: '0',
    trackingClickUrlTemplate: template,
  });
}
