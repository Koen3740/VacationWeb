"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const offers_json_1 = __importDefault(require("../data/offers.json"));
const normalize_offer_1 = require("../lib/feeds/canonical/normalize-offer");
const build_destination_index_1 = require("../lib/destinations/build-destination-index");
const canonicalize_stored_offer_1 = require("../lib/destinations/canonicalize-stored-offer");
const match_destination_1 = require("../lib/destinations/match-destination");
const normalize_key_1 = require("../lib/destinations/normalize-key");
const filtering_1 = require("../lib/search/filtering");
const issues = [];
function addIssue(code, message) {
    issues.push({ code, message });
}
const index = JSON.parse(node_fs_1.default.readFileSync(node_path_1.default.join(process.cwd(), 'data', 'destination-index.json'), 'utf8'));
const canonicalStoredOffers = (0, canonicalize_stored_offer_1.canonicalizeStoredOffers)(offers_json_1.default);
const normalizedOffers = canonicalStoredOffers.map(normalize_offer_1.normalizeOffer);
const rebuiltIndex = (0, build_destination_index_1.buildDestinationIndexFromStoredOffers)(canonicalStoredOffers);
if (JSON.stringify(index.filterOptions.countries) !== JSON.stringify(rebuiltIndex.filterOptions.countries)) {
    addIssue('filter-countries-mismatch', 'filter-options countries wijkt af van herbouwde bestemmingsindex');
}
if (JSON.stringify(index.filterOptions.regionsByCountry) !== JSON.stringify(rebuiltIndex.filterOptions.regionsByCountry)) {
    addIssue('filter-regions-mismatch', 'filter-options regionsByCountry wijkt af van herbouwde bestemmingsindex');
}
for (const item of index.searchList) {
    if (item.count <= 0) {
        addIssue('zero-count-item', `Bestemming met 0 aanbod: ${item.id}`);
    }
    const matchCount = (0, match_destination_1.countOffersForDestination)(normalizedOffers, item.filter);
    if (matchCount !== item.count) {
        addIssue('dropdown-result-mismatch', `${item.label} (${item.id}): dropdown=${item.count}, filter=${matchCount}`);
    }
    const filtered = (0, filtering_1.filterOffers)(normalizedOffers, {
        country: item.filter.country,
        region: item.filter.region,
    });
    if (filtered.length !== item.count) {
        addIssue('search-result-mismatch', `${item.label} (${item.id}): dropdown=${item.count}, search=${filtered.length}`);
    }
}
const countryKeys = new Map();
for (const item of index.searchList.filter((entry) => entry.level === 'country')) {
    const key = (0, normalize_key_1.normalizeDestinationKey)(item.label);
    if (countryKeys.has(key) && countryKeys.get(key) !== item.label) {
        addIssue('duplicate-country', `Dubbel land: ${countryKeys.get(key)} / ${item.label}`);
    }
    countryKeys.set(key, item.label);
}
const regionKeysByCountry = new Map();
for (const item of index.searchList.filter((entry) => entry.level === 'region')) {
    const countryKey = (0, normalize_key_1.normalizeDestinationKey)(item.filter.country);
    const regionKey = (0, normalize_key_1.normalizeDestinationKey)(item.label);
    const scope = regionKeysByCountry.get(countryKey) ?? new Map();
    if (scope.has(regionKey) && scope.get(regionKey) !== item.label) {
        addIssue('duplicate-region', `Dubbele regio: ${scope.get(regionKey)} / ${item.label} (${item.filter.country})`);
    }
    scope.set(regionKey, item.label);
    regionKeysByCountry.set(countryKey, scope);
}
for (const item of index.searchList) {
    if ((0, normalize_key_1.isExcludedCountry)(item.filter.country)) {
        addIssue('excluded-country-present', `Uitgesloten land in index: ${item.filter.country}`);
    }
}
const rawCountryKeys = new Map();
for (const offer of canonicalStoredOffers) {
    if (!offer.country) {
        continue;
    }
    const key = (0, normalize_key_1.normalizeDestinationKey)(offer.country);
    const labels = rawCountryKeys.get(key) ?? new Set();
    labels.add(offer.country);
    rawCountryKeys.set(key, labels);
}
for (const [key, labels] of rawCountryKeys.entries()) {
    if (labels.size > 1) {
        addIssue('duplicate-raw-country', `Dubbele landnaam in offers.json: ${[...labels].join(' / ')} (${key})`);
    }
}
for (const country of index.filterOptions.countries) {
    if (!index.searchList.some((item) => item.level === 'country' && item.label === country)) {
        addIssue('filter-not-in-search-list', `Filterland ontbreekt in zoeklijst: ${country}`);
    }
}
for (const item of index.searchList) {
    if (item.level === 'region' && item.filter.region) {
        const regions = index.filterOptions.regionsByCountry[item.filter.country] ?? [];
        if (!regions.includes(item.filter.region)) {
            addIssue('search-not-in-filter', `Regio ontbreekt in filter-options: ${item.filter.country} / ${item.filter.region}`);
        }
    }
}
const report = {
    generatedAt: new Date().toISOString(),
    passed: issues.length === 0,
    stats: index.stats,
    issueCount: issues.length,
    issues,
};
node_fs_1.default.writeFileSync(node_path_1.default.join(process.cwd(), 'data', 'destination-index-validation-report.json'), JSON.stringify(report, null, 2));
console.log(`Bestemmingsindex validatie: ${issues.length === 0 ? 'GESLAAGD' : 'GEFAALD'}`);
console.log(`  - landen: ${index.stats.countries}`);
console.log(`  - regio's: ${index.stats.regions}`);
console.log(`  - offers: ${index.stats.offers}`);
if (issues.length > 0) {
    for (const issue of issues.slice(0, 20)) {
        console.error(`  ✖ ${issue.code}: ${issue.message}`);
    }
    process.exit(1);
}
console.log('✔ Alle controles geslaagd');
