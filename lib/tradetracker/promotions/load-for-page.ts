import { unstable_cache } from 'next/cache';
import {
  MKDIGITALMEDIA_NL_AFFILIATE_SITE_ID,
  VACATIONWEB_NL_AFFILIATE_SITE_ID,
} from './constants';
import { ingestTradeTrackerPromotions } from './ingest';
import {
  selectDisplayablePromotions,
  type DisplayablePromotion,
  type VacationWebPromotionMarket,
} from './select-displayable';
import type { TradeTrackerPromotionSnapshot } from './types';

export type LoadedMarketPromotions = {
  market: VacationWebPromotionMarket;
  affiliateSiteId: string;
  promotions: DisplayablePromotion[];
  ingestedAt: string | null;
  error: string | null;
};

const REVALIDATE_SECONDS = 15 * 60;

async function ingestSite(affiliateSiteId: string): Promise<TradeTrackerPromotionSnapshot> {
  return ingestTradeTrackerPromotions({ affiliateSiteId });
}

const cachedIngestSite = unstable_cache(
  async (affiliateSiteId: string) => ingestSite(affiliateSiteId),
  ['tradetracker-promotions-site'],
  { revalidate: REVALIDATE_SECONDS },
);

export function affiliateSiteIdForMarket(market: VacationWebPromotionMarket): string {
  // This loader still authenticates with the NL access key.
  // Site 512055 is MKDigitalMedia on that NL key, not a Belgian TradeTracker site.
  // Belgian banner creatives use site 511873 via the creatives snapshot ingest.
  return market === 'be' ? MKDIGITALMEDIA_NL_AFFILIATE_SITE_ID : VACATIONWEB_NL_AFFILIATE_SITE_ID;
}

export async function loadDisplayablePromotionsForMarket(
  market: VacationWebPromotionMarket,
  options: { bypassCache?: boolean } = {},
): Promise<LoadedMarketPromotions> {
  const affiliateSiteId = affiliateSiteIdForMarket(market);
  try {
    const snapshot = options.bypassCache
      ? await ingestSite(affiliateSiteId)
      : await cachedIngestSite(affiliateSiteId);
    return {
      market,
      affiliateSiteId,
      promotions: selectDisplayablePromotions(snapshot, market),
      ingestedAt: snapshot.ingestedAt,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'TradeTracker promotions kon niet worden geladen';
    return {
      market,
      affiliateSiteId,
      promotions: [],
      ingestedAt: null,
      error: message,
    };
  }
}

export async function loadDisplayablePromotionsByMarkets(
  markets: VacationWebPromotionMarket[],
  options: { bypassCache?: boolean } = {},
): Promise<LoadedMarketPromotions[]> {
  return Promise.all(markets.map((market) => loadDisplayablePromotionsForMarket(market, options)));
}
