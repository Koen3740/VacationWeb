export {
  TRADETRACKER_AFFILIATE_WSDL_URL,
  TRADETRACKER_SOURCE,
  VACATIONWEB_TRADETRACKER_AFFILIATE_SITE_ID,
} from './constants';
export { getTradeTrackerSoapCredentials, resolveAffiliateSiteIdForIngest } from './credentials';
export { ingestTradeTrackerPromotions, snapshotCounts } from './ingest';
export { promotionalValidity } from './validity';
export type {
  TradeTrackerCampaignNewsRecord,
  TradeTrackerCampaignRecord,
  TradeTrackerIncentiveRecord,
  TradeTrackerPromotionSnapshot,
} from './types';
