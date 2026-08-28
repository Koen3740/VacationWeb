/**
 * Enrich the active R2 generation catalog with Results card galleries
 * from generation detail sidecars (not legacy local offers.json).
 *
 * Usage:
 *   npx tsx scripts/enrich-generation-card-galleries.ts
 *   npx tsx scripts/enrich-generation-card-galleries.ts --write
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { StoredOffer } from '../lib/feeds/types/stored-offer';
import {
  attachResultsCardGalleriesFromDetails,
  type OfferDetailRecord,
  RESULTS_CARD_GALLERY_MAX,
} from '../lib/offers/compact-runtime';
import {
  detailObjectSha256,
  detailProviderSlug,
} from '../lib/offers/canonical-offer-identity';
import { CURRENT_POINTER_KEY, type CurrentPointer } from '../lib/offers/generation-types';
import {
  getStorageObject,
  putStorageObject,
  headStorageObject,
} from '../lib/storage/object-storage-client';

const DETAIL_FETCH_CONCURRENCY = 12;

function summarize(offers: StoredOffer[]) {
  let withImages = 0;
  let multi = 0;
  let max = 0;
  const byProvider: Record<string, { multi: number; total: number; zero: number }> = {};
  for (const offer of offers) {
    const n = offer.images?.length ?? 0;
    const bucket = (byProvider[offer.provider] ??= { multi: 0, total: 0, zero: 0 });
    bucket.total += 1;
    if (n > 0) withImages += 1;
    if (n <= 1) bucket.zero += 1;
    if (n > 1) {
      multi += 1;
      bucket.multi += 1;
    }
    max = Math.max(max, n);
  }
  return { withImages, multi, max, byProvider, total: offers.length };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function run(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => run()));
  return results;
}

async function loadGenerationDetailsForOffers(
  pointer: CurrentPointer,
  offers: StoredOffer[],
): Promise<{
  details: Record<string, OfferDetailRecord>;
  fetched: number;
  missing: number;
  errors: number;
}> {
  const details: Record<string, OfferDetailRecord> = {};
  let fetched = 0;
  let missing = 0;
  let errors = 0;

  await mapWithConcurrency(offers, DETAIL_FETCH_CONCURRENCY, async (offer) => {
    const identity = offer.canonicalOfferIdentity?.trim();
    const slug = detailProviderSlug(offer.provider);
    if (!identity || !slug) {
      missing += 1;
      return;
    }
    const key = `${pointer.detailsPrefix}${slug}/${detailObjectSha256(identity)}.json`;
    try {
      const raw = await getStorageObject(key);
      const parsed = JSON.parse(raw) as OfferDetailRecord;
      details[offer.externalId] = parsed;
      fetched += 1;
    } catch {
      errors += 1;
    }
  });

  return { details, fetched, missing, errors };
}

async function main() {
  const write = process.argv.includes('--write');

  const pointerRaw = await getStorageObject(CURRENT_POINTER_KEY);
  const pointer = JSON.parse(pointerRaw) as CurrentPointer;
  console.log('Active pointer:', pointer);

  const catalogRaw = await getStorageObject(pointer.catalogKey);
  const runtime = JSON.parse(catalogRaw) as StoredOffer[];
  const before = summarize(runtime);

  const candidates = runtime.filter(
    (offer) =>
      Boolean(offer.canonicalOfferIdentity?.trim())
      && Boolean(detailProviderSlug(offer.provider)),
  );
  console.log(
    JSON.stringify(
      {
        RESULTS_CARD_GALLERY_MAX,
        candidates: candidates.length,
        before,
      },
      null,
      2,
    ),
  );

  const { details, fetched, missing, errors } = await loadGenerationDetailsForOffers(
    pointer,
    candidates,
  );
  const enriched = attachResultsCardGalleriesFromDetails(runtime, details);
  const after = summarize(enriched);

  const corendonChecks = [
    'corendon-1602-BRUAYT-300826-5-DZF',
    'corendon-12232-BRUAYT-110127-4-2AEU',
    'corendon-8917-BRUAYT-111026-4-2AU',
    'corendon-10183-BRUAYT-021226-4-DZF',
    'corendon-7-BRUAYT-011126-4-DZX',
    'corendon-1332-BRUAYT-301126-4-DZLX',
    'corendon-2724-BRUAYT-131026-7-DZH',
    'corendon-13565-BRUAYT-290926-4-DZU',
    'corendon-4200-BRUAYT-301126-4-DZLF',
    'corendon-197-BRUAYT-251026-7-DZA',
  ].map((id) => {
    const beforeOffer = runtime.find((o) => o.externalId === id);
    const afterOffer = enriched.find((o) => o.externalId === id);
    const detail = details[id];
    return {
      id,
      before: beforeOffer?.images?.length ?? 0,
      after: afterOffer?.images?.length ?? 0,
      detail: detail?.images?.length ?? null,
    };
  });

  console.log(
    JSON.stringify(
      {
        detailFetch: { fetched, missing, errors, candidates: candidates.length },
        after,
        corendonChecks,
        write,
      },
      null,
      2,
    ),
  );

  if (!write) {
    console.log('Dry run only. Pass --write to upload enriched generation catalog.');
    return;
  }

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
    const verifyChecks = corendonChecks.map((row) => {
      const offer = verify.find((o) => o.externalId === row.id);
      return { id: row.id, verified: offer?.images?.length ?? 0 };
    });
    console.log(
      JSON.stringify(
        {
          uploaded: result,
          head,
          verify: verifySummary,
          verifyChecks,
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
