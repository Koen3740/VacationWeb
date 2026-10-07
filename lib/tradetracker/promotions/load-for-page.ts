import { unstable_cache } from 'next/cache';
import { TRADETRACKER_CREATIVE_CANONICAL_SITE } from './constants';
import { getTradeTrackerSoapCredentials } from './credentials';
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

/**
 * Secondary source (news, incentives, vouchers). Not used by `/aanbiedingen`,
 * which reads published creative snapshots only. It must not replace creative cards.
 *
 * Each market authenticates with its own access key and queries its own canonical
 * site: NL key + 512226, BE key + 511873. BE promotions are never derived from the
 * NL key or an NL site (SUB 33C; before, BE used the NL key with NL site 512055).
 */

async function ingestSite(market: VacationWebPromotionMarket): Promise<TradeTrackerPromotionSnapshot> {
  return ingestTradeTrackerPromotions({
    affiliateSiteId: affiliateSiteIdForMarket(market),
    credentials: getTradeTrackerSoapCredentials({ market }),
  });
}

const cachedIngestSite = unstable_cache(
  async (market: VacationWebPromotionMarket) => ingestSite(market),
  ['tradetracker-promotions-market-site'],
  { revalidate: REVALIDATE_SECONDS },
);

export function affiliateSiteIdForMarket(market: VacationWebPromotionMarket): string {
  return TRADETRACKER_CREATIVE_CANONICAL_SITE[market];
}

export async function loadDisplayablePromotionsForMarket(
  market: VacationWebPromotionMarket,
  options: { bypassCache?: boolean } = {},
): Promise<LoadedMarketPromotions> {
  const affiliateSiteId = affiliateSiteIdForMarket(market);
  try {
    const snapshot = options.bypassCache ? await ingestSite(market) : await cachedIngestSite(market);
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
