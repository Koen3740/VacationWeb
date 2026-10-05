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

/**
 * Providers Slice 2 may mark displayable.
 * Strings match the runtime catalog names (Corendon, Sunweb, Eliza was here).
 * `unknown` is fail-closed and never appears on a selected creative.
 */
export const CREATIVE_ALLOWED_PROVIDERS = ['Corendon', 'Sunweb', 'Eliza was here'] as const;

export type CreativeAllowedProvider = (typeof CREATIVE_ALLOWED_PROVIDERS)[number];

export type CreativeProviderMapping = CreativeAllowedProvider | 'unknown';

/** How a creative relates to other material ids. Different ids are not collapsed. */
export type CreativeMaterialRelation =
  | 'unique'
  | 'dimension_variant'
  | 'same_dimension_distinct_material';

export type CreativeExclusionReason =
  | 'unknown_market'
  | 'market_mismatch'
  | 'non_canonical_site'
  | 'unknown_campaign'
  | 'market_campaign_mismatch'
  | 'unknown_provider'
  | 'expired'
  | 'missing_title'
  | 'missing_material_id'
  | 'missing_dimensions'
  | 'missing_click_template'
  | 'missing_embed'
  | 'duplicate_material';

export type CreativeExclusion = {
  materialItemId: string | null;
  dedupeKey: string | null;
  reason: CreativeExclusionReason;
};

/**
 * Canonical creative for a later /aanbiedingen loader.
 * Metadata and URL templates only. No image bytes and no tracking requests.
 */
export type SelectedTradeTrackerCreative = {
  id: string;
  dedupeKey: string;
  provider: CreativeAllowedProvider;
  market: TradeTrackerCredentialMarket;
  campaignId: string;
  campaignName: string;
  campaignUrl: string | null;
  affiliateSiteId: string;
  materialItemId: string;
  title: string;
  creativeType: 'banner_image';
  width: number;
  height: number;
  dimensionId: string | null;
  isMobile: boolean | null;
  isCommon: boolean | null;
  relation: CreativeMaterialRelation;
  validity: PromotionalValidity;
  validFromDate: string | null;
  validToDate: string | null;
  /** Null unless TradeTracker supplied the field. Never a synthesized discount claim. */
  discountFixed: string | null;
  discountVariable: string | null;
  voucherCode: string | null;
  description: string | null;
  conditions: string | null;
  embedCode: string | null;
  staticImageUrlHint: string | null;
  trackingClickUrlTemplate: string;
  impressionUrlTemplate: string | null;
  referenceSupported: boolean | null;
  source: typeof import('./constants').TRADETRACKER_SOURCE;
  sourceSnapshot: string;
  fetchedAt: string;
  displayable: true;
};

export type CreativeSelectionDedupe = {
  /** market|affiliateSiteId|materialItemId. Same id in another market or site stays distinct. */
  key: 'market|affiliateSiteId|materialItemId';
  collapsed: number;
  relations: Record<CreativeMaterialRelation, number>;
};

export type SelectedTradeTrackerCreativeSnapshot = {
  source: typeof import('./constants').TRADETRACKER_SOURCE;
  /** Copied from the source snapshot so regeneration does not depend on the clock. */
  selectedAt: string;
  snapshotIngestedAt: string;
  wsdlUrl: string;
  market: TradeTrackerCredentialMarket;
  scopedAffiliateSiteId: string;
  sourceSnapshot: string;
  imageDelivery: 'metadata-and-embed-code';
  inputCount: number;
  selectedCount: number;
  excludedCount: number;
  providers: Record<string, number>;
  dedupe: CreativeSelectionDedupe;
  exclusions: CreativeExclusion[];
  creatives: SelectedTradeTrackerCreative[];
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
