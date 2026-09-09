import type { CampaignNewsType } from './constants';

export type PromotionalSourceKind =
  | 'campaign'
  | 'campaign_news'
  | 'campaign_start'
  | 'campaign_stop'
  | 'campaign_update'
  | 'consumer_promotion'
  | 'incentive_offer'
  | 'voucher';

/**
 * Calendar-date validity using TradeTracker xsd:date values as YYYY-MM-DD.
 * Comparison uses the UTC calendar date of `asOfMs` (no silent local TZ conversion).
 */
export type PromotionalValidityStatus = 'scheduled' | 'active' | 'expired' | 'undated';

export type PromotionalValidity = {
  status: PromotionalValidityStatus;
  isActive: boolean;
  asOfUtcDate: string;
  startDate: string | null;
  endDate: string | null;
  timezoneAssumption: 'utc-calendar-date';
};

export type TradeTrackerCampaignRecord = {
  source: typeof import('./constants').TRADETRACKER_SOURCE;
  kind: 'campaign';
  campaignId: string;
  campaignName: string;
  campaignUrl: string | null;
  campaignInfo: string | null;
  campaignCategoryId: string | null;
  campaignCategoryName: string | null;
  assignmentStatus: string | null;
  logoUrl: string | null;
  trackingUrl: string | null;
  campaignStartDate: string | null;
  campaignStopDate: string | null;
  campaignTimeZone: string | null;
  affiliateSiteId: string;
  affiliateSiteName: string | null;
  sourceMetadata: Record<string, unknown>;
};

export type TradeTrackerCampaignNewsRecord = {
  source: typeof import('./constants').TRADETRACKER_SOURCE;
  kind: 'campaign_news' | 'campaign_start' | 'campaign_stop' | 'campaign_update' | 'consumer_promotion';
  newsItemId: string;
  newsType: CampaignNewsType;
  title: string;
  content: string;
  publishDate: string | null;
  expirationDate: string | null;
  campaignId: string | null;
  campaignName: string | null;
  campaignUrl: string | null;
  validity: PromotionalValidity;
  sourceMetadata: Record<string, unknown>;
};

export type TradeTrackerIncentiveRecord = {
  source: typeof import('./constants').TRADETRACKER_SOURCE;
  kind: 'incentive_offer' | 'voucher';
  materialItemId: string;
  name: string;
  description: string | null;
  conditions: string | null;
  validFromDate: string | null;
  validToDate: string | null;
  discountFixed: string | null;
  discountVariable: string | null;
  voucherCode: string | null;
  campaignId: string | null;
  campaignName: string | null;
  campaignUrl: string | null;
  affiliateSiteId: string;
  affiliateSiteName: string | null;
  validity: PromotionalValidity;
  sourceMetadata: Record<string, unknown>;
};

export type TradeTrackerAffiliateSiteRecord = {
  source: typeof import('./constants').TRADETRACKER_SOURCE;
  siteId: string;
  name: string;
  url: string | null;
  sourceMetadata: Record<string, unknown>;
};

export type MethodIngestError = {
  method: string;
  message: string;
};

export type TradeTrackerPromotionSnapshot = {
  source: typeof import('./constants').TRADETRACKER_SOURCE;
  ingestedAt: string;
  wsdlUrl: string;
  affiliateSites: TradeTrackerAffiliateSiteRecord[];
  campaigns: TradeTrackerCampaignRecord[];
  newsItems: TradeTrackerCampaignNewsRecord[];
  incentiveOffers: TradeTrackerIncentiveRecord[];
  vouchers: TradeTrackerIncentiveRecord[];
  methodErrors: MethodIngestError[];
};

export type TradeTrackerSoapCredentials = {
  customerID: number;
  passphrase: string;
  sandbox: boolean;
  locale: string;
  demo: boolean;
};
