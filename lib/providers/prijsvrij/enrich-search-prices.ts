import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import { getPrijsvrijServiceToken, type FetchLike } from './auth';
import {
  PRIJSVRIJ_DEFAULT_PAGE_SIZE,
  PRIJSVRIJ_MAX_SEARCH_PAGES,
  PRIJSVRIJ_PROVIDER_NAME,
} from './constants';
import {
  buildPrijsvrijOfferContextKey,
  getPrijsvrijOfferSearchContext,
} from './offer-context';
import { extractPrijsvrijProductId } from './product-id';
import {
  buildContextFilters,
  buildCurrentUrl,
  buildDestinationFilters,
  findFilterValueByName,
  searchPrijsvrij,
  type PrijsvrijSearchListItem,
  type PrijsvrijSearchResponse,
} from './search-client';

export type EnrichPrijsvrijRetryStats = {
  groupTimeoutRetries: number;
  groupTimeoutRetrySuccesses: number;
  groupTimeoutRetryFailures: number;
};

/** Optional in-request counters for Strategy D request deduction. */
export type EnrichPrijsvrijRequestStats = {
  offerCount: number;
  uniqueAtomicContexts: number;
  destinationSearchFlows: number;
  searchHttpRequests: number;
};

export type EnrichPrijsvrijSearchPricesOptions = {
  fetchImpl?: FetchLike;
  /** Optional counters for existing TimeoutError retry measurement. */
  retryStats?: EnrichPrijsvrijRetryStats;
  /** Optional Strategy D request counters (mutated in-place). */
  requestStats?: EnrichPrijsvrijRequestStats;
};

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const name = (error as { name?: string }).name;
  const message = String((error as { message?: string }).message ?? error);
  return name === 'TimeoutError' || name === 'AbortError' || /timeout|aborted/i.test(message);
}

/** Proven atomic Prijsvrij Search context (+ product ids to resolve). */
type AtomicContextGroup = {
  departureDate: string;
  nights: number;
  transport: string;
  country: string;
  region: string;
  countrySlug?: string;
  regionSlug?: string;
  neededIds: Set<string>;
};

function applySearchPrice(offer: TravelOffer, searchPrice: number): TravelOffer {
  const nights = offer.nights > 0 ? offer.nights : 0;
  return {
    ...offer,
    // List[].Price = Prijsvrij Search-resultaatprijs (niet booking/receipt).
    // When enrichment fails, offer.price remains the feed value technically,
    // but that must not be treated as a proven live Search selling price.
    price: searchPrice,
    pricePerDay: nights > 0 ? Math.round(searchPrice / nights) : searchPrice,
  };
}

function collectPricesFromList(
  list: PrijsvrijSearchListItem[] | undefined,
  neededIds: Set<string>,
  priceByProductId: Map<string, number>,
): void {
  if (!list?.length) {
    return;
  }

  for (const item of list) {
    if (item.Id == null) {
      continue;
    }
    const id = String(item.Id);
    if (!neededIds.has(id)) {
      continue;
    }
    if (typeof item.Price !== 'number' || !Number.isFinite(item.Price) || item.Price <= 0) {
      continue;
    }
    priceByProductId.set(id, item.Price);
  }
}

function allNeededFound(
  neededIds: Set<string>,
  priceByProductId: Map<string, number>,
): boolean {
  for (const id of neededIds) {
    if (!priceByProductId.has(id)) {
      return false;
    }
  }
  return true;
}

function trackSearchHttp(requestStats: EnrichPrijsvrijRequestStats | undefined): void {
  if (requestStats) {
    requestStats.searchHttpRequests += 1;
  }
}

async function fetchPricesForDestination(input: {
  token: string;
  departureDate: string;
  nights: number;
  transport: string;
  landValue: string;
  regioValue: string;
  countrySlug?: string;
  regionSlug?: string;
  neededIds: Set<string>;
  fetchImpl: FetchLike;
  requestStats?: EnrichPrijsvrijRequestStats;
}): Promise<Map<string, number>> {
  const priceByProductId = new Map<string, number>();
  const filters = [
    ...buildDestinationFilters({
      landValue: input.landValue,
      regioValue: input.regioValue,
    }),
    ...buildContextFilters({
      departureDate: input.departureDate,
      nights: input.nights,
      transport: input.transport,
    }),
  ];
  const currentUrl = buildCurrentUrl({
    departureDate: input.departureDate,
    nights: input.nights,
    transport: input.transport,
    countrySlug: input.countrySlug,
    regionSlug: input.regionSlug,
  });

  let page = 1;
  let totalFound = Number.POSITIVE_INFINITY;

  while (!allNeededFound(input.neededIds, priceByProductId)) {
    const startIndex = (page - 1) * PRIJSVRIJ_DEFAULT_PAGE_SIZE;
    if (Number.isFinite(totalFound) && startIndex >= totalFound) {
      break;
    }

    trackSearchHttp(input.requestStats);
    const response = await searchPrijsvrij(
      input.token,
      { filters, currentUrl },
      {
        pageSize: PRIJSVRIJ_DEFAULT_PAGE_SIZE,
        page,
        fetchImpl: input.fetchImpl,
      },
    );

    if (typeof response.TotalFound === 'number' && Number.isFinite(response.TotalFound)) {
      totalFound = response.TotalFound;
    }

    collectPricesFromList(response.List, input.neededIds, priceByProductId);

    if (!response.List?.length) {
      break;
    }

    // Continue across full pages until TotalFound is exhausted or all IDs matched.
    page += 1;
    const pageLimit = Number.isFinite(totalFound)
      ? Math.min(
          PRIJSVRIJ_MAX_SEARCH_PAGES,
          Math.max(1, Math.ceil(totalFound / PRIJSVRIJ_DEFAULT_PAGE_SIZE)),
        )
      : PRIJSVRIJ_MAX_SEARCH_PAGES;
    if (page > pageLimit) {
      break;
    }
  }

  return priceByProductId;
}

async function resolveDestinationValues(
  token: string,
  bootstrap: PrijsvrijSearchResponse,
  country: string,
  region: string,
  context: {
    departureDate: string;
    nights: number;
    transport: string;
    countrySlug?: string;
    regionSlug?: string;
  },
  fetchImpl: FetchLike,
  requestStats?: EnrichPrijsvrijRequestStats,
): Promise<{ landValue: string; regioValue: string } | null> {
  let filters = bootstrap.Filters;
  let landValue = findFilterValueByName(filters, 'land', country);
  let regioValue = findFilterValueByName(filters, 'regio', region);

  if (landValue && regioValue) {
    return { landValue, regioValue };
  }

  // Bootstrap without destination can omit nested regio parents; resolve with land if known.
  if (landValue && !regioValue) {
    trackSearchHttp(requestStats);
    const landScoped = await searchPrijsvrij(
      token,
      {
        filters: [
          ...buildDestinationFilters({ landValue }),
          ...buildContextFilters(context),
        ],
        currentUrl: buildCurrentUrl({
          ...context,
          countrySlug: context.countrySlug,
        }),
      },
      { pageSize: 10, page: 1, fetchImpl },
    );
    filters = landScoped.Filters;
    regioValue = findFilterValueByName(filters, 'regio', region);
    landValue = findFilterValueByName(filters, 'land', country) ?? landValue;
  }

  if (!landValue || !regioValue) {
    return null;
  }

  return { landValue, regioValue };
}

async function enrichAtomicContext(input: {
  token: string;
  group: AtomicContextGroup;
  bootstrapByTravelKey: Map<string, PrijsvrijSearchResponse>;
  fetchImpl: FetchLike;
  requestStats?: EnrichPrijsvrijRequestStats;
}): Promise<Map<string, number>> {
  const { token, group, bootstrapByTravelKey, fetchImpl, requestStats } = input;
  const travelKey = `${group.departureDate}|${group.nights}|${group.transport}`;

  let bootstrap = bootstrapByTravelKey.get(travelKey);
  if (!bootstrap) {
    trackSearchHttp(requestStats);
    bootstrap = await searchPrijsvrij(
      token,
      {
        filters: buildContextFilters(group),
        currentUrl: buildCurrentUrl(group),
      },
      { pageSize: 10, page: 1, fetchImpl },
    );
    bootstrapByTravelKey.set(travelKey, bootstrap);
  }

  const destination = await resolveDestinationValues(
    token,
    bootstrap,
    group.country,
    group.region,
    group,
    fetchImpl,
    requestStats,
  );
  if (!destination) {
    return new Map();
  }

  if (requestStats) {
    requestStats.destinationSearchFlows += 1;
  }

  return fetchPricesForDestination({
    token,
    departureDate: group.departureDate,
    nights: group.nights,
    transport: group.transport,
    landValue: destination.landValue,
    regioValue: destination.regioValue,
    countrySlug: group.countrySlug,
    regionSlug: group.regionSlug,
    neededIds: group.neededIds,
    fetchImpl,
    requestStats,
  });
}

function applyCachedPrices(
  neededIds: Set<string>,
  cached: Map<string, number>,
  priceByProductId: Map<string, number>,
): void {
  for (const id of neededIds) {
    const price = cached.get(id);
    if (price != null) {
      priceByProductId.set(id, price);
    }
  }
}

/**
 * Strategy D — enrich visible-page Prijsvrij offers from the user result set.
 *
 * Caller must pass the already filtered/sorted/paginated visible offers
 * (Results: filterOffers → sortOffers → paginateResults → this).
 *
 * Within one request: group by proven atomic context
 * (land + regio + vertrekdatum + reisduurdagen + transport), run at most one
 * destination Search-flow per unique context, reuse Id→Price for all matches.
 *
 * Failures are isolated per atomic context. Feed price may remain on the offer
 * for schema compatibility but is not a proven live Search selling price.
 */
export async function enrichPrijsvrijSearchPrices(
  offers: TravelOffer[],
  options: EnrichPrijsvrijSearchPricesOptions = {},
): Promise<TravelOffer[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestStats = options.requestStats;
  const prijsvrijOffers = offers.filter((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME);

  if (requestStats) {
    requestStats.offerCount = prijsvrijOffers.length;
    requestStats.uniqueAtomicContexts = 0;
    requestStats.destinationSearchFlows = 0;
    requestStats.searchHttpRequests = 0;
  }

  if (prijsvrijOffers.length === 0) {
    return offers;
  }

  let token: string;
  try {
    token = await getPrijsvrijServiceToken(fetchImpl);
  } catch {
    // Without a token, no Search enrichment is possible.
    return offers;
  }

  const priceByProductId = new Map<string, number>();
  const atomicContexts = new Map<string, AtomicContextGroup>();

  for (const offer of prijsvrijOffers) {
    const productId = extractPrijsvrijProductId(offer.id);
    const context = getPrijsvrijOfferSearchContext(offer);
    if (!productId || !context) {
      continue;
    }

    const key = buildPrijsvrijOfferContextKey(context);
    const existing = atomicContexts.get(key);
    if (existing) {
      existing.neededIds.add(productId);
      continue;
    }

    atomicContexts.set(key, {
      ...context,
      neededIds: new Set([productId]),
    });
  }

  if (requestStats) {
    requestStats.uniqueAtomicContexts = atomicContexts.size;
  }

  // Travel-key bootstraps + destination Id→Price maps are request-scoped only.
  const bootstrapByTravelKey = new Map<string, PrijsvrijSearchResponse>();
  const priceMapByAtomicContext = new Map<string, Map<string, number>>();
  const retryStats = options.retryStats;

  for (const [contextKey, group] of atomicContexts) {
    const cached = priceMapByAtomicContext.get(contextKey);
    if (cached) {
      applyCachedPrices(group.neededIds, cached, priceByProductId);
      continue;
    }

    try {
      let found: Map<string, number>;
      try {
        found = await enrichAtomicContext({
          token,
          group,
          bootstrapByTravelKey,
          fetchImpl,
          requestStats,
        });
      } catch (error) {
        // Existing behaviour: at most one TimeoutError retry for the same context.
        if (!isTimeoutError(error)) {
          throw error;
        }
        if (retryStats) {
          retryStats.groupTimeoutRetries += 1;
        }
        try {
          found = await enrichAtomicContext({
            token,
            group,
            bootstrapByTravelKey,
            fetchImpl,
            requestStats,
          });
          if (retryStats) {
            retryStats.groupTimeoutRetrySuccesses += 1;
          }
        } catch (retryError) {
          if (retryStats) {
            retryStats.groupTimeoutRetryFailures += 1;
          }
          throw retryError;
        }
      }

      priceMapByAtomicContext.set(contextKey, found);
      for (const [id, price] of found) {
        priceByProductId.set(id, price);
      }
    } catch {
      // Isolate timeout/API errors to this atomic context only.
      continue;
    }
  }

  if (priceByProductId.size === 0) {
    return offers;
  }

  return offers.map((offer) => {
    if (offer.provider !== PRIJSVRIJ_PROVIDER_NAME) {
      return offer;
    }

    const productId = extractPrijsvrijProductId(offer.id);
    if (!productId) {
      return offer;
    }

    const searchPrice = priceByProductId.get(productId);
    if (searchPrice == null) {
      return offer;
    }

    return applySearchPrice(offer, searchPrice);
  });
}
