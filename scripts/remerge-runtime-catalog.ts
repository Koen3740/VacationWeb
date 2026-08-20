import fs from 'node:fs';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import type { StoredOffer } from '../lib/feeds/types/stored-offer';
import { mergeCorendonOffers } from '../lib/feeds/importers/corendon-merge';
import { mergeSunwebOffers } from '../lib/feeds/importers/sunweb-merge';
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

function loadSourceOffers(): StoredOffer[] {
  if (!fs.existsSync(FEED_PATHS.offers)) {
    throw new Error(`Local catalog not found: ${FEED_PATHS.offers}`);
  }
  const parsed = JSON.parse(fs.readFileSync(FEED_PATHS.offers, 'utf8')) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('offers.json must be a non-empty JSON array');
  }
  const offers = parsed as StoredOffer[];
  const compactCount = offers.filter(isCompactStoredOffer).length;
  return compactCount === offers.length ? reconstructFromSidecar(offers) : offers;
}

function main(): void {
  const startedAt = Date.now();
  const sourceOffers = loadSourceOffers();
  const corendon = sourceOffers.filter((offer) => offer.provider === 'Corendon');
  const sunweb = sourceOffers.filter((offer) => offer.provider === 'Sunweb');
  const others = sourceOffers.filter(
    (offer) => offer.provider !== 'Corendon' && offer.provider !== 'Sunweb',
  );

  const corendonMerged = mergeCorendonOffers(corendon);
  const sunwebMerged = mergeSunwebOffers(sunweb);
  const merged = [...corendonMerged.offers, ...sunwebMerged.offers, ...others];

  const published = publishLocalRuntimeCatalog(merged);
  const durationMs = Date.now() - startedAt;

  console.log(`✔ rematched compact runtime catalog`);
  console.log(`  - input: ${sourceOffers.length.toLocaleString('nl-NL')}`);
  console.log(
    `  - Corendon: ${corendon.length.toLocaleString('nl-NL')} → ${corendonMerged.stats.unique.toLocaleString('nl-NL')} (listings ${corendonMerged.stats.listingsRetained.toLocaleString('nl-NL')})`,
  );
  console.log(
    `  - Sunweb: ${sunweb.length.toLocaleString('nl-NL')} → ${sunwebMerged.stats.unique.toLocaleString('nl-NL')} (listings ${sunwebMerged.stats.listingsRetained.toLocaleString('nl-NL')})`,
  );
  console.log(`  - others unchanged: ${others.length.toLocaleString('nl-NL')}`);
  console.log(`  - flight-package eligibility: ${published.eligibility.input.toLocaleString('nl-NL')} → ${published.eligibility.kept.toLocaleString('nl-NL')} (excluded ${published.eligibility.excluded.toLocaleString('nl-NL')})`);
  console.log(`  - providers before: ${JSON.stringify(published.eligibility.byProviderBefore)}`);
  console.log(`  - providers after: ${JSON.stringify(published.eligibility.byProviderAfter)}`);
  console.log(`  - records: ${published.offerCount.toLocaleString('nl-NL')}`);
  console.log(`  - runtime: ${FEED_PATHS.offers} (${(published.runtimeBytes / 1_000_000).toFixed(1)} MB)`);
  console.log(
    `  - details: ${FEED_PATHS.offerDetails} (${(published.detailBytes / 1_000_000).toFixed(1)} MB, ${published.detailCount.toLocaleString('nl-NL')} records)`,
  );
  console.log(`  - duration: ${durationMs.toLocaleString('nl-NL')} ms`);
}

main();
