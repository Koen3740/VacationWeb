/**
 * SUB 33D: Results inventory is market-isolated.
 *
 * "Results inventory is market-isolated. A BE-only offer is not eligible for NL Results,
 * and an NL-only offer is not eligible for BE Results."
 *
 * Market signal: the TradeTracker affiliate site in the offer's own click-out
 * (`a=` on a redirect link, third part of `tt=` on a direct link), mapped to the market
 * of the access key that owns the site ({@link TRADETRACKER_AFFILIATE_SITE_MARKET}).
 * Not the provider name, not a campaign id, not the provider host TLD.
 *
 * The catalog stays whole. A request on vacationweb.be / .nl gets that market's universe
 * before matchset, pool, Page 1, S6 and live pricing. Offers with listings in both markets
 * keep only the listings of the requested market, so live pricing and the click-out use
 * that market's listing. An offer without a determinable market is not eligible on a market
 * host (fail-closed). Hosts without a market (localhost, previews) keep the full catalog.
 */
import type { ProviderListing } from '../feeds/types/stored-offer';
import { TRADETRACKER_AFFILIATE_SITE_MARKET } from '../tradetracker/promotions/constants';
import type { TravelOffer } from '../../types/travel';
import type { SiteMarket } from './site-market';

const DIGITS = /^\d+$/;
const DIRECT_LINK_TT = /^(\d+)_(\d+)_(\d+)_/;

/** Affiliate site id from a TradeTracker click-out URL, or undefined. */
export function tradeTrackerAffiliateSiteId(href: string | undefined | null): string | undefined {
  const raw = href?.trim();
  if (!raw) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return undefined;
  }
  const tt = url.searchParams.getAll('tt');
  if (tt.length === 1) {
    const match = DIRECT_LINK_TT.exec(tt[0] ?? '');
    if (match) {
      return match[3];
    }
  }
  const c = url.searchParams.getAll('c');
  const m = url.searchParams.getAll('m');
  const a = url.searchParams.getAll('a');
  if (c.length === 1 && m.length === 1 && a.length === 1 && [c[0], m[0], a[0]].every((v) => DIGITS.test(v ?? ''))) {
    return a[0];
  }
  return undefined;
}

/** Market of a click-out URL by its affiliate site. Unknown site or no TT link: undefined. */
export function clickoutSiteMarket(href: string | undefined | null): SiteMarket | undefined {
  const site = tradeTrackerAffiliateSiteId(href);
  return site ? TRADETRACKER_AFFILIATE_SITE_MARKET[site] : undefined;
}

function usableListings(offer: Pick<TravelOffer, 'providerListings'>): ProviderListing[] {
  return (offer.providerListings ?? []).filter((listing) => Boolean(listing.deepLink?.trim()));
}

/** Markets in which this offer is bookable via VacationWeb's own TT access. */
export function offerSiteMarkets(offer: Pick<TravelOffer, 'providerListings' | 'deepLink'>): SiteMarket[] {
  const listings = usableListings(offer);
  const markets = new Set<SiteMarket>();
  if (listings.length > 0) {
    for (const listing of listings) {
      const market = clickoutSiteMarket(listing.deepLink);
      if (market) markets.add(market);
    }
  } else {
    const market = clickoutSiteMarket(offer.deepLink);
    if (market) markets.add(market);
  }
  return (['be', 'nl'] as const).filter((market) => markets.has(market));
}

/**
 * The offer as seen by one market, or undefined when it is not eligible there.
 * No market: the offer unchanged. Same object when nothing has to change.
 */
export function offerForSiteMarket(offer: TravelOffer, market: SiteMarket | undefined): TravelOffer | undefined {
  if (!market) {
    return offer;
  }
  const listings = usableListings(offer);
  if (listings.length === 0) {
    return clickoutSiteMarket(offer.deepLink) === market ? offer : undefined;
  }
  const own = listings.filter((listing) => clickoutSiteMarket(listing.deepLink) === market);
  if (own.length === 0) {
    return undefined;
  }
  const boundIsOwn =
    clickoutSiteMarket(offer.deepLink) === market && own.some((listing) => listing.deepLink === offer.deepLink);
  if (boundIsOwn && own.length === (offer.providerListings ?? []).length) {
    return offer;
  }
  if (boundIsOwn) {
    return { ...offer, providerListings: own };
  }
  const bound = own[0]!;
  return {
    ...offer,
    providerListings: own,
    deepLink: bound.deepLink,
    listingHost: bound.host,
    feedSourceId: bound.feedId,
    affiliateCampaignId: bound.campaignId ?? offer.affiliateCampaignId,
  };
}

const universeCache = new WeakMap<readonly TravelOffer[], Map<SiteMarket, TravelOffer[]>>();

/**
 * The Results universe of one market. Memoized per catalog array (one runtime generation),
 * so the market copies of dual-listing offers are stable objects across requests.
 */
export function siteMarketUniverse<T extends TravelOffer>(
  offers: readonly T[],
  market: SiteMarket | undefined,
): T[] {
  if (!market) {
    return offers as T[];
  }
  let byMarket = universeCache.get(offers);
  if (!byMarket) {
    byMarket = new Map();
    universeCache.set(offers, byMarket);
  }
  const cached = byMarket.get(market);
  if (cached) {
    return cached as T[];
  }
  const universe: T[] = [];
  for (const offer of offers) {
    const scoped = offerForSiteMarket(offer, market);
    if (scoped) universe.push(scoped as T);
  }
  byMarket.set(market, universe);
  return universe;
}

/** A click-out may only leave a market request through that market's own TT site. */
export function isClickoutAllowedForSiteMarket(href: string | undefined | null, market: SiteMarket | undefined): boolean {
  if (!market || !href?.trim()) {
    return true;
  }
  const hrefMarket = clickoutSiteMarket(href);
  return hrefMarket === undefined || hrefMarket === market;
}
