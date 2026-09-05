import { canonicalizeBoardType } from '@/lib/offers/canonicalize-board-type';
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { canonicalizeRegionName } from '@/lib/offers/canonical-region';
import { isVacationWebFlightPackage } from '@/lib/offers/flight-package-eligibility';
import {
  ACCOMMODATION_TYPE_FILTER_VALUES,
  effectiveAccommodationTypesForFilter,
  offerMatchesAccommodationType,
  parseAccommodationTypesParam,
} from '@/lib/search/accommodation-type-filter';
import {
  offerMatchesAnyAmenity,
  offerMatchesAmenity,
  parseAmenitiesParam,
  type AmenityValue,
} from '@/lib/search/amenity-filters';
import {
  offerMatchesAnyBeachLocation,
  offerMatchesAnyCenterLocation,
  parseBeachLocationsParam,
  parseCenterLocationsParam,
} from '@/lib/search/location-filters';
import {
  offerMatchesAnyVacationType,
  offerMatchesVacationType,
  parseVacationTypesParam,
} from '@/lib/search/vacation-type';
import {
  offerMatchesDepartureAirports,
  parseDepartureAirportsParam,
} from '@/lib/search/departure-airports';
import {
  earliestSelectableDepartureIso,
  normalizeDepartureDateToIso,
  sanitizeDepartureSearchWindow,
} from '@/lib/search/departure-date';
import { SearchParams, TravelOffer } from '@/types/travel';

function shiftIsoDate(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolveCountryFilters(params: SearchParams): string[] {
  if (params.countries?.length) {
    return params.countries.map((country) => canonicalizeCountryName(country));
  }

  if (params.country) {
    return [canonicalizeCountryName(params.country)];
  }

  return [];
}

/** Budget uses the offer's current `price` (catalog or live overlay). */
export function offerMatchesBudget(offer: TravelOffer, params: SearchParams): boolean {
  if (params.budgetMin !== undefined && offer.price < params.budgetMin) {
    return false;
  }
  if (params.budgetMax !== undefined && offer.price > params.budgetMax) {
    return false;
  }
  return true;
}

function computeValueScore(offer: TravelOffer) {
  const priceScore = Math.max(0, 100 - offer.pricePerDay * 0.6);
  const ratingScore = (offer.rating ?? 4) * 10;
  const starsScore = (offer.stars ?? 3) * 8;

  return Math.round(priceScore + ratingScore + starsScore);
}

export type FilterOffersOptions = {
  /**
   * Stop after this many matches. Used for the Results user-resultset limit
   * early-check (stopAt = 1001). Same filter semantics as a full filterOffers.
   */
  stopAt?: number;
  /** When set, receives the number of source offers examined (including early-stop). */
  scannedOut?: { value: number };
};

export function filterOffers(
  offers: TravelOffer[],
  params: SearchParams,
  options: FilterOffersOptions = {},
): TravelOffer[] {
  const countryFilters = resolveCountryFilters(params);
  const bookableWindow = sanitizeDepartureSearchWindow(
    params.departureStart,
    params.departureEnd,
  );
  if ((params.departureStart || params.departureEnd) && !bookableWindow.valid) {
    if (options.scannedOut) {
      options.scannedOut.value = 0;
    }
    return [];
  }

  const flexibilityDays = params.flexibilityDays ?? 0;
  const minBookable = earliestSelectableDepartureIso();
  const windowStart = bookableWindow.departureStart;
  const windowEnd = bookableWindow.departureEnd;
  const flexedStart =
    windowStart && flexibilityDays > 0
      ? shiftIsoDate(windowStart, -flexibilityDays)
      : windowStart;
  const flexedEnd =
    windowEnd && flexibilityDays > 0
      ? shiftIsoDate(windowEnd, flexibilityDays)
      : windowEnd;
  const effectiveDepartureStart =
    flexedStart && flexedStart < minBookable ? minBookable : flexedStart;
  const effectiveDepartureEnd = flexedEnd;
  const stopAt =
    typeof options.stopAt === 'number' && Number.isFinite(options.stopAt) && options.stopAt > 0
      ? Math.floor(options.stopAt)
      : undefined;

  const matches: TravelOffer[] = [];
  let scanned = 0;
  for (const offer of offers) {
    scanned += 1;
    if (!isVacationWebFlightPackage(offer)) {
      continue;
    }

    if (countryFilters.length > 0) {
      const offerCountry = canonicalizeCountryName(offer.destinationCountry);

      if (!countryFilters.some((country) => country === offerCountry)) {
        continue;
      }
    }

    if (
      params.region &&
      canonicalizeRegionName(offer.destinationRegion) !== canonicalizeRegionName(params.region)
    ) {
      continue;
    }

    if (params.city && offer.destinationCity !== params.city) {
      continue;
    }

    if (!offerMatchesBudget(offer, params)) {
      continue;
    }

    if (params.nights?.length) {
      if (!params.nights.includes(offer.nights)) {
        continue;
      }
    } else {
      if (
        params.nightsMin !== undefined &&
        offer.nights < params.nightsMin
      ) {
        continue;
      }

      if (
        params.nightsMax !== undefined &&
        offer.nights > params.nightsMax
      ) {
        continue;
      }
    }

    if (params.boardTypes?.length) {
      const selectedBoardTypes = new Set(
        params.boardTypes
          .map((value) => canonicalizeBoardType(value))
          .filter((value): value is NonNullable<typeof value> => Boolean(value)),
      );
      const offerBoardType = canonicalizeBoardType(offer.boardType);

      if (selectedBoardTypes.size > 0 && (!offerBoardType || !selectedBoardTypes.has(offerBoardType))) {
        continue;
      }
    }

    const selectedAirports = parseDepartureAirportsParam(params.departureAirport);
    if (selectedAirports.length > 0 && !offerMatchesDepartureAirports(offer, selectedAirports)) {
      continue;
    }

    if (params.stars?.length) {
      const offerStars = offer.stars ?? 0;
      if (!params.stars.includes(offerStars)) {
        continue;
      }
    }

    if (params.accommodationTypes?.length) {
      const selected = effectiveAccommodationTypesForFilter(
        parseAccommodationTypesParam(params.accommodationTypes.join(',')),
        ACCOMMODATION_TYPE_FILTER_VALUES,
      );
      if (selected.length > 0 && !offerMatchesAccommodationType(offer.accommodationType, selected)) {
        continue;
      }
    }

    if (params.vacationTypes?.length) {
      const selectedTypes = parseVacationTypesParam(params.vacationTypes.join(','));
      if (selectedTypes.length > 0 && !offerMatchesAnyVacationType(offer, selectedTypes)) {
        continue;
      }
    }

    if (params.beachLocation?.length) {
      const selected = parseBeachLocationsParam(params.beachLocation.join(','));
      if (selected.length > 0 && !offerMatchesAnyBeachLocation(offer, selected)) {
        continue;
      }
    }

    if (params.centerLocation?.length) {
      const selected = parseCenterLocationsParam(params.centerLocation.join(','));
      if (selected.length > 0 && !offerMatchesAnyCenterLocation(offer, selected)) {
        continue;
      }
    }

    if (params.amenities?.length) {
      const selectedAmenities = parseAmenitiesParam(params.amenities.join(','));
      if (selectedAmenities.length > 0 && !offerMatchesAnyAmenity(offer, selectedAmenities)) {
        continue;
      }
    }

    if (params.hasCarRental === true && offer.hasCarRental !== true) {
      continue;
    }

    if (effectiveDepartureStart || effectiveDepartureEnd) {
      if (offer.departureDate) {
        const departureIso = normalizeDepartureDateToIso(offer.departureDate);
        if (!departureIso) {
          continue;
        }
        if (effectiveDepartureStart && departureIso < effectiveDepartureStart) {
          continue;
        }
        if (effectiveDepartureEnd && departureIso > effectiveDepartureEnd) {
          continue;
        }
      }
    }

    matches.push(offer);
    if (stopAt !== undefined && matches.length >= stopAt) {
      break;
    }
  }

  if (options.scannedOut) {
    options.scannedOut.value = scanned;
  }

  return matches;
}

function countFacetMatches(
  offers: TravelOffer[],
  params: SearchParams,
  omitParam: Partial<SearchParams>,
  predicate: (offer: TravelOffer) => boolean,
): number {
  const context = filterOffers(offers, { ...params, ...omitParam });
  // Facet counts are catalog-matchset counts — never gated on live listability.
  return context.filter(predicate).length;
}

/** Faceted count: current search/filters without the hasCarRental constraint (catalog matchset). */
export function countCarRentalFacet(offers: TravelOffer[], params: SearchParams): number {
  return countFacetMatches(offers, params, { hasCarRental: undefined }, (offer) => offer.hasCarRental === true);
}

/**
 * Faceted count for Roadtrip (Fly & Drive): current search/filters without the
 * Roadtrip vacation-type constraint. Catalog-stable (no live price / listability).
 */
export function countRoadtripFacet(offers: TravelOffer[], params: SearchParams): number {
  const active = parseVacationTypesParam(params.vacationTypes?.join(','));
  const withoutRoadtrip = active.filter((type) => type !== 'Fly & Drive');
  return countFacetMatches(
    offers,
    params,
    { vacationTypes: withoutRoadtrip.length > 0 ? withoutRoadtrip : undefined },
    (offer) => offerMatchesVacationType(offer, 'Fly & Drive'),
  );
}

/** Faceted count: current search/filters without the given amenity (catalog matchset). */
export function countAmenityFacet(
  offers: TravelOffer[],
  params: SearchParams,
  amenity: AmenityValue,
): number {
  const active = parseAmenitiesParam(params.amenities?.join(','));
  const withoutAmenity = active.filter((item) => item !== amenity);
  return countFacetMatches(
    offers,
    params,
    { amenities: withoutAmenity.length > 0 ? withoutAmenity : undefined },
    (offer) => offerMatchesAmenity(offer, amenity),
  );
}

export function sortOffers(
  offers: TravelOffer[],
  sort: string = 'value'
): TravelOffer[] {
  const ranked = offers.map((offer) => ({
    ...offer,
    valueScore:
      offer.valueScore ?? computeValueScore(offer),

    flexibilityScore:
      offer.flexibilityScore ??
      Math.max(
        70,
        100 - Math.abs(offer.nights - 8) * 6
      ),
  }));

  switch (sort) {
    case 'price':
      return [...ranked].sort(
        (a, b) => a.price - b.price
      );

    case 'price-desc':
      return [...ranked].sort(
        (a, b) => b.price - a.price
      );

    case 'price-per-day':
      return [...ranked].sort(
        (a, b) => a.pricePerDay - b.pricePerDay
      );

    case 'rating':
      return [...ranked].sort(
        (a, b) => (b.rating ?? 0) - (a.rating ?? 0)
      );

    case 'stars':
      return [...ranked].sort(
        (a, b) => (b.stars ?? 0) - (a.stars ?? 0)
      );

    case 'departure': {
      // Without a user departure filter: earliest *available* (today+) first; past dates last.
      const today = new Date().toISOString().slice(0, 10);
      return [...ranked].sort((a, b) => {
        const dateA = normalizeDepartureDateToIso(a.departureDate) ?? '';
        const dateB = normalizeDepartureDateToIso(b.departureDate) ?? '';
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        const aPast = dateA < today;
        const bPast = dateB < today;
        if (aPast !== bPast) {
          return aPast ? 1 : -1;
        }
        return dateA.localeCompare(dateB);
      });
    }

    case 'duration':
      return [...ranked].sort(
        (a, b) => a.nights - b.nights
      );

    case 'value':
    default:
      // WP8: "Aanbevolen" is not a user sort. Preserve filtered catalog order.
      // Do not rank by valueScore. Legacy ?sort=value uses this same path.
      return ranked;
  }
}