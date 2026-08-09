import type { TravelOffer } from '../../feeds/canonical/travel-offer';
import { getPrijsvrijServiceToken, type FetchLike } from './auth';
import {
  PRIJSVRIJ_DEFAULT_PAGE_SIZE,
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

export type EnrichPrijsvrijSearchPricesOptions = {
  fetchImpl?: FetchLike;
};

function applySearchPrice(offer: TravelOffer, searchPrice: number): TravelOffer {
  const nights = offer.nights > 0 ? offer.nights : 0;
  return {
    ...offer,
    // List[].Price = Prijsvrij Search-resultaatprijs (niet booking/receipt).
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

  while (priceByProductId.size < input.neededIds.size) {
    const alreadyHaveAll =
      [...input.neededIds].every((id) => priceByProductId.has(id));
    if (alreadyHaveAll) {
      break;
    }

    const startIndex = (page - 1) * PRIJSVRIJ_DEFAULT_PAGE_SIZE;
    if (startIndex >= totalFound) {
      break;
    }

    const response = await searchPrijsvrij(
      input.token,
      { filters, currentUrl },
      {
        pageSize: PRIJSVRIJ_DEFAULT_PAGE_SIZE,
        page,
        fetchImpl: input.fetchImpl,
      },
    );

    if (typeof response.TotalFound === 'number') {
      totalFound = response.TotalFound;
    }

    const before = priceByProductId.size;
    collectPricesFromList(response.List, input.neededIds, priceByProductId);

    if (!response.List?.length) {
      break;
    }

    // No progress and page full → continue; empty progress on short page → stop.
    if (priceByProductId.size === before && response.List.length < PRIJSVRIJ_DEFAULT_PAGE_SIZE) {
      break;
    }

    page += 1;
    if (page > 25) {
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
): Promise<{ landValue: string; regioValue: string } | null> {
  let filters = bootstrap.Filters;
  let landValue = findFilterValueByName(filters, 'land', country);
  let regioValue = findFilterValueByName(filters, 'regio', region);

  if (landValue && regioValue) {
    return { landValue, regioValue };
  }

  // Bootstrap without destination can omit nested regio parents; retry with land if known.
  if (landValue && !regioValue) {
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

/**
 * Enriches visible Prijsvrij offers with Search List[].Price when a reliable Id match exists.
 * On any failure, returns the original offers (TradeTracker/feed price fallback).
 * Does not label feed fallback as a live Search price (no UI/source field change).
 */
export async function enrichPrijsvrijSearchPrices(
  offers: TravelOffer[],
  options: EnrichPrijsvrijSearchPricesOptions = {},
): Promise<TravelOffer[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const prijsvrijOffers = offers.filter((offer) => offer.provider === PRIJSVRIJ_PROVIDER_NAME);
  if (prijsvrijOffers.length === 0) {
    return offers;
  }

  try {
    const token = await getPrijsvrijServiceToken(fetchImpl);
    const priceByProductId = new Map<string, number>();

    type Group = {
      departureDate: string;
      nights: number;
      transport: string;
      country: string;
      region: string;
      countrySlug?: string;
      regionSlug?: string;
      neededIds: Set<string>;
    };

    const groups = new Map<string, Group>();

    for (const offer of prijsvrijOffers) {
      const productId = extractPrijsvrijProductId(offer.id);
      const context = getPrijsvrijOfferSearchContext(offer);
      if (!productId || !context) {
        continue;
      }

      const key = buildPrijsvrijOfferContextKey(context);
      const existing = groups.get(key);
      if (existing) {
        existing.neededIds.add(productId);
        continue;
      }

      groups.set(key, {
        ...context,
        neededIds: new Set([productId]),
      });
    }

    // One bootstrap per unique travel context (date/nights/transport), shared across destinations.
    const bootstrapByTravelKey = new Map<string, PrijsvrijSearchResponse>();

    for (const group of groups.values()) {
      const travelKey = `${group.departureDate}|${group.nights}|${group.transport}`;
      let bootstrap = bootstrapByTravelKey.get(travelKey);
      if (!bootstrap) {
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
      );
      if (!destination) {
        continue;
      }

      const found = await fetchPricesForDestination({
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
      });

      for (const [id, price] of found) {
        priceByProductId.set(id, price);
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
  } catch {
    // Token/API/timeout/parse errors → keep feed prices.
    return offers;
  }
}
