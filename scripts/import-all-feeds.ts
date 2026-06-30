import fs from 'node:fs';
import { normalizeOffer } from '../lib/feeds/canonical/normalize-offer';
import { deriveFilterOptions } from '../lib/offers/derive-filter-options';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import { importCorendonXml } from '../lib/feeds/importers/corendon';
import { importPrijsvrijXml } from '../lib/feeds/importers/prijsvrij';
import { PROVIDERS } from '../lib/feeds/providers';
import { StoredOffer } from '../lib/feeds/types/stored-offer';

function assertRequiredProvider(offer: StoredOffer): void {
  if (!offer.provider || offer.provider.trim() === '') {
    throw new Error(`Offer ${offer.externalId} is missing required provider`);
  }
}

function findDuplicateExternalIds(offers: StoredOffer[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const offer of offers) {
    if (seen.has(offer.externalId)) {
      duplicates.add(offer.externalId);
    }

    seen.add(offer.externalId);
  }

  return [...duplicates];
}

const corendonXml = fs.readFileSync(FEED_PATHS.corendon, 'utf8');
const prijsvrijXml = fs.readFileSync(FEED_PATHS.prijsvrij, 'utf8');

const corendonOffers = importCorendonXml(corendonXml);
const prijsvrijOffers = importPrijsvrijXml(prijsvrijXml);
const offers = [...corendonOffers, ...prijsvrijOffers];

for (const offer of offers) {
  assertRequiredProvider(offer);
}

const duplicateExternalIds = findDuplicateExternalIds(offers);

if (duplicateExternalIds.length > 0) {
  throw new Error(
    `Duplicate externalId values detected after provider prefixes: ${duplicateExternalIds.slice(0, 5).join(', ')}`,
  );
}

fs.writeFileSync(FEED_PATHS.offers, JSON.stringify(offers, null, 2));

const filterOptions = deriveFilterOptions(offers.map(normalizeOffer));
fs.writeFileSync(FEED_PATHS.filterOptions, JSON.stringify(filterOptions, null, 2));

console.log(`✔ ${offers.length} aanbiedingen geïmporteerd naar ${FEED_PATHS.offers}`);
console.log(`✔ filter-opties geschreven naar ${FEED_PATHS.filterOptions}`);
console.log(`  - ${PROVIDERS.corendon.name}: ${corendonOffers.length}`);
console.log(`  - ${PROVIDERS.prijsvrij.name}: ${prijsvrijOffers.length}`);
console.log(`  - duplicate externalId: ${duplicateExternalIds.length}`);
