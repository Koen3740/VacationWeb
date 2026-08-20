import fs from 'node:fs';
import path from 'node:path';
import { getEnabledFeeds, type FeedManifestEntry } from '../lib/feeds/feed-registry';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import { importXmlByProfile, isKnownImporterProfile } from '../lib/feeds/importer-router';
import { mergeCorendonOffers, annotateCorendonSource } from '../lib/feeds/importers/corendon-merge';
import { mergeSunwebOffers, annotateSunwebSource } from '../lib/feeds/importers/sunweb-merge';
import { StoredOffer } from '../lib/feeds/types/stored-offer';
import { publishLocalRuntimeCatalog } from '../lib/offers/write-runtime-catalog';

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
    const imported = importXmlByProfile(feed.profile, xml);
    const offers =
      feed.profile === 'corendon'
        ? annotateCorendonSource(imported, feed.id)
        : feed.profile === 'sunweb'
          ? annotateSunwebSource(imported, feed.id)
          : imported;
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

function main(): void {
  const enabledFeeds = getEnabledFeeds().sort((a, b) => (a.priority ?? 1000) - (b.priority ?? 1000));

  if (enabledFeeds.length === 0) {
    console.error('✖ No enabled feeds in config/feed-manifest.json — refusing to refresh dataset');
    process.exitCode = 1;
    return;
  }

  const results: FeedImportResult[] = enabledFeeds.map(importFeed);
  const failed = results.filter((result) => result.error);

  // TD-015 safety: never publish a partial refresh when any enabled feed failed.
  // Keeps the previous local offers.json (and therefore R2 until a successful upload).
  if (failed.length > 0) {
    console.error('✖ Import aborted — one or more enabled feeds failed. Local offers.json was NOT overwritten.');
    for (const result of failed) {
      console.error(`  - ${result.feed.id}: ${result.error}`);
    }
    process.exitCode = 1;
    return;
  }

  const collected: StoredOffer[] = [];

  for (const result of results) {
    collected.push(...result.offers);
    console.log(`✔ ${result.feed.id} (${result.feed.provider}/${result.feed.profile}): ${result.offers.length}`);
  }

  const corendon = collected.filter((offer) => offer.provider === 'Corendon');
  const sunweb = collected.filter((offer) => offer.provider === 'Sunweb');
  const others = collected.filter(
    (offer) => offer.provider !== 'Corendon' && offer.provider !== 'Sunweb',
  );
  const corendonMerged = mergeCorendonOffers(corendon);
  const sunwebMerged = mergeSunwebOffers(sunweb);
  const { offers, dropped } = dedupeByExternalId([
    ...corendonMerged.offers,
    ...sunwebMerged.offers,
    ...others,
  ]);

  if (offers.length === 0) {
    console.error('✖ Import produced zero offers — refusing to overwrite local offers.json');
    process.exitCode = 1;
    return;
  }

  for (const offer of offers) {
    assertRequiredProvider(offer);
  }

  const duplicateExternalIds = findDuplicateExternalIds(offers);

  if (duplicateExternalIds.length > 0) {
    console.error(
      `✖ Duplicate externalId values detected after provider prefixes: ${duplicateExternalIds.slice(0, 5).join(', ')}`,
    );
    process.exitCode = 1;
    return;
  }

  const published = publishLocalRuntimeCatalog(offers);

  const providerCounts = countByProvider(offers);

  console.log(`✔ ${published.offerCount} aanbiedingen geïmporteerd naar ${FEED_PATHS.offers}`);
  console.log(
    `✔ flight-package eligibility: ${published.eligibility.input} → ${published.eligibility.kept} (excluded ${published.eligibility.excluded})`,
  );
  console.log(`✔ compact runtime: ${(published.runtimeBytes / 1_000_000).toFixed(1)} MB`);
  console.log(`✔ offer-detail sidecar: ${FEED_PATHS.offerDetails} (${(published.detailBytes / 1_000_000).toFixed(1)} MB, ${published.detailCount} records)`);
  console.log(`✔ filter-opties geschreven naar ${FEED_PATHS.filterOptions}`);
  console.log(`  - feeds enabled: ${enabledFeeds.length}`);
  console.log(`  - feeds imported: ${results.length}`);
  console.log(`  - feeds failed: 0`);
  console.log(`  - Corendon input: ${corendonMerged.stats.input}`);
  console.log(`  - Corendon intra-listing duplicates dropped: ${corendonMerged.stats.duplicatesDropped}`);
  console.log(`  - Corendon unique bookable offers: ${corendonMerged.stats.unique}`);
  console.log(`  - Corendon listings retained: ${corendonMerged.stats.listingsRetained}`);
  console.log(`  - Corendon without fragment (kept): ${corendonMerged.stats.keptWithoutBookableKey}`);
  console.log(`  - Corendon BE-NL listings: ${corendonMerged.stats.beNlListings}`);
  console.log(`  - Corendon BE-FR listings: ${corendonMerged.stats.beFrListings}`);
  console.log(`  - Corendon NL listings: ${corendonMerged.stats.nlListings}`);
  console.log(`  - Corendon hotels with content merge: ${corendonMerged.stats.hotelContentMerged}`);
  console.log(`  - Sunweb input: ${sunwebMerged.stats.input}`);
  console.log(`  - Sunweb unique bookable offers: ${sunwebMerged.stats.unique}`);
  console.log(`  - Sunweb listings retained: ${sunwebMerged.stats.listingsRetained}`);
  console.log(`  - Sunweb without bookable key (kept): ${sunwebMerged.stats.keptWithoutBookableKey}`);
  console.log(`  - Sunweb intra-listing duplicates dropped: ${sunwebMerged.stats.duplicatesDropped}`);
  console.log(`  - dedupe dropped: ${dropped}`);
  for (const [provider, count] of Object.entries(providerCounts).sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`  - ${provider}: ${count}`);
  }
  console.log(`  - duplicate externalId: ${duplicateExternalIds.length}`);
}

main();
