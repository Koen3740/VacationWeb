import fs from 'node:fs';
import path from 'node:path';
import { normalizeOffer } from '../lib/feeds/canonical/normalize-offer';
import { getEnabledFeeds, type FeedManifestEntry } from '../lib/feeds/feed-registry';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import { importXmlByProfile, isKnownImporterProfile } from '../lib/feeds/importer-router';
import { deriveFilterOptions } from '../lib/offers/derive-filter-options';
import { StoredOffer } from '../lib/feeds/types/stored-offer';

type FeedImportResult = {
  feed: FeedManifestEntry;
  offers: StoredOffer[];
  error?: string;
};

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

function dedupeByExternalId(offers: StoredOffer[]): { offers: StoredOffer[]; dropped: number } {
  const seen = new Set<string>();
  const unique: StoredOffer[] = [];
  let dropped = 0;

  for (const offer of offers) {
    if (seen.has(offer.externalId)) {
      dropped += 1;
      continue;
    }

    seen.add(offer.externalId);
    unique.push(offer);
  }

  return { offers: unique, dropped };
}

function resolveFeedPath(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(process.cwd(), relativePath);
}

function validateFeedForImport(feed: FeedManifestEntry): string | null {
  if (!feed.profile || feed.profile.trim() === '') {
    return `Feed "${feed.id}": missing profile`;
  }

  if (!isKnownImporterProfile(feed.profile)) {
    return `Feed "${feed.id}": no importer for profile "${feed.profile}"`;
  }

  if (!feed.source?.path || feed.source.path.trim() === '') {
    return `Feed "${feed.id}": missing source.path`;
  }

  const absolutePath = resolveFeedPath(feed.source.path);

  if (!fs.existsSync(absolutePath)) {
    return `Feed "${feed.id}": source.path does not exist (${feed.source.path})`;
  }

  return null;
}

function importFeed(feed: FeedManifestEntry): FeedImportResult {
  const validationError = validateFeedForImport(feed);

  if (validationError) {
    console.error(`✖ ${validationError}`);
    return { feed, offers: [], error: validationError };
  }

  try {
    const absolutePath = resolveFeedPath(feed.source.path);
    const xml = fs.readFileSync(absolutePath, 'utf8');
    const offers = importXmlByProfile(feed.profile, xml);
    return { feed, offers };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const errorText = `Feed "${feed.id}": import failed — ${message}`;
    console.error(`✖ ${errorText}`);
    return { feed, offers: [], error: errorText };
  }
}

function countByProvider(offers: StoredOffer[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const offer of offers) {
    counts[offer.provider] = (counts[offer.provider] ?? 0) + 1;
  }

  return counts;
}

const enabledFeeds = getEnabledFeeds().sort((a, b) => (a.priority ?? 1000) - (b.priority ?? 1000));
const results: FeedImportResult[] = enabledFeeds.map(importFeed);
const failed = results.filter((result) => result.error);
const collected: StoredOffer[] = [];

for (const result of results) {
  if (result.error) {
    continue;
  }

  collected.push(...result.offers);
  console.log(`✔ ${result.feed.id} (${result.feed.provider}/${result.feed.profile}): ${result.offers.length}`);
}

const { offers, dropped } = dedupeByExternalId(collected);

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

const providerCounts = countByProvider(offers);

console.log(`✔ ${offers.length} aanbiedingen geïmporteerd naar ${FEED_PATHS.offers}`);
console.log(`✔ filter-opties geschreven naar ${FEED_PATHS.filterOptions}`);
console.log(`  - feeds enabled: ${enabledFeeds.length}`);
console.log(`  - feeds imported: ${results.length - failed.length}`);
console.log(`  - feeds skipped/failed: ${failed.length}`);
console.log(`  - dedupe dropped: ${dropped}`);
for (const [provider, count] of Object.entries(providerCounts).sort(([a], [b]) => a.localeCompare(b))) {
  console.log(`  - ${provider}: ${count}`);
}
console.log(`  - duplicate externalId: ${duplicateExternalIds.length}`);
