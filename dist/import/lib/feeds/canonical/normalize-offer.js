"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeOffer = normalizeOffer;
function toOptionalString(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    return String(value);
}
function normalizeSubcategories(value) {
    if (value === undefined) {
        return undefined;
    }
    if (Array.isArray(value)) {
        return value.length > 0 ? value.join(', ') : undefined;
    }
    return value;
}
function normalizeOffer(offer) {
    const nights = offer.nights ?? 0;
    return {
        id: offer.externalId,
        provider: offer.provider,
        hotelName: offer.hotelName,
        accommodation: offer.accommodation,
        accommodationType: offer.accommodationType,
        destinationCountry: offer.country,
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
        price: offer.price,
        currency: offer.currency,
        pricePerDay: nights > 0 ? Math.round(offer.price / nights) : offer.price,
        stars: offer.stars,
        rating: offer.rating,
        imageUrl: offer.imageUrl,
        imageLarge: offer.imageLarge,
        imageSmall: offer.imageSmall,
        images: offer.images,
        descriptionShort: offer.descriptionShort,
        descriptionLong: offer.descriptionLong,
        extraInfo: offer.extraInfo,
        feedDescription: offer.feedDescription,
        latitude: offer.latitude,
        longitude: offer.longitude,
        subcategories: normalizeSubcategories(offer.subcategories),
        categories: offer.categories,
        variations: offer.variations,
        deepLink: offer.deepLink,
        affiliateCampaignId: offer.affiliateCampaignId,
        departureWindowStart: '',
        departureWindowEnd: '',
        valueScore: 0,
        flexibilityScore: 0,
    };
}
