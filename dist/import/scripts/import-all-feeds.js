"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const normalize_offer_1 = require("../lib/feeds/canonical/normalize-offer");
const derive_filter_options_1 = require("../lib/offers/derive-filter-options");
const feed_paths_1 = require("../lib/feeds/feed-paths");
const corendon_1 = require("../lib/feeds/importers/corendon");
const prijsvrij_1 = require("../lib/feeds/importers/prijsvrij");
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
const corendonXml = node_fs_1.default.readFileSync(feed_paths_1.FEED_PATHS.corendon, 'utf8');
const prijsvrijXml = node_fs_1.default.readFileSync(feed_paths_1.FEED_PATHS.prijsvrij, 'utf8');
const corendonOffers = (0, corendon_1.importCorendonXml)(corendonXml);
const prijsvrijOffers = (0, prijsvrij_1.importPrijsvrijXml)(prijsvrijXml);
const offers = [...corendonOffers, ...prijsvrijOffers];
for (const offer of offers) {
    assertRequiredProvider(offer);
}
const duplicateExternalIds = findDuplicateExternalIds(offers);
if (duplicateExternalIds.length > 0) {
    throw new Error(`Duplicate externalId values detected after provider prefixes: ${duplicateExternalIds.slice(0, 5).join(', ')}`);
}
node_fs_1.default.writeFileSync(feed_paths_1.FEED_PATHS.offers, JSON.stringify(offers, null, 2));
const filterOptions = (0, derive_filter_options_1.deriveFilterOptions)(offers.map(normalize_offer_1.normalizeOffer));
node_fs_1.default.writeFileSync(feed_paths_1.FEED_PATHS.filterOptions, JSON.stringify(filterOptions, null, 2));
console.log(`✔ ${offers.length} aanbiedingen geïmporteerd naar ${feed_paths_1.FEED_PATHS.offers}`);
console.log(`✔ filter-opties geschreven naar ${feed_paths_1.FEED_PATHS.filterOptions}`);
console.log(`  - ${providers_1.PROVIDERS.corendon.name}: ${corendonOffers.length}`);
console.log(`  - ${providers_1.PROVIDERS.prijsvrij.name}: ${prijsvrijOffers.length}`);
console.log(`  - duplicate externalId: ${duplicateExternalIds.length}`);
