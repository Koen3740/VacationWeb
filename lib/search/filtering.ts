import { canonicalizeCountryName } from '@/lib/offers/canonical-country';
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

    if (
      params.boardTypes?.length &&
      !params.boardTypes.includes(offer.boardType ?? '')
    ) {
      return false;
    }

    if (
      params.departureAirport &&
      offer.departureAirport &&
      offer.departureAirport !== params.departureAirport
    ) {
      return false;
    }

    if (
      params.stars &&
      (offer.stars ?? 0) < params.stars
    ) {
      return false;
    }

    // Nieuwe Corendon-feed: filter op vertrekdatum
    if (
      effectiveDepartureStart &&
      offer.departureDate &&
      offer.departureDate < effectiveDepartureStart
    ) {
      return false;
    }

    if (
      effectiveDepartureEnd &&
      offer.departureDate &&
      offer.departureDate > effectiveDepartureEnd
    ) {
      return false;
    }

    return true;
  });
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

    case 'value':
    default:
      return [...ranked].sort(
        (a, b) => (b.valueScore ?? 0) - (a.valueScore ?? 0)
      );
  }
}