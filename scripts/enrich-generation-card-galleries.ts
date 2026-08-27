/**
 * Enrich the active R2 generation catalog with Results card galleries
 * from the local legacy offers.detail.json sidecar (no provider HTTP).
 *
 * Usage:
 *   npx tsx scripts/enrich-generation-card-galleries.ts
 *   npx tsx scripts/enrich-generation-card-galleries.ts --write
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FEED_PATHS } from '../lib/feeds/feed-paths';
import type { StoredOffer } from '../lib/feeds/types/stored-offer';
import {
  attachResultsCardGalleriesFromDetails,
  type OfferDetailRecord,
  RESULTS_CARD_GALLERY_MAX,
} from '../lib/offers/compact-runtime';
import {
  getStorageObject,
  putStorageObject,
  headStorageObject,
} from '../lib/storage/object-storage-client';
import { CURRENT_POINTER_KEY, type CurrentPointer } from '../lib/offers/generation-types';

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
  const detailsPath = path.resolve(FEED_PATHS.offerDetails);
  if (!fs.existsSync(detailsPath)) {
    throw new Error(`Missing local sidecar: ${detailsPath}`);
  }

  const pointerRaw = await getStorageObject(CURRENT_POINTER_KEY);
  const pointer = JSON.parse(pointerRaw) as CurrentPointer;
  console.log('Active pointer:', pointer);

  const catalogRaw = await getStorageObject(pointer.catalogKey);
  const runtime = JSON.parse(catalogRaw) as StoredOffer[];
  const details = JSON.parse(fs.readFileSync(detailsPath, 'utf8')) as Record<
    string,
    OfferDetailRecord
  >;

  // Prefer already-enriched local legacy runtime images when IDs match.
  const localOffersPath = path.resolve(FEED_PATHS.offers);
  const localById = new Map<string, StoredOffer>();
  if (fs.existsSync(localOffersPath)) {
    const localOffers = JSON.parse(fs.readFileSync(localOffersPath, 'utf8')) as StoredOffer[];
    for (const offer of localOffers) {
      localById.set(offer.externalId, offer);
    }
  }

  const before = summarize(runtime);
  const seeded = runtime.map((offer) => {
    const local = localById.get(offer.externalId);
    if (!local?.images || local.images.length <= 1) {
      return offer;
    }
    return {
      ...offer,
      imageUrl: local.imageUrl || offer.imageUrl,
      images: local.images.slice(0, RESULTS_CARD_GALLERY_MAX),
    };
  });
  const enriched = attachResultsCardGalleriesFromDetails(seeded, details);
  const after = summarize(enriched);

  console.log(JSON.stringify({ RESULTS_CARD_GALLERY_MAX, before, after, write }, null, 2));

  if (!write) {
    console.log('Dry run only. Pass --write to upload enriched generation catalog.');
    return;
  }

  // HEAD storage API writes from a local file path (same as upload-offers.ts).
  const tmpPath = path.join(
    os.tmpdir(),
    `vacationweb-enriched-catalog-${Date.now()}.json`,
  );
  fs.writeFileSync(tmpPath, JSON.stringify(enriched), 'utf8');
  try {
    const result = await putStorageObject(pointer.catalogKey, tmpPath);
    const verify = JSON.parse(await getStorageObject(pointer.catalogKey)) as StoredOffer[];
    const verifySummary = summarize(verify);
    const head = await headStorageObject(pointer.catalogKey);
    console.log(
      JSON.stringify(
        {
          uploaded: result,
          head,
          verify: verifySummary,
        },
        null,
        2,
      ),
    );
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
