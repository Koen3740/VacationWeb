import type { EditorialOffer, MarketClickout } from './editorial-offers';
import type { VacationWebPromotionMarket } from './select-displayable';
import { sortOffersNewestFirst } from './sort-offers';

/**
 * Cross-market dedupe for `/aanbiedingen`.
 *
 * Business rule (SUB 33C): VacationWeb publiceert campagnes waarvoor het
 * daadwerkelijk toegang heeft per TradeTracker-markt. BE en NL worden
 * afzonderlijk verzameld. Alleen wanneer dezelfde campagne in beide markten
 * exact dezelfde klantgerichte inhoud heeft, wordt zij cross-market
 * gededupliceerd. Verschillen in bedrag, promotietekst of relevante
 * voorwaarden betekenen afzonderlijke aanbiedingen.
 *
 * Input: offers that were already collected per market, each from that market's
 * own access key, own accepted campaigns and own selected snapshot.
 * Nothing here derives an offer for one market from the other market.
 *
 * Campaign identity across markets: TradeTracker campaign IDs are
 * market-specific (Corendon NL 38108 vs Corendon.be 38103), so an ID is never
 * compared across markets. Two offers are the same campaign only when
 * - they come from different markets,
 * - each comes from a TradeTracker campaign (campaign ID present) that is
 *   accepted for its own market,
 * - the advertiser (VacationWeb provider mapped from campaign name and URL) is equal, and
 * - every customer-facing field in CROSS_MARKET_COMPARISON_FIELDS is exactly equal.
 * A campaign name or a provider name alone never merges anything.
 *
 * A merged offer keeps one clickout per market. Each clickout is the stored
 * TradeTracker click template of that market's own campaign and site.
 * The merged offer never carries one market's clickout for the other market.
 */

export const CROSS_MARKET_ORDER: readonly VacationWebPromotionMarket[] = ['be', 'nl'];

/**
 * Exact comparison. Only whitespace runs are collapsed and Unicode is NFC-normalised.
 * Case, punctuation, currency signs, digits and wording must match.
 */
export const CROSS_MARKET_COMPARISON_FIELDS = [
  'providerName',
  'title',
  'benefitLead',
  'benefitAmount',
  'benefitTail',
  'summary',
  'conditions',
  'discountText',
  'validFrom',
  'validTo',
  'creative',
] as const;

export type CrossMarketComparisonField = (typeof CROSS_MARKET_COMPARISON_FIELDS)[number];

export type CrossMarketOffer = EditorialOffer & {
  markets: VacationWebPromotionMarket[];
  clickouts: MarketClickout[];
  /** The offer exactly as each market collected it. */
  byMarket: Partial<Record<VacationWebPromotionMarket, EditorialOffer>>;
};

export type MarketOffers = {
  market: VacationWebPromotionMarket;
  offers: readonly EditorialOffer[];
};

function exact(value: string | null | undefined): string {
  return (value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** Creative part of the comparison: the stored image bytes hash, or no image on both sides. */
function creativeIdentity(offer: EditorialOffer): string | null {
  if (!offer.imageUrl) {
    return 'none';
  }
  const hash = offer.imageContentHash?.trim();
  return hash ? `sha256:${hash}` : null;
}

function fieldValue(offer: EditorialOffer, field: CrossMarketComparisonField): string | null {
  switch (field) {
    case 'creative':
      return creativeIdentity(offer);
    case 'discountText':
      return exact(offer.discountText);
    case 'validTo':
      return exact(offer.validTo);
    default:
      return exact(offer[field]);
  }
}

/**
 * Comparison key over every customer-facing field, or null when the offer cannot be
 * compared (no campaign behind it, or an image whose bytes hash is unknown).
 */
export function crossMarketContentKey(offer: EditorialOffer): string | null {
  if (!offer.campaignId?.trim()) {
    return null;
  }
  const values: string[] = [];
  for (const field of CROSS_MARKET_COMPARISON_FIELDS) {
    const value = fieldValue(offer, field);
    if (value === null) {
      return null;
    }
    values.push(value);
  }
  return JSON.stringify(values);
}

/** Fields that differ between two offers. Empty means exactly equal. */
export function crossMarketDifferences(a: EditorialOffer, b: EditorialOffer): CrossMarketComparisonField[] {
  return CROSS_MARKET_COMPARISON_FIELDS.filter((field) => fieldValue(a, field) !== fieldValue(b, field));
}

function clickoutOf(offer: EditorialOffer): MarketClickout | null {
  const url = offer.clickUrl?.trim();
  return url ? { market: offer.market, url } : null;
}

function single(offer: EditorialOffer): CrossMarketOffer | null {
  const clickout = clickoutOf(offer);
  if (!clickout) {
    return null;
  }
  return {
    ...offer,
    markets: [offer.market],
    clickouts: [clickout],
    byMarket: { [offer.market]: offer },
  };
}

function merged(be: EditorialOffer, nl: EditorialOffer): CrossMarketOffer | null {
  const beClick = clickoutOf(be);
  const nlClick = clickoutOf(nl);
  if (!beClick || !nlClick || beClick.market !== 'be' || nlClick.market !== 'nl') {
    return null;
  }
  return {
    ...be,
    id: `be+nl:${be.id}|${nl.id}`,
    // Dates are equal by the comparison; take the later ingest time for ordering.
    ingestedAt: [be.ingestedAt, nl.ingestedAt].filter(Boolean).sort().at(-1) ?? null,
    // No single clickout on a merged offer. Use `clickouts` or a market view.
    clickUrl: '',
    conditionsUrl: '',
    campaignId: null,
    campaignName: null,
    affiliateSiteId: null,
    markets: ['be', 'nl'],
    clickouts: [beClick, nlClick],
    byMarket: { be, nl },
  };
}

/**
 * Merge offers that BE and NL each collected, when and only when they are exactly equal.
 * Pairing is one-to-one and deterministic (input order). Offers of one market are
 * never merged with each other. Different amounts, texts, conditions, periods or
 * creatives stay separate offers.
 */
export function dedupeCrossMarketOffers(sections: readonly MarketOffers[]): CrossMarketOffer[] {
  const byMarket = new Map<VacationWebPromotionMarket, EditorialOffer[]>();
  for (const section of sections) {
    const list = byMarket.get(section.market) ?? [];
    for (const offer of section.offers) {
      // A section only carries offers of its own market.
      if (offer.market === section.market) {
        list.push(offer);
      }
    }
    byMarket.set(section.market, list);
  }

  const be = byMarket.get('be') ?? [];
  const nl = byMarket.get('nl') ?? [];
  const pairedNl = new Set<number>();
  const out: CrossMarketOffer[] = [];

  for (const beOffer of be) {
    const key = crossMarketContentKey(beOffer);
    let pairIndex = -1;
    if (key !== null) {
      pairIndex = nl.findIndex((nlOffer, index) => !pairedNl.has(index) && crossMarketContentKey(nlOffer) === key);
    }
    if (pairIndex >= 0) {
      const combined = merged(beOffer, nl[pairIndex]!);
      if (combined) {
        pairedNl.add(pairIndex);
        out.push(combined);
        continue;
      }
    }
    const alone = single(beOffer);
    if (alone) {
      out.push(alone);
    }
  }
  nl.forEach((nlOffer, index) => {
    if (pairedNl.has(index)) {
      return;
    }
    const alone = single(nlOffer);
    if (alone) {
      out.push(alone);
    }
  });

  return sortOffersNewestFirst(out);
}

/**
 * The offers one site shows: every offer that carries this market, as that market
 * collected it, with only that market's clickout. A BE+NL offer appears once.
 */
export function offersForSiteMarket(
  offers: readonly CrossMarketOffer[],
  market: VacationWebPromotionMarket,
): CrossMarketOffer[] {
  const out: CrossMarketOffer[] = [];
  for (const offer of offers) {
    const own = offer.byMarket[market];
    const clickout = offer.clickouts.find((item) => item.market === market);
    if (!own || !clickout || !offer.markets.includes(market)) {
      continue;
    }
    out.push({
      ...own,
      clickUrl: clickout.url,
      markets: [...offer.markets],
      clickouts: [clickout],
      byMarket: { [market]: own },
    });
  }
  return sortOffersNewestFirst(out);
}

export type CrossMarketSection = {
  key: string;
  market: VacationWebPromotionMarket;
  markets: VacationWebPromotionMarket[];
  offers: CrossMarketOffer[];
  error: boolean;
};

/**
 * Page sections. A BE or NL host gets one section with that market's view.
 * A host that shows both markets gets BE-only, NL-only and one shared BE+NL section.
 */
export function crossMarketSections(
  offers: readonly CrossMarketOffer[],
  markets: readonly VacationWebPromotionMarket[],
): CrossMarketSection[] {
  if (markets.length === 1) {
    const market = markets[0]!;
    return [{ key: market, market, markets: [market], offers: offersForSiteMarket(offers, market), error: false }];
  }
  const sections: CrossMarketSection[] = markets.map((market) => ({
    key: market,
    market,
    markets: [market],
    offers: offers.filter((offer) => offer.markets.length === 1 && offer.markets[0] === market),
    error: false,
  }));
  const shared = offers.filter((offer) => markets.every((market) => offer.markets.includes(market)) && offer.markets.length > 1);
  sections.push({
    key: CROSS_MARKET_ORDER.join('-'),
    market: markets[0]!,
    markets: [...CROSS_MARKET_ORDER],
    offers: shared,
    error: false,
  });
  return sections;
}
