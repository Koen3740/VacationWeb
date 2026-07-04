"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const build_destination_index_1 = require("../lib/destinations/build-destination-index");
const canonicalize_stored_offer_1 = require("../lib/destinations/canonicalize-stored-offer");
const normalize_key_1 = require("../lib/destinations/normalize-key");
const normalize_offer_1 = require("../lib/feeds/canonical/normalize-offer");
const derive_filter_options_1 = require("../lib/offers/derive-filter-options");
const feed_paths_1 = require("../lib/feeds/feed-paths");
const corendon_1 = require("../lib/feeds/importers/corendon");
const prijsvrij_1 = require("../lib/feeds/importers/prijsvrij");
const traveldeal_1 = require("../lib/feeds/importers/traveldeal");
const providers_1 = require("../lib/feeds/providers");
function assertRequiredProvider(offer) {
    if (!offer.provider || offer.provider.trim() === '') {
        throw new Error(`Offer ${offer.externalId} is missing required provider`);
    }
}
function findDuplicateExternalIds(offers) {
    const seen = new Set();
    const duplicates = new Set();
    for (const offer of offers) {
        if (seen.has(offer.externalId)) {
            duplicates.add(offer.externalId);
        }
        seen.add(offer.externalId);
    }
    return [...duplicates];
}
function loadPreviousSearchList() {
    if (!node_fs_1.default.existsSync(feed_paths_1.FEED_PATHS.destinationIndex)) {
        return [];
    }
    const previous = JSON.parse(node_fs_1.default.readFileSync(feed_paths_1.FEED_PATHS.destinationIndex, 'utf8'));
    return previous.searchList ?? [];
}
const corendonXml = node_fs_1.default.readFileSync(feed_paths_1.FEED_PATHS.corendon, 'utf8');
const prijsvrijXml = node_fs_1.default.readFileSync(feed_paths_1.FEED_PATHS.prijsvrij, 'utf8');
const traveldealXml = node_fs_1.default.readFileSync(feed_paths_1.FEED_PATHS.traveldeal, 'utf8');
const corendonOffers = (0, corendon_1.importCorendonXml)(corendonXml);
const prijsvrijOffers = (0, prijsvrij_1.importPrijsvrijXml)(prijsvrijXml);
const traveldealOffers = (0, traveldeal_1.importTraveldealXml)(traveldealXml);
const mergedOffers = [...corendonOffers, ...prijsvrijOffers, ...traveldealOffers];
for (const offer of mergedOffers) {
    assertRequiredProvider(offer);
}
const duplicateExternalIds = findDuplicateExternalIds(mergedOffers);
if (duplicateExternalIds.length > 0) {
    throw new Error(`Duplicate externalId values detected after provider prefixes: ${duplicateExternalIds.slice(0, 5).join(', ')}`);
}
const previousSearchList = loadPreviousSearchList();
const offers = (0, canonicalize_stored_offer_1.canonicalizeStoredOffers)(mergedOffers);
const filterExtras = (0, derive_filter_options_1.deriveFilterExtras)(offers.map(normalize_offer_1.normalizeOffer));
const { index: destinationIndex, report } = (0, build_destination_index_1.buildDestinationIndexFromStoredOffers)(offers, filterExtras);
const countryMerges = (0, canonicalize_stored_offer_1.collectCountryMergeReport)(mergedOffers, offers);
const removedDestinations = (0, build_destination_index_1.collectRemovedDestinations)(previousSearchList, destinationIndex.searchList);
node_fs_1.default.writeFileSync(feed_paths_1.FEED_PATHS.offers, JSON.stringify(offers, null, 2));
node_fs_1.default.writeFileSync(feed_paths_1.FEED_PATHS.destinationIndex, JSON.stringify(destinationIndex, null, 2));
node_fs_1.default.writeFileSync(feed_paths_1.FEED_PATHS.filterOptions, JSON.stringify(destinationIndex.filterOptions, null, 2));
console.log(`✔ ${offers.length} aanbiedingen geïmporteerd naar ${feed_paths_1.FEED_PATHS.offers}`);
console.log(`✔ bestemmingsindex geschreven naar ${feed_paths_1.FEED_PATHS.destinationIndex}`);
console.log(`✔ filter-opties geschreven naar ${feed_paths_1.FEED_PATHS.filterOptions}`);
console.log(`  - ${providers_1.PROVIDERS.corendon.name}: ${corendonOffers.length}`);
console.log(`  - ${providers_1.PROVIDERS.prijsvrij.name}: ${prijsvrijOffers.length}`);
console.log(`  - ${providers_1.PROVIDERS.traveldeal.name}: ${traveldealOffers.length}`);
console.log(`  - duplicate externalId: ${duplicateExternalIds.length}`);
console.log(`  - landen: ${destinationIndex.stats.countries}`);
console.log(`  - regio's: ${destinationIndex.stats.regions}`);
console.log(`  - bestemmingen: ${destinationIndex.stats.countries + destinationIndex.stats.regions}`);
console.log(`  - uitgesloten producten (index): ${report.excludedProductOffers}`);
console.log(`  - verborgen landen (kwaliteit): ${report.hiddenCountries.length}`);
const importReport = {
    canonicalCountryAliases: normalize_key_1.COUNTRY_CANONICAL_KEY,
    canonicalCountryLabels: normalize_key_1.COUNTRY_LABEL_BY_KEY,
    countryMerges,
    hiddenCountries: report.hiddenCountries,
    removedDestinations,
    excludedProductOffers: report.excludedProductOffers,
    stats: destinationIndex.stats,
};
node_fs_1.default.writeFileSync(`${feed_paths_1.FEED_PATHS.offers.replace('offers.json', 'import-shift7-report.json')}`, JSON.stringify(importReport, null, 2));
console.log(`✔ rapport geschreven naar data/import-shift7-report.json`);
