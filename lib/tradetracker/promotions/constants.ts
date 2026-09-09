/** Official TradeTracker Affiliate Webservice (SOAP 1.2 document/literal WSI). */
export const TRADETRACKER_AFFILIATE_WSDL_URL =
  'https://ws.tradetracker.com/soap-literal-wsi/affiliate?wsdl';

export const TRADETRACKER_AFFILIATE_NAMESPACE =
  'https://ws.tradetracker.com/soap-literal-wsi/affiliate';

export const TRADETRACKER_SOURCE = 'tradetracker-affiliate-webservice' as const;

export const TRADETRACKER_CUSTOMER_ID_ENV = 'TRADETRACKER_CUSTOMER_ID';
export const TRADETRACKER_ACCESS_KEY_ENV = 'TRADETRACKER_ACCESS_KEY';
export const TRADETRACKER_LOCALE_ENV = 'TRADETRACKER_LOCALE';
export const TRADETRACKER_SANDBOX_ENV = 'TRADETRACKER_SANDBOX';
export const TRADETRACKER_DEMO_ENV = 'TRADETRACKER_DEMO';
export const TRADETRACKER_AFFILIATE_SITE_ID_ENV = 'TRADETRACKER_AFFILIATE_SITE_ID';

/** WSDL Locale enumeration; override with TRADETRACKER_LOCALE. */
export const TRADETRACKER_DEFAULT_LOCALE = 'nl_BE';

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
