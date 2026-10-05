import type { CampaignNewsType, TradeTrackerCredentialMarket } from './constants';

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
  /** Affiliate site used for this snapshot (VacationWeb = 512226). */
  scopedAffiliateSiteId: string;
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

/**
 * One official banner creative from getMaterialBannerImageItems.
 * Image bytes are not stored. `embedCode` is the SOAP html `code`.
 */
export type TradeTrackerBannerCreativeRecord = {
  source: typeof import('./constants').TRADETRACKER_SOURCE;
  kind: 'banner_image';
  materialItemId: string;
  name: string;
  campaignId: string | null;
  campaignName: string | null;
  campaignUrl: string | null;
  affiliateSiteId: string;
  market: TradeTrackerCredentialMarket;
  width: number | null;
  height: number | null;
  dimensionId: string | null;
  isMobile: boolean | null;
  isCommon: boolean | null;
  referenceSupported: boolean | null;
  description: string | null;
  conditions: string | null;
  validFromDate: string | null;
  validToDate: string | null;
  discountFixed: string | null;
  discountVariable: string | null;
  voucherCode: string | null;
  creationDate: string | null;
  modificationDate: string | null;
  /** Present only when the SOAP item carries a status field. MaterialItem has none in the WSDL. */
  status: string | null;
  embedCode: string | null;
  trackingClickUrlTemplate: string | null;
  impressionUrlTemplate: string | null;
  /** Non-impression image URL found in `code`, such as static.tradetracker.net. No network resolve. */
  staticImageUrlHint: string | null;
  validity: PromotionalValidity;
  fetchedAt: string;
  sourceMetadata: Record<string, unknown>;
};

export type TradeTrackerCreativeSnapshotCounts = {
  creatives: number;
  campaignsRequested: number;
  methodErrors: number;
  byCampaignId: Record<string, number>;
};

export type TradeTrackerCreativeSnapshot = {
  source: typeof import('./constants').TRADETRACKER_SOURCE;
  ingestedAt: string;
  wsdlUrl: string;
  market: TradeTrackerCredentialMarket;
  scopedAffiliateSiteId: string;
  /** Access key that authenticated this snapshot. Matches `market` for v1. */
  credentialScope: TradeTrackerCredentialMarket;
  /** Slice 1 stores SOAP metadata and html `code` only. */
  imageDelivery: 'metadata-and-embed-code';
  campaignIds: string[];
  creatives: TradeTrackerBannerCreativeRecord[];
  methodErrors: MethodIngestError[];
  counts: TradeTrackerCreativeSnapshotCounts;
};
