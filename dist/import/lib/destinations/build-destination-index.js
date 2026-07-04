"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDestinationIndexFromStoredOffers = buildDestinationIndexFromStoredOffers;
exports.collectRemovedDestinations = collectRemovedDestinations;
const normalize_offer_1 = require("../feeds/canonical/normalize-offer");
const canonicalize_stored_offer_1 = require("./canonicalize-stored-offer");
const destination_index_eligibility_1 = require("./destination-index-eligibility");
const match_destination_1 = require("./match-destination");
const normalize_key_1 = require("./normalize-key");
const searchable_region_1 = require("./searchable-region");
function collectRegionVariants(offers) {
    const byCountry = new Map();
    for (const offer of offers) {
        const region = (0, searchable_region_1.resolveSearchableRegion)({
            country: offer.destinationCountry,
            region: offer.destinationRegion,
            province: offer.destinationProvince,
            city: offer.destinationCity,
        });
        if (!region) {
            continue;
        }
        const countryKey = (0, normalize_key_1.normalizeDestinationKey)(offer.destinationCountry);
        const scope = byCountry.get(countryKey) ?? new Map();
        (0, searchable_region_1.registerSearchableRegionVariant)(scope, region);
        byCountry.set(countryKey, scope);
    }
    return byCountry;
}
function buildSearchList(offers) {
    const countryCounts = new Map();
    const regionCounts = new Map();
    const regionVariants = collectRegionVariants(offers);
    for (const offer of offers) {
        const country = offer.destinationCountry;
        if (!country) {
            continue;
        }
        countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
        const searchableRegion = (0, searchable_region_1.resolveSearchableRegion)({
            country,
            region: offer.destinationRegion,
            province: offer.destinationProvince,
            city: offer.destinationCity,
        });
        if (!searchableRegion) {
            continue;
        }
        const countryKey = (0, normalize_key_1.normalizeDestinationKey)(country);
        const variants = regionVariants.get(countryKey);
        const canonicalRegion = variants
            ? (0, searchable_region_1.resolveCanonicalSearchableRegion)(searchableRegion, variants)
            : searchableRegion;
        const regionKey = `${country}|${(0, normalize_key_1.normalizeDestinationKey)(canonicalRegion)}`;
        regionCounts.set(regionKey, (regionCounts.get(regionKey) ?? 0) + 1);
    }
    const items = [];
    const sortedCountries = [...countryCounts.entries()]
        .filter(([, count]) => count > 0)
        .sort(([left], [right]) => left.localeCompare(right, 'nl'));
    for (const [country, count] of sortedCountries) {
        items.push({
            id: country,
            label: country,
            count,
            level: 'country',
            filter: { country },
        });
        const countryKey = (0, normalize_key_1.normalizeDestinationKey)(country);
        const variants = regionVariants.get(countryKey);
        const regionsForCountry = [...regionCounts.entries()]
            .filter(([key]) => key.startsWith(`${country}|`))
            .map(([key, regionCount]) => {
            const regionKey = key.slice(country.length + 1);
            const label = variants
                ? [...variants.values()].find((entry) => (0, normalize_key_1.normalizeDestinationKey)(entry.label) === regionKey)?.label
                : undefined;
            return {
                regionKey,
                label: label ?? regionKey,
                count: regionCount,
            };
        })
            .filter((entry) => entry.count > 0)
            .sort((left, right) => left.label.localeCompare(right.label, 'nl'));
        for (const { label, count: regionCount } of regionsForCountry) {
            items.push({
                id: `${country}|${(0, normalize_key_1.normalizeDestinationKey)(label)}`,
                label,
                count: regionCount,
                level: 'region',
                filter: { country, region: label },
            });
        }
    }
    return items;
}
function buildFilterOptions(searchList) {
    var _a;
    const regionsByCountry = {};
    for (const item of searchList) {
        if (item.level === 'country') {
            regionsByCountry[item.filter.country] = [];
        }
        if (item.level === 'region' && item.filter.region) {
            regionsByCountry[_a = item.filter.country] ?? (regionsByCountry[_a] = []);
            regionsByCountry[item.filter.country].push(item.filter.region);
        }
    }
    return {
        countries: searchList.filter((item) => item.level === 'country').map((item) => item.label),
        regionsByCountry,
        boardTypes: [],
        departureAirports: [],
    };
}
function applyCountryQualityFilter(searchList, indexEligibleOffers) {
    const hiddenCountries = new Set();
    for (const item of searchList) {
        if (item.level !== 'country') {
            continue;
        }
        const stats = (0, destination_index_eligibility_1.getCountryQualityStats)(indexEligibleOffers, item.filter.country);
        if ((0, destination_index_eligibility_1.shouldHideCountryFromDestinationIndex)(stats)) {
            hiddenCountries.add(item.filter.country);
        }
    }
    const hiddenRegions = searchList
        .filter((item) => item.level === 'region' && hiddenCountries.has(item.filter.country))
        .map((item) => `${item.filter.country} / ${item.label}`);
    const filteredSearchList = searchList.filter((item) => {
        if (item.level === 'country') {
            return !hiddenCountries.has(item.filter.country);
        }
        return !hiddenCountries.has(item.filter.country);
    });
    return {
        searchList: filteredSearchList,
        hiddenCountries: [...hiddenCountries].sort((left, right) => left.localeCompare(right, 'nl')),
        hiddenRegions,
    };
}
function buildDestinationIndexFromStoredOffers(storedOffers, filterExtras) {
    const canonicalStoredOffers = (0, canonicalize_stored_offer_1.canonicalizeStoredOffers)(storedOffers);
    const indexEligibleStoredOffers = canonicalStoredOffers.filter(destination_index_eligibility_1.isDestinationIndexEligible);
    const offers = indexEligibleStoredOffers.map(normalize_offer_1.normalizeOffer);
    const searchList = buildSearchList(offers);
    const verifiedSearchList = searchList
        .map((item) => ({
        ...item,
        count: (0, match_destination_1.countOffersForDestination)(offers, item.filter),
    }))
        .filter((item) => item.count > 0);
    const qualityFiltered = applyCountryQualityFilter(verifiedSearchList, indexEligibleStoredOffers);
    const finalSearchList = qualityFiltered.searchList.filter((item) => item.count > 0);
    const stats = {
        countries: finalSearchList.filter((item) => item.level === 'country').length,
        regions: finalSearchList.filter((item) => item.level === 'region').length,
        offers: canonicalStoredOffers.length,
    };
    const filterOptions = {
        ...buildFilterOptions(finalSearchList),
        boardTypes: filterExtras?.boardTypes ?? [],
        departureAirports: filterExtras?.departureAirports ?? [],
    };
    return {
        index: {
            version: 2,
            generatedAt: new Date().toISOString(),
            stats,
            filterOptions,
            searchList: finalSearchList,
        },
        report: {
            excludedProductOffers: canonicalStoredOffers.length - indexEligibleStoredOffers.length,
            hiddenCountries: qualityFiltered.hiddenCountries,
            hiddenRegions: qualityFiltered.hiddenRegions,
        },
    };
}
function collectRemovedDestinations(previousSearchList, nextSearchList) {
    const nextIds = new Set(nextSearchList.map((item) => item.id));
    return previousSearchList
        .filter((item) => !nextIds.has(item.id))
        .map((item) => (item.level === 'region' ? `${item.filter.country} / ${item.label}` : item.label))
        .sort((left, right) => left.localeCompare(right, 'nl'));
}
