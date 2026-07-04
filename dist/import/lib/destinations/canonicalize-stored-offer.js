"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectDestinationVariants = collectDestinationVariants;
exports.canonicalizeStoredOffer = canonicalizeStoredOffer;
exports.canonicalizeStoredOffers = canonicalizeStoredOffers;
exports.collectCountryMergeReport = collectCountryMergeReport;
const normalize_key_1 = require("./normalize-key");
function getVariantMap(store, scopeKey) {
    const existing = store.get(scopeKey);
    if (existing) {
        return existing;
    }
    const created = new Map();
    store.set(scopeKey, created);
    return created;
}
function isValidPlaceName(value) {
    if (!value?.trim()) {
        return false;
    }
    const trimmed = value.trim();
    return trimmed !== '.' && trimmed.length >= 2;
}
function collectDestinationVariants(offers) {
    const countries = new Map();
    const regions = new Map();
    const islands = new Map();
    const cities = new Map();
    for (const offer of offers) {
        if (!offer.country?.trim() || (0, normalize_key_1.isExcludedCountry)(offer.country)) {
            continue;
        }
        const countryKey = (0, normalize_key_1.resolveCountryKey)((0, normalize_key_1.normalizeDestinationKey)(offer.country));
        (0, normalize_key_1.registerLabelVariant)(getVariantMap(countries, countryKey), offer.country);
        if (offer.region?.trim() &&
            isValidPlaceName(offer.region) &&
            (0, normalize_key_1.normalizeDestinationKey)(offer.region) !== countryKey) {
            (0, normalize_key_1.registerLabelVariant)(getVariantMap(regions, countryKey), offer.region);
        }
        if (offer.province?.trim() && offer.region?.trim() && isValidPlaceName(offer.region)) {
            const regionKey = (0, normalize_key_1.normalizeDestinationKey)(offer.region);
            (0, normalize_key_1.registerLabelVariant)(getVariantMap(islands, `${countryKey}|${regionKey}`), offer.province);
        }
        if (offer.city?.trim() && isValidPlaceName(offer.city)) {
            if (offer.region?.trim() &&
                isValidPlaceName(offer.region) &&
                (0, normalize_key_1.normalizeDestinationKey)(offer.region) !== countryKey) {
                const regionKey = (0, normalize_key_1.normalizeDestinationKey)(offer.region);
                (0, normalize_key_1.registerLabelVariant)(getVariantMap(cities, `${countryKey}|${regionKey}`), offer.city);
            }
            else {
                (0, normalize_key_1.registerLabelVariant)(getVariantMap(cities, countryKey), offer.city);
            }
        }
    }
    return { countries, regions, islands, cities };
}
function canonicalizeStoredOffer(offer, variants) {
    if (!offer.country?.trim() || (0, normalize_key_1.isExcludedCountry)(offer.country)) {
        return null;
    }
    const countryKey = (0, normalize_key_1.resolveCountryKey)((0, normalize_key_1.normalizeDestinationKey)(offer.country));
    const countryScope = getVariantMap(variants.countries, countryKey);
    const country = (0, normalize_key_1.resolveCanonicalCountry)(offer.country, countryScope);
    if (!country) {
        return null;
    }
    const canonicalCountryKey = (0, normalize_key_1.normalizeDestinationKey)(country);
    const regionScope = getVariantMap(variants.regions, canonicalCountryKey);
    let region = offer.region?.trim() && isValidPlaceName(offer.region)
        ? (0, normalize_key_1.resolveCanonicalPlaceName)(offer.region, regionScope)
        : undefined;
    if (region && (0, normalize_key_1.normalizeDestinationKey)(region) === canonicalCountryKey) {
        region = undefined;
    }
    const regionKey = region ? (0, normalize_key_1.normalizeDestinationKey)(region) : '';
    const islandScope = region
        ? getVariantMap(variants.islands, `${canonicalCountryKey}|${regionKey}`)
        : undefined;
    const province = offer.province?.trim() && region && islandScope && isValidPlaceName(offer.province)
        ? (0, normalize_key_1.resolveCanonicalPlaceName)(offer.province, islandScope)
        : undefined;
    const cityScope = region
        ? getVariantMap(variants.cities, `${canonicalCountryKey}|${regionKey}`)
        : getVariantMap(variants.cities, canonicalCountryKey);
    let city = offer.city?.trim() && isValidPlaceName(offer.city)
        ? (0, normalize_key_1.resolveCanonicalPlaceName)(offer.city, cityScope)
        : undefined;
    if (city &&
        region &&
        (0, normalize_key_1.normalizeDestinationKey)(city) === (0, normalize_key_1.normalizeDestinationKey)(region)) {
        city = undefined;
    }
    return {
        ...offer,
        country,
        region,
        province: province && province !== region ? province : undefined,
        city,
    };
}
function canonicalizeStoredOffers(offers) {
    const variants = collectDestinationVariants(offers);
    const canonicalOffers = [];
    for (const offer of offers) {
        const canonical = canonicalizeStoredOffer(offer, variants);
        if (canonical) {
            canonicalOffers.push(canonical);
        }
    }
    return canonicalOffers;
}
function collectCountryMergeReport(before, after) {
    const beforeById = new Map(before.map((offer) => [offer.externalId, offer.country]));
    const merges = new Map();
    for (const offer of after) {
        const previousCountry = beforeById.get(offer.externalId);
        if (previousCountry && previousCountry !== offer.country) {
            merges.set(previousCountry, offer.country);
        }
    }
    return [...merges.entries()]
        .sort(([left], [right]) => left.localeCompare(right, 'nl'))
        .map(([from, to]) => `${from} → ${to}`);
}
