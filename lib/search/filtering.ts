import { SearchParams, TravelOffer } from '@/types/travel';

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
  return offers.filter((offer) => {
    if (
      params.country &&
      offer.destinationCountry !== params.country
    ) {
      return false;
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
      params.departureStart &&
      offer.departureDate &&
      offer.departureDate < params.departureStart
    ) {
      return false;
    }

    if (
      params.departureEnd &&
      offer.departureDate &&
      offer.departureDate > params.departureEnd
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