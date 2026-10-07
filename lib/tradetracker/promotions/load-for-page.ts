import { unstable_cache } from 'next/cache';
import { VACATIONWEB_PROMOTION_AFFILIATE_SITES } from './constants';
import { ingestTradeTrackerPromotions } from './ingest';
import {
  dedupeDisplayablePromotions,
  selectDisplayablePromotions,
  type DisplayablePromotion,
} from './select-displayable';
import type { TradeTrackerPromotionSnapshot } from './types';

export type LoadedAffiliatePromotions = {
  market: string;
  affiliateSiteId: string;
  promotions: DisplayablePromotion[];
  ingestedAt: string | null;
  error: string | null;
};

export type LoadedPromotions = {
  promotions: DisplayablePromotion[];
  /** An error is surfaced only when no affiliate context could be loaded. */
  error: string | null;
};

const REVALIDATE_SECONDS = 15 * 60;

async function ingestSite(affiliateSiteId: string): Promise<TradeTrackerPromotionSnapshot> {
  return ingestTradeTrackerPromotions({ affiliateSiteId });
}

async function displayableForSite(affiliateSiteId: string) {
  const snapshot = await ingestSite(affiliateSiteId);
  return {
    promotions: selectDisplayablePromotions(snapshot, affiliateSiteId),
    ingestedAt: snapshot.ingestedAt,
  };
}

/**
 * Cache the small displayable result, not the raw snapshot. A full snapshot is ~3.4 MB
 * (1,472 campaigns per site, measured 2026-10-04), above the 2 MB Next.js data-cache item
 * limit, so it was never cached and every page view re-ran the live SOAP ingest (3.6-4.8 s).
 */
const cachedDisplayableForSite = unstable_cache(
  async (affiliateSiteId: string) => displayableForSite(affiliateSiteId),
  ['tradetracker-promotions-displayable-site'],
  { revalidate: REVALIDATE_SECONDS },
);

export async function loadDisplayablePromotionsForAffiliateSite(
  site: (typeof VACATIONWEB_PROMOTION_AFFILIATE_SITES)[number],
  options: { bypassCache?: boolean } = {},
): Promise<LoadedAffiliatePromotions> {
  const { affiliateSiteId, market } = site;
  try {
    const result = options.bypassCache
      ? await displayableForSite(affiliateSiteId)
      : await cachedDisplayableForSite(affiliateSiteId);
    return {
      market,
      affiliateSiteId,
      promotions: result.promotions,
      ingestedAt: result.ingestedAt,
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

/** Affiliate sites are click-out contexts, not UI sections. */
export async function loadDisplayablePromotions(
  options: { bypassCache?: boolean } = {},
): Promise<LoadedPromotions> {
  const loaded = await Promise.all(
    VACATIONWEB_PROMOTION_AFFILIATE_SITES.map((site) =>
      loadDisplayablePromotionsForAffiliateSite(site, options),
    ),
  );
  const successful = loaded.filter((result) => result.error === null);
  return {
    promotions: dedupeDisplayablePromotions(successful.flatMap((result) => result.promotions)),
    error:
      successful.length > 0
        ? null
        : loaded.find((result) => result.error)?.error ?? 'TradeTracker promotions kon niet worden geladen',
  };
}
