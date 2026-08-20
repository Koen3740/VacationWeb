import fs from 'node:fs';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import type { StoredOffer } from '../lib/feeds/types/stored-offer';
import { isCompactStoredOffer, type OfferDetailRecord } from '../lib/offers/compact-runtime';
import { publishLocalRuntimeCatalog } from '../lib/offers/write-runtime-catalog';

function reconstructFromSidecar(runtime: StoredOffer[]): StoredOffer[] {
  if (!fs.existsSync(FEED_PATHS.offerDetails)) {
    throw new Error(
      'offers.json is already compact and offers.detail.json is missing — cannot rebuild',
    );
  }

  const parsed = JSON.parse(fs.readFileSync(FEED_PATHS.offerDetails, 'utf8')) as Record<
    string,
    OfferDetailRecord
  >;

  return runtime.map((offer) => ({
    ...offer,
    ...(parsed[offer.externalId] ?? {}),
  }));
}

function main(): void {
  if (!fs.existsSync(FEED_PATHS.offers)) {
    console.error(`✖ Local catalog not found: ${FEED_PATHS.offers}`);
    process.exitCode = 1;
    return;
  }

  const startedAt = Date.now();
  const raw = fs.readFileSync(FEED_PATHS.offers, 'utf8');
  const parsed = JSON.parse(raw) as unknown;

  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error('✖ offers.json must be a non-empty JSON array');
    process.exitCode = 1;
    return;
  }

  const offers = parsed as StoredOffer[];
  const compactCount = offers.filter(isCompactStoredOffer).length;
  let sourceOffers: StoredOffer[];

  try {
    sourceOffers =
      compactCount === offers.length
        ? reconstructFromSidecar(offers)
        : offers;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`✖ ${message}`);
    process.exitCode = 1;
    return;
  }

  const published = publishLocalRuntimeCatalog(sourceOffers);
  const durationMs = Date.now() - startedAt;

  console.log(`✔ compact runtime catalog written`);
  console.log(`  - records: ${published.offerCount.toLocaleString('nl-NL')}`);
  console.log(
    `  - flight-package eligibility: ${published.eligibility.input.toLocaleString('nl-NL')} → ${published.eligibility.kept.toLocaleString('nl-NL')} (excluded ${published.eligibility.excluded.toLocaleString('nl-NL')})`,
  );
  console.log(`  - runtime: ${FEED_PATHS.offers} (${(published.runtimeBytes / 1_000_000).toFixed(1)} MB)`);
  console.log(`  - details: ${FEED_PATHS.offerDetails} (${(published.detailBytes / 1_000_000).toFixed(1)} MB, ${published.detailCount.toLocaleString('nl-NL')} records)`);
  console.log(`  - filter-options: ${FEED_PATHS.filterOptions} (${published.filterOptionsBytes.toLocaleString('nl-NL')} bytes)`);
  console.log(`  - duration: ${durationMs.toLocaleString('nl-NL')} ms`);
}

main();
