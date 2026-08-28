import { selectPage1Candidates } from '@/lib/providers/prijsvrij';
import { affiliateHref } from '@/lib/offers/offer-detail-view';
import { filterOffers, sortOffers } from '@/lib/search/filtering';
import {
  buildOfferDetailHref,
  buildResultsPageHref,
  limitRankedResultsForPagination,
  paginateResults,
  RESULTS_PAGE_SIZE_DEFAULT,
  RESULTS_USER_PAGINATION_CAP,
} from '@/lib/search/pagination';
import { parseSearchParams } from '@/lib/search/parse-search-params';
import { hasValidPresentablePrice } from '@/lib/search/presentable-price';
import type { SearchParams, TravelOffer } from '@/types/travel';

export const WP7_ACTIVE_PROVIDERS = ['Corendon', 'Sunweb', 'Eliza was here'] as const;

export type Wp7Sample = {
  id: string;
  provider: string;
  catalogPresentable: boolean;
  deepLink: string;
  detailHref: string;
  backHref: string;
  affiliateIsStoredDeepLink: boolean;
  affiliateLooksAbsoluteHttp: boolean;
};

export type Wp7RuntimeReport = {
  usedLocalOffersOverride: boolean;
  catalogCount: number;
  byProvider: Record<string, number>;
  activeCorePresent: Record<(typeof WP7_ACTIVE_PROVIDERS)[number], number>;
  searchHref: string;
  matchCount: number;
  matchByProvider: Record<string, number>;
  userPool: number;
  page1Count: number;
  page1CandidateByProvider: Record<string, number>;
  pageSize: number;
  userPaginationCap: number;
  page1PresentableByProvider: Record<string, number>;
  samples: Wp7Sample[];
  failures: string[];
};

function hrefQuery(href: string): Record<string, string | string[] | undefined> {
  const url = new URL(href, 'https://vacationweb.test');
  const record: Record<string, string | string[] | undefined> = {};
  for (const [key, value] of url.searchParams.entries()) {
    record[key] = value;
  }
  return record;
}

function countByProvider(offers: readonly TravelOffer[]): Record<string, number> {
  const by: Record<string, number> = {};
  for (const offer of offers) {
    by[offer.provider] = (by[offer.provider] ?? 0) + 1;
  }
  return by;
}

function pickFlowSamples(ranked: TravelOffer[]): TravelOffer[] {
  const picks: TravelOffer[] = [];
  const seen = new Set<string>();
  const want = ['Sunweb', 'Corendon', 'Eliza was here'] as const;

  for (const provider of want) {
    const match = ranked.find((offer) => offer.provider === provider && offer.deepLink?.trim());
    if (match && !seen.has(match.id)) {
      seen.add(match.id);
      picks.push(match);
    }
  }

  for (const offer of ranked) {
    if (picks.length >= 5) {
      break;
    }
    if (seen.has(offer.id) || !offer.deepLink?.trim()) {
      continue;
    }
    seen.add(offer.id);
    picks.push(offer);
  }

  return picks.map((offer) => offer);
}

export function evaluateWp7RuntimeFlow(
  offers: TravelOffer[],
  searchHref: string,
): Wp7RuntimeReport {
  const failures: string[] = [];
  const byProvider = countByProvider(offers);
  const usedLocalOffersOverride = Boolean(process.env.VACATIONWEB_OFFERS_FILE?.trim());

  if (usedLocalOffersOverride) {
    failures.push('VACATIONWEB_OFFERS_FILE is set — this is not the R2 runtime path');
  }
  if (offers.length < 1000) {
    failures.push(`catalog too small for production R2 (${offers.length})`);
  }

  const activeCorePresent = {
    Corendon: byProvider.Corendon ?? 0,
    Sunweb: byProvider.Sunweb ?? 0,
    'Eliza was here': byProvider['Eliza was here'] ?? 0,
  };
  for (const provider of WP7_ACTIVE_PROVIDERS) {
    if (activeCorePresent[provider] <= 0) {
      failures.push(`active core provider missing from catalog: ${provider}`);
    }
  }

  const params = parseSearchParams(hrefQuery(searchHref));
  if (params.adults !== 2) {
    failures.push(`expected adults=2 from homepage occupancy, got ${params.adults}`);
  }

  const filtered = filterOffers(offers, params);
  const ranked = sortOffers(filtered, params.sort);
  const userPool = ranked;
  const livePricingWindow = limitRankedResultsForPagination(ranked);
  const page1 = paginateResults(userPool, 1, RESULTS_PAGE_SIZE_DEFAULT);
  const page1Presentable = page1.filter(hasValidPresentablePrice);
  const page1PresentableByProvider = countByProvider(page1Presentable);
  const page1Candidates = selectPage1Candidates(ranked, RESULTS_PAGE_SIZE_DEFAULT).selected;
  const matchByProvider = countByProvider(filtered);

  if (page1.length > RESULTS_PAGE_SIZE_DEFAULT) {
    failures.push(`page 1 longer than product page size (${page1.length})`);
  }
  if (livePricingWindow.length > RESULTS_USER_PAGINATION_CAP) {
    failures.push(`live-pricing window exceeds ${RESULTS_USER_PAGINATION_CAP} (${livePricingWindow.length})`);
  }

  const samples: Wp7Sample[] = pickFlowSamples(ranked).map((offer) => {
    const detailHref = buildOfferDetailHref(offer.id, params);
    const detailParams = parseSearchParams(hrefQuery(detailHref));
    const backHref = buildResultsPageHref(detailParams, detailParams.page ?? 1);
    const stored = offer.deepLink.trim();
    const affiliate = affiliateHref(offer) ?? '';
    const affiliateIsStoredDeepLink = affiliate === stored;
    const affiliateLooksAbsoluteHttp = /^https?:\/\//i.test(stored);
    if (!affiliateIsStoredDeepLink) {
      failures.push(`affiliate href rewritten for ${offer.id}`);
    }
    if (!affiliateLooksAbsoluteHttp) {
      failures.push(`deepLink is not an absolute http(s) URL for ${offer.id}`);
    }
    if (detailParams.adults !== params.adults) {
      failures.push(`detail lost adults for ${offer.id}`);
    }
    return {
      id: offer.id,
      provider: offer.provider,
      catalogPresentable: hasValidPresentablePrice(offer),
      deepLink: stored,
      detailHref,
      backHref,
      affiliateIsStoredDeepLink,
      affiliateLooksAbsoluteHttp,
    };
  });

  if (samples.length === 0) {
    failures.push('no offers with deepLink in ranked matchset');
  }

  return {
    usedLocalOffersOverride,
    catalogCount: offers.length,
    byProvider,
    activeCorePresent,
    searchHref,
    matchCount: filtered.length,
    matchByProvider,
    userPool: userPool.length,
    page1Count: page1.length,
    page1CandidateByProvider: countByProvider(page1Candidates),
    pageSize: RESULTS_PAGE_SIZE_DEFAULT,
    userPaginationCap: RESULTS_USER_PAGINATION_CAP,
    page1PresentableByProvider,
    samples,
    failures,
  };
}
