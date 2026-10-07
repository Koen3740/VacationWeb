/** Official TradeTracker Affiliate Webservice (SOAP 1.2 document/literal WSI). */
export const TRADETRACKER_AFFILIATE_WSDL_URL =
  'https://ws.tradetracker.com/soap-literal-wsi/affiliate?wsdl';

export const TRADETRACKER_AFFILIATE_NAMESPACE =
  'https://ws.tradetracker.com/soap-literal-wsi/affiliate';

export const TRADETRACKER_SOURCE = 'tradetracker-affiliate-webservice' as const;

export const TRADETRACKER_CUSTOMER_ID_ENV = 'TRADETRACKER_CUSTOMER_ID';
export const TRADETRACKER_ACCESS_KEY_ENV = 'TRADETRACKER_ACCESS_KEY';
/** Belgian access key. Same customer id in practice; the key selects the land. */
export const TRADETRACKER_BE_CUSTOMER_ID_ENV = 'TRADETRACKER_BE_CUSTOMER_ID';
export const TRADETRACKER_BE_ACCESS_KEY_ENV = 'TRADETRACKER_BE_ACCESS_KEY';
export const TRADETRACKER_LOCALE_ENV = 'TRADETRACKER_LOCALE';
export const TRADETRACKER_SANDBOX_ENV = 'TRADETRACKER_SANDBOX';
export const TRADETRACKER_DEMO_ENV = 'TRADETRACKER_DEMO';
export const TRADETRACKER_AFFILIATE_SITE_ID_ENV = 'TRADETRACKER_AFFILIATE_SITE_ID';

export type TradeTrackerCredentialMarket = 'nl' | 'be';

/**
 * Affiliate sites by access key. A session from one key cannot query the other key's sites.
 *
 * NL key (`TRADETRACKER_ACCESS_KEY`):
 * - 512226 Vacationweb.nl — canonical NL creatives site
 * - 512055 MKDigitalMedia — NL-key site. Previously mislabeled as a Belgian site.
 *
 * BE key (`TRADETRACKER_BE_ACCESS_KEY`):
 * - 511873 Vacationweb.nl — canonical BE creatives site
 * - 511747 MKDigitalMedia — secondary BE site
 */
export const VACATIONWEB_NL_AFFILIATE_SITE_ID = '512226';
export const MKDIGITALMEDIA_NL_AFFILIATE_SITE_ID = '512055';
export const VACATIONWEB_BE_AFFILIATE_SITE_ID = '511873';
export const MKDIGITALMEDIA_BE_AFFILIATE_SITE_ID = '511747';

/** @deprecated Prefer VACATIONWEB_NL_AFFILIATE_SITE_ID */
export const VACATIONWEB_TRADETRACKER_AFFILIATE_SITE_ID = VACATIONWEB_NL_AFFILIATE_SITE_ID;

/**
 * Slice-1 campaign creatives. Corendon only.
 * Material ids are not hardcoded; they come from getMaterialBannerImageItems.
 */
export const TRADETRACKER_CREATIVE_CAMPAIGNS_V1: Record<
  TradeTrackerCredentialMarket,
  readonly { campaignId: string; label: string }[]
> = {
  nl: [{ campaignId: '38108', label: 'Corendon NL' }],
  be: [{ campaignId: '38103', label: 'Corendon BE' }],
};

export const TRADETRACKER_CREATIVE_CANONICAL_SITE: Record<TradeTrackerCredentialMarket, string> = {
  nl: VACATIONWEB_NL_AFFILIATE_SITE_ID,
  be: VACATIONWEB_BE_AFFILIATE_SITE_ID,
};

/** Optional. The creatives CLI fetches these only with `--include-secondary`. */
export const TRADETRACKER_CREATIVE_SECONDARY_SITE: Record<TradeTrackerCredentialMarket, string> = {
  nl: MKDIGITALMEDIA_NL_AFFILIATE_SITE_ID,
  be: MKDIGITALMEDIA_BE_AFFILIATE_SITE_ID,
};

/**
 * Every affiliate site of the account, keyed to the market of the access key that owns it
 * (SUB 33B: a key only sees its own sites). The site id in a TradeTracker click-out
 * (`a=` on a redirect link, third part of `tt=` on a direct link) is therefore the market
 * of that inventory. Used by Results market isolation (SUB 33D). Not a provider list.
 */
export const TRADETRACKER_AFFILIATE_SITE_MARKET: Readonly<Record<string, TradeTrackerCredentialMarket>> = {
  [VACATIONWEB_NL_AFFILIATE_SITE_ID]: 'nl',
  [MKDIGITALMEDIA_NL_AFFILIATE_SITE_ID]: 'nl',
  [VACATIONWEB_BE_AFFILIATE_SITE_ID]: 'be',
  [MKDIGITALMEDIA_BE_AFFILIATE_SITE_ID]: 'be',
};

/** WSDL Locale enumeration; override with TRADETRACKER_LOCALE. */
export const TRADETRACKER_DEFAULT_LOCALE = 'nl_BE';

/**
 * Campaign-news types that are clearly consumer-facing promotions.
 * Ops/affiliate updates (start/stop/feed/general/commission/…) are excluded.
 */
export const DISPLAYABLE_CAMPAIGN_NEWS_TYPES = [
  'campaign_update_consumer',
  'campaign_update_vouchercode',
  'campaign_update_incentive',
] as const;

export const TRADETRACKER_MATERIAL_OUTPUT_TYPE = 'html' as const;

export const KNOWN_CAMPAIGN_NEWS_TYPES = [
  'campaign_start',
  'campaign_stop',
  'campaign_update_general',
  'campaign_update_vouchercode',
  'campaign_update_consumer',
  'campaign_update_commission',
  'campaign_update_incentive',
  'campaign_update_material',
  'campaign_update_feed',
  'campaign_update_urgent',
  'campaign_update_attribution',
] as const;

export type CampaignNewsType = (typeof KNOWN_CAMPAIGN_NEWS_TYPES)[number] | string;
