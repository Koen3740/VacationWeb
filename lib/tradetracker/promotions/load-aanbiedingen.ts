import { composeAanbiedingenCards, type AanbiedingenCard } from './compose-aanbiedingen';
import { loadCreativeImageIndex } from './creative-images';
import {
  loadSelectedCreativesForMarket,
  type LoadedSelectedCreatives,
} from './load-selected-creatives';
import {
  loadDisplayablePromotionsForMarket,
  type LoadedMarketPromotions,
} from './load-for-page';
import type { VacationWebPromotionMarket } from './select-displayable';

/**
 * Market page data for `/aanbiedingen`.
 * Primary creative snapshots win. Secondary SOAP promotions follow and cannot
 * overwrite a creative or repeat its material id. Markets are loaded apart.
 */

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
    /** Test hook. Production uses the news/incentive SOAP loader. */
    loadSecondary?: (market: VacationWebPromotionMarket) => Promise<LoadedMarketPromotions>;
    /** Test hook. Production reads the isolated object-storage documents. */
    readRemote?: (key: string) => Promise<string | null>;
  } = {},
): Promise<LoadedAanbiedingenSection> {
  const loadPrimary =
    options.loadPrimary ??
    ((nextMarket: VacationWebPromotionMarket) =>
      loadSelectedCreativesForMarket(nextMarket, { root: options.root, readRemote: options.readRemote }));
  const loadSecondary =
    options.loadSecondary ??
    ((nextMarket: VacationWebPromotionMarket) =>
      loadDisplayablePromotionsForMarket(nextMarket, { bypassCache: options.bypassCache }));
  const [primary, secondary] = await Promise.all([loadPrimary(market), loadSecondary(market)]);
  const cards = composeAanbiedingenCards({
    market,
    creatives: primary.creatives,
    secondary: secondary.promotions,
    images: await loadCreativeImageIndex(options.root, { readRemote: options.readRemote }),
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
