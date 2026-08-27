/**
 * Backfill Results card galleries onto an existing compact runtime catalog
 * using the local detail sidecar (no provider HTTP).
 *
 * Usage:
 *   npx tsx scripts/enrich-runtime-card-galleries.ts
 *   npx tsx scripts/enrich-runtime-card-galleries.ts --write
 */
import fs from 'node:fs';
import path from 'node:path';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import type { StoredOffer } from '../lib/feeds/types/stored-offer';
import {
  attachResultsCardGalleriesFromDetails,
  type OfferDetailRecord,
  RESULTS_CARD_GALLERY_MAX,
} from '../lib/offers/compact-runtime';
import { writeJsonAtomic } from '../lib/offers/write-runtime-catalog';

function loadJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function summarize(offers: StoredOffer[]) {
  let withImages = 0;
  let multi = 0;
  let max = 0;
  const byProvider: Record<string, { multi: number; total: number }> = {};
  for (const offer of offers) {
    const n = offer.images?.length ?? 0;
    const bucket = (byProvider[offer.provider] ??= { multi: 0, total: 0 });
    bucket.total += 1;
    if (n > 0) withImages += 1;
    if (n > 1) {
      multi += 1;
      bucket.multi += 1;
    }
    max = Math.max(max, n);
  }
  return { withImages, multi, max, byProvider, total: offers.length };
}

async function main() {
  const write = process.argv.includes('--write');
  const offersPath = path.resolve(FEED_PATHS.offers);
  const detailsPath = path.resolve(FEED_PATHS.offerDetails);

  if (!fs.existsSync(offersPath) || !fs.existsSync(detailsPath)) {
    throw new Error(`Missing ${offersPath} or ${detailsPath}`);
  }

  const runtime = loadJson<StoredOffer[]>(offersPath);
  const details = loadJson<Record<string, OfferDetailRecord>>(detailsPath);
  const before = summarize(runtime);
  const enriched = attachResultsCardGalleriesFromDetails(runtime, details);
  const after = summarize(enriched);

  console.log(
    JSON.stringify(
      {
        RESULTS_CARD_GALLERY_MAX,
        before,
        after,
        write,
      },
      null,
      2,
    ),
  );

  if (write) {
    writeJsonAtomic(offersPath, enriched, false);
    console.log(`Wrote ${enriched.length} offers to ${offersPath}`);
  } else {
    console.log('Dry run only. Pass --write to persist.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
