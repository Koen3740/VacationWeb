import fs from 'node:fs';
import path from 'node:path';
import { getEnabledFeeds } from '../lib/feeds/feed-registry';
import { importCorendonXml } from '../lib/feeds/importers/corendon';
import {
  buildCorendonBookableKey,
  mergeCorendonOffers,
} from '../lib/feeds/importers/corendon-merge';

function resolveFeedPath(relativePath: string): string {
  return path.isAbsolute(relativePath) ? relativePath : path.join(process.cwd(), relativePath);
}

function main(): void {
  const corendonFeeds = getEnabledFeeds()
    .filter((feed) => feed.profile === 'corendon')
    .sort((a, b) => (a.priority ?? 1000) - (b.priority ?? 1000));

  if (corendonFeeds.length < 3) {
    console.error(`✖ Expected 3 enabled Corendon feeds, found ${corendonFeeds.length}`);
    process.exitCode = 1;
    return;
  }

  const perFeed: Array<{
    id: string;
    rows: number;
    uniqueBookable: number;
    uniqueHotels: number;
    avgImages: number;
  }> = [];
  const all = [];

  for (const feed of corendonFeeds) {
    const absolutePath = resolveFeedPath(feed.source.path);
    if (!fs.existsSync(absolutePath)) {
      console.error(`✖ Missing ${feed.id}: ${feed.source.path}`);
      process.exitCode = 1;
      return;
    }
    const xml = fs.readFileSync(absolutePath, 'utf8');
    const offers = importCorendonXml(xml, feed.id);
    const keys = new Set(
      offers.map((offer) => buildCorendonBookableKey(offer.deepLink)).filter(Boolean),
    );
    const hotels = new Set(
      offers.map((offer) => offer.accommodation?.toLowerCase()).filter(Boolean),
    );
    const imageSum = offers.reduce((sum, offer) => sum + (offer.images?.length ?? 0), 0);
    perFeed.push({
      id: feed.id,
      rows: offers.length,
      uniqueBookable: keys.size,
      uniqueHotels: hotels.size,
      avgImages: offers.length ? imageSum / offers.length : 0,
    });
    all.push(...offers);
    console.log(
      `✔ ${feed.id}: rows=${offers.length} bookable=${keys.size} hotels=${hotels.size} avgImages=${(imageSum / Math.max(offers.length, 1)).toFixed(2)}`,
    );
  }

  const naive = all.length;
  const firstWinsKeys = new Set<string>();
  let firstWinsDropped = 0;
  for (const offer of all) {
    const key = buildCorendonBookableKey(offer.deepLink);
    if (!key) {
      continue;
    }
    if (firstWinsKeys.has(key)) {
      firstWinsDropped += 1;
      continue;
    }
    firstWinsKeys.add(key);
  }

  const { offers, stats } = mergeCorendonOffers(all);
  const multiListing = offers.filter((offer) => (offer.providerListings?.length ?? 0) > 1).length;
  const imageSum = offers.reduce((sum, offer) => sum + (offer.images?.length ?? 0), 0);
  const rich = offers.filter((offer) => (offer.images?.length ?? 0) > 1).length;
  const withLongCopy = offers.filter((offer) => (offer.descriptionLong ?? '').trim().length > 0).length;
  const hotels = new Set(
    offers
      .map((offer) => offer.accommodation?.trim().toLowerCase())
      .filter((value): value is string => Boolean(value)),
  );

  const keysBySource = new Map<string, Set<string>>();
  for (const offer of all) {
    const key = buildCorendonBookableKey(offer.deepLink);
    const source = offer.feedSourceId ?? 'unknown';
    if (!key) {
      continue;
    }
    const set = keysBySource.get(source) ?? new Set<string>();
    set.add(key);
    keysBySource.set(source, set);
  }
  const benlKeys = keysBySource.get('corendon-benl') ?? new Set<string>();
  const befrKeys = keysBySource.get('corendon-befr') ?? new Set<string>();
  const nlKeys = keysBySource.get('corendon-nl') ?? new Set<string>();
  const befrOnly = [...befrKeys].filter((key) => !benlKeys.has(key) && !nlKeys.has(key)).length;
  const nlOnly = [...nlKeys].filter((key) => !benlKeys.has(key) && !befrKeys.has(key)).length;
  const benlOnly = [...benlKeys].filter((key) => !befrKeys.has(key) && !nlKeys.has(key)).length;

  console.log('--- union ---');
  console.log(`  naive rows: ${naive}`);
  console.log(`  first-wins unique (legacy): ${firstWinsKeys.size} (would drop ${firstWinsDropped})`);
  console.log(`  union unique bookable: ${stats.unique}`);
  console.log(`  listings retained: ${stats.listingsRetained}`);
  console.log(`  intra-listing duplicates dropped: ${stats.duplicatesDropped}`);
  console.log(`  offers with multiple listings: ${multiListing}`);
  console.log(`  BE-NL listings: ${stats.beNlListings}`);
  console.log(`  BE-FR listings: ${stats.beFrListings}`);
  console.log(`  NL listings: ${stats.nlListings}`);
  console.log(`  unique hotels (accommodation): ${hotels.size}`);
  console.log(`  hotels content-merged: ${stats.hotelContentMerged}`);
  console.log(`  bookable keys only in BE-NL: ${benlOnly}`);
  console.log(`  bookable keys only in BE-FR: ${befrOnly}`);
  console.log(`  bookable keys only in NL: ${nlOnly}`);
  console.log(`  avg images after union: ${(imageSum / Math.max(offers.length, 1)).toFixed(2)}`);
  console.log(`  offers with gallery (>1 image): ${rich}`);
  console.log(`  offers with descriptionLong: ${withLongCopy}`);

  if (stats.beFrListings === 0 || stats.beNlListings === 0 || stats.nlListings === 0) {
    console.error('✖ One or more Corendon sources produced zero listings');
    process.exitCode = 1;
    return;
  }
  if (stats.unique <= firstWinsKeys.size && stats.listingsRetained <= stats.unique) {
    console.error('✖ Union did not retain extra listings versus first-wins');
    process.exitCode = 1;
  }
}

main();
