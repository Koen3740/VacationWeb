import { canonicalizeBoardType } from '@/lib/offers/canonicalize-board-type';
import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
import { isVacationWebFlightPackage } from '@/lib/offers/flight-package-eligibility';
import {
  offerMatchesAccommodationType,
  parseAccommodationTypesParam,
} from '@/lib/search/accommodation-type-filter';
import {
  offerMatchesAnyAmenity,
  parseAmenitiesParam,
} from '@/lib/search/amenity-filters';
import {
  offerMatchesAnyBeachLocation,
  offerMatchesAnyCenterLocation,
  parseBeachLocationsParam,
  parseCenterLocationsParam,
} from '@/lib/search/location-filters';
import {
  offerMatchesAnyVacationType,
  parseVacationTypesParam,
} from '@/lib/search/vacation-type';
import {
  offerMatchesDepartureAirports,
  parseDepartureAirportsParam,
} from '@/lib/search/departure-airports';
import { normalizeDepartureDateToIso } from '@/lib/search/departure-date';
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

function computeValueScore(offer: TravelOffer) {
  const priceScore = Math.max(0, 100 - offer.pricePerDay * 0.6);
  const ratingScore = (offer.rating ?? 4) * 10;
  const starsScore = (offer.stars ?? 3) * 8;

  return Math.round(priceScore + ratingScore + starsScore);
}

export function filterOffers(
  offers: TravelOffer[],
  params: SearchParams
): TravelOffer[] {
  const countryFilters = resolveCountryFilters(params);
  const flexibilityDays = params.flexibilityDays ?? 0;
  const effectiveDepartureStart = params.departureStart && flexibilityDays > 0
    ? shiftIsoDate(params.departureStart, -flexibilityDays)
    : params.departureStart;
  const effectiveDepartureEnd = params.departureEnd && flexibilityDays > 0
    ? shiftIsoDate(params.departureEnd, flexibilityDays)
    : params.departureEnd;

  return offers.filter((offer) => {
    if (!isVacationWebFlightPackage(offer)) {
      return false;
    }

    if (countryFilters.length > 0) {
      const offerCountry = canonicalizeCountryName(offer.destinationCountry);

      if (!countryFilters.some((country) => country === offerCountry)) {
        return false;
      }
    }

    if (
      params.region &&
      offer.destinationRegion !== params.region
    ) {
      return false;
    }

    if (params.city && offer.destinationCity !== params.city) {
      return false;
    }

    if (
      params.budgetMin !== undefined &&
      offer.price < params.budgetMin
    ) {
      return false;
    }

    if (
      params.budgetMax !== undefined &&
      offer.price > params.budgetMax
    ) {
      return false;
    }

    if (params.nights?.length) {
      if (!params.nights.includes(offer.nights)) {
        return false;
      }
    } else {
      if (
        params.nightsMin !== undefined &&
        offer.nights < params.nightsMin
      ) {
        return false;
      }

      if (
        params.nightsMax !== undefined &&
        offer.nights > params.nightsMax
      ) {
        return false;
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
        return false;
      }
    }

    const selectedAirports = parseDepartureAirportsParam(params.departureAirport);
    if (selectedAirports.length > 0 && !offerMatchesDepartureAirports(offer, selectedAirports)) {
      return false;
    }

    if (params.stars?.length) {
      const offerStars = offer.stars ?? 0;
      if (!params.stars.includes(offerStars)) {
        return false;
      }
    }

    if (params.accommodationTypes?.length) {
      const selected = parseAccommodationTypesParam(params.accommodationTypes.join(','));
      if (selected.length > 0 && !offerMatchesAccommodationType(offer.accommodationType, selected)) {
        return false;
      }
    }

    if (params.vacationTypes?.length) {
      const selectedTypes = parseVacationTypesParam(params.vacationTypes.join(','));
      if (selectedTypes.length > 0 && !offerMatchesAnyVacationType(offer, selectedTypes)) {
        return false;
      }
    }

    if (params.beachLocation?.length) {
      const selected = parseBeachLocationsParam(params.beachLocation.join(','));
      if (selected.length > 0 && !offerMatchesAnyBeachLocation(offer, selected)) {
        return false;
      }
    }

    if (params.centerLocation?.length) {
      const selected = parseCenterLocationsParam(params.centerLocation.join(','));
      if (selected.length > 0 && !offerMatchesAnyCenterLocation(offer, selected)) {
        return false;
      }
    }

    if (params.amenities?.length) {
      const selectedAmenities = parseAmenitiesParam(params.amenities.join(','));
      if (selectedAmenities.length > 0 && !offerMatchesAnyAmenity(offer, selectedAmenities)) {
        return false;
      }
    }

    if (params.hasCarRental === true && offer.hasCarRental !== true) {
      return false;
    }

    if (effectiveDepartureStart || effectiveDepartureEnd) {
      if (offer.departureDate) {
        const departureIso = normalizeDepartureDateToIso(offer.departureDate);
        if (!departureIso) {
          return false;
        }
        if (effectiveDepartureStart && departureIso < effectiveDepartureStart) {
          return false;
        }
        if (effectiveDepartureEnd && departureIso > effectiveDepartureEnd) {
          return false;
        }
      }
    }

    return true;
  });
}

/** Faceted count: current search/filters without the hasCarRental constraint. */
export function countCarRentalFacet(offers: TravelOffer[], params: SearchParams): number {
  const context = filterOffers(offers, { ...params, hasCarRental: undefined });
  return context.filter((offer) => offer.hasCarRental === true).length;
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