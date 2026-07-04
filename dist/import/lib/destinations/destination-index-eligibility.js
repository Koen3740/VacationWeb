"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDestinationIndexEligible = isDestinationIndexEligible;
exports.getCountryQualityStats = getCountryQualityStats;
exports.shouldHideCountryFromDestinationIndex = shouldHideCountryFromDestinationIndex;
const EXCLUDED_CATEGORIES = new Set([
    'Stedentrips',
    'Rondreizen',
    'Cruises',
    'Autorondreis',
    'Fly & Train',
    'Treinreizen',
    'Minicruise',
    'Kerstcruises',
]);
const EXCLUDED_SUBCATEGORY_PATTERNS = [
    /^steden(trip|trips)?$/i,
    /^rondreis/i,
    /^autorondreis/i,
    /^cruise$/i,
    /^minicruise$/i,
    /^expeditie/i,
    /^expedition/i,
    /vliegticket/i,
    /alleen\s*vlucht/i,
    /losse\s*vlucht/i,
    /flight\s*only/i,
];
const NON_HOTEL_ACCOMMODATION = new Set([
    'camping',
    'vakantiepark',
    'hostel',
    'tent',
    '(sta)caravan',
]);
function parseSubcategories(value) {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.map((entry) => entry.trim()).filter(Boolean);
    }
    return value
        .split(/\s*\|\s*|[,;]/)
        .map((entry) => entry.trim())
        .filter(Boolean);
}
function isDestinationIndexEligible(offer) {
    for (const category of offer.categories ?? []) {
        if (EXCLUDED_CATEGORIES.has(category)) {
            return false;
        }
    }
    for (const subcategory of parseSubcategories(offer.subcategories)) {
        if (EXCLUDED_SUBCATEGORY_PATTERNS.some((pattern) => pattern.test(subcategory))) {
            return false;
        }
    }
    const accommodationType = offer.accommodationType?.trim().toLowerCase();
    if (accommodationType && NON_HOTEL_ACCOMMODATION.has(accommodationType)) {
        return false;
    }
    return true;
}
function getCountryQualityStats(offers, country) {
    const countryOffers = offers.filter((offer) => offer.country === country);
    const providers = new Set(countryOffers.map((offer) => offer.provider));
    const regions = new Set(countryOffers.map((offer) => offer.region?.trim()).filter(Boolean));
    return {
        offerCount: countryOffers.length,
        providerCount: providers.size,
        regionCount: regions.size,
    };
}
/** Hide thin single-provider destinations with one region from the search index. */
function shouldHideCountryFromDestinationIndex(stats) {
    return stats.offerCount < 5 && stats.providerCount === 1 && stats.regionCount === 1;
}
