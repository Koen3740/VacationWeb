export { TRADETRACKER_AFFILIATE_WSDL_URL, TRADETRACKER_SOURCE } from './constants';
export { getTradeTrackerSoapCredentials } from './credentials';
export { ingestTradeTrackerPromotions, snapshotCounts } from './ingest';
export { promotionalValidity } from './validity';
export type {
  TradeTrackerCampaignNewsRecord,
  TradeTrackerCampaignRecord,
  TradeTrackerIncentiveRecord,
  TradeTrackerPromotionSnapshot,
} from './types';
