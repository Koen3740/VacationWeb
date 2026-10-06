import { composeAanbiedingenCards, type AanbiedingenCard } from './compose-aanbiedingen';
import { loadCreativeImageIndex } from './creative-images';
import {
  loadSelectedCreativesForMarket,
  type LoadedSelectedCreatives,
} from './load-selected-creatives';
import { readCachedCreativeDocument } from './published-creative-cache';
import type { DisplayablePromotion, VacationWebPromotionMarket } from './select-displayable';

/**
 * Market page data for `/aanbiedingen`.
 * Reads the published selected snapshots and the creative image manifest only.
 * A visitor request does not call TradeTracker. Campaign news is not loaded.
 * Markets are loaded apart.
 */

type SnapshotPromotions = {
  market: VacationWebPromotionMarket;
  affiliateSiteId: string;
  promotions: DisplayablePromotion[];
  ingestedAt: string | null;
  error: string | null;
};

function emptyPromotions(market: VacationWebPromotionMarket): SnapshotPromotions {
  return {
    market,
    affiliateSiteId: market === 'be' ? '511873' : '512226',
    promotions: [],
    ingestedAt: null,
    error: null,
  };
}

export type LoadedAanbiedingenSection = {
  market: VacationWebPromotionMarket;
  /** Canonical creative site: NL 512226, BE 511873. */
  affiliateSiteId: string;
  cards: AanbiedingenCard[];
  primaryCount: number;
  secondaryCount: number;
  error: string | null;
};

export async function loadAanbiedingenForMarket(
  market: VacationWebPromotionMarket,
  options: {
    bypassCache?: boolean;
    root?: string;
    /** Test hook. Production uses the selected-creative snapshot reader. */
    loadPrimary?: (market: VacationWebPromotionMarket) => Promise<LoadedSelectedCreatives>;
    /** Test hook. Production passes an empty list; the page does not call TradeTracker. */
    loadSecondary?: (market: VacationWebPromotionMarket) => Promise<SnapshotPromotions>;
    /** Test hook. Production reads the isolated object-storage documents. */
    readRemote?: (key: string) => Promise<string | null>;
  } = {},
): Promise<LoadedAanbiedingenSection> {
  const readRemote = options.readRemote ?? readCachedCreativeDocument;
  const loadPrimary =
    options.loadPrimary ??
    ((nextMarket: VacationWebPromotionMarket) =>
      loadSelectedCreativesForMarket(nextMarket, { root: options.root, readRemote }));
  const loadSecondary = options.loadSecondary ?? (async (nextMarket: VacationWebPromotionMarket) => emptyPromotions(nextMarket));
  const [primary, secondary] = await Promise.all([loadPrimary(market), loadSecondary(market)]);
  const cards = composeAanbiedingenCards({
    market,
    creatives: primary.creatives,
    secondary: secondary.promotions,
    images: await loadCreativeImageIndex(options.root, { readRemote }),
  });
  const primaryCount = cards.filter((card) => card.source === 'creative').length;
  const secondaryCount = cards.length - primaryCount;
  const blocked = cards.length === 0 && (primary.status === 'invalid' || Boolean(secondary.error));
  return {
    market,
    affiliateSiteId: primary.affiliateSiteId,
    cards,
    primaryCount,
    secondaryCount,
    error: blocked ? 'Aanbiedingen konden nu niet worden geladen' : null,
  };
}

export async function loadAanbiedingenByMarkets(
  markets: VacationWebPromotionMarket[],
  options: {
    bypassCache?: boolean;
    root?: string;
    readRemote?: (key: string) => Promise<string | null>;
  } = {},
): Promise<LoadedAanbiedingenSection[]> {
  return Promise.all(markets.map((market) => loadAanbiedingenForMarket(market, options)));
}
