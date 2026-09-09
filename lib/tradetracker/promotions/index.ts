export {
  TRADETRACKER_AFFILIATE_WSDL_URL,
  TRADETRACKER_SOURCE,
  VACATIONWEB_BE_AFFILIATE_SITE_ID,
  VACATIONWEB_NL_AFFILIATE_SITE_ID,
  VACATIONWEB_TRADETRACKER_AFFILIATE_SITE_ID,
} from './constants';
export {
  getConnectedTradeTrackerCampaignIds,
  getConnectedTravelProviderNames,
  resolveConnectedProvider,
} from './connected-providers';
export { getTradeTrackerSoapCredentials, resolveAffiliateSiteIdForIngest } from './credentials';
export { ingestTradeTrackerPromotions, snapshotCounts } from './ingest';
export { loadDisplayablePromotionsByMarkets, loadDisplayablePromotionsForMarket } from './load-for-page';
export { selectDisplayablePromotions } from './select-displayable';
export { promotionalValidity } from './validity';
export type {
  TradeTrackerCampaignNewsRecord,
  TradeTrackerCampaignRecord,
  TradeTrackerIncentiveRecord,
  TradeTrackerPromotionSnapshot,
} from './types';
export type { DisplayablePromotion, VacationWebPromotionMarket } from './select-displayable';
