import { canonicalizeCountryName } from '../../offers/canonical-country';
import { decodeHtmlEntities } from './decode-html-entities';
import { TravelOffer } from './travel-offer';
import { StoredOffer } from '../types/stored-offer';

function toOptionalString(value: string | boolean | undefined | null): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return String(value);
}

function normalizeSubcategories(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(', ') : undefined;
  }

  return value;
}

export function normalizeOffer(offer: StoredOffer): TravelOffer {
  const nights = offer.nights ?? 0;

  return {
    id: offer.externalId,
    provider: offer.provider,
    canonicalOfferIdentity: offer.canonicalOfferIdentity,

    hotelName: decodeHtmlEntities(String(offer.hotelName ?? '')),
    accommodation: offer.accommodation,
    accommodationType: offer.accommodationType,

    destinationCountry: canonicalizeCountryName(offer.country),
    destinationProvince: offer.province,
    destinationRegion: offer.region,
    destinationCity: offer.city,

    departureAirport: offer.departureAirport,
    departureAirportCode: offer.departureAirportCode,
    airport: offer.airport,
    departureDate: offer.departureDate,

    boardType: offer.boardType,
    nights,
    durationType: offer.durationType,
    flightIncluded: toOptionalString(offer.flightIncluded),
    lastMinute: toOptionalString(offer.lastMinute),
    hasCarRental: offer.hasCarRental === true ? true : undefined,

    price: offer.price,
    currency: offer.currency,
    pricePerDay: nights > 0 ? Math.round(offer.price / nights) : offer.price,

    stars: offer.stars,
    rating: offer.rating,

    imageUrl: offer.imageUrl ?? '',
    imageLarge: offer.imageLarge,
    imageSmall: offer.imageSmall,
    images: offer.images,

    descriptionShort: offer.descriptionShort,
    descriptionLong: offer.descriptionLong,
    extraInfo: offer.extraInfo,
    feedDescription: offer.feedDescription,
    searchText: offer.searchText,

    latitude: offer.latitude,
    longitude: offer.longitude,

    subcategories: normalizeSubcategories(offer.subcategories),
    categories: offer.categories,

    variations: offer.variations,

    deepLink: offer.deepLink ?? '',
    affiliateCampaignId: offer.affiliateCampaignId,
    arrivalAirport: offer.arrivalAirport,
    feedSourceId: offer.feedSourceId,
    listingHost: offer.listingHost,
    providerListings: offer.providerListings,
    localizedDescriptions: offer.localizedDescriptions,

    departureWindowStart: '',
    departureWindowEnd: '',
    // valueScore intentionally omitted — sortOffers falls back to computeValueScore via ??
    flexibilityScore: 0,
  };
}
