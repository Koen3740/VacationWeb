import fs from 'node:fs';
import path from 'node:path';
import type { OfferDetailRecord } from '../lib/offers/compact-runtime';
import {
  buildCompleteManifest,
  buildGenerationArtifacts,
} from '../lib/offers/build-generation-artifacts';
import { generationManifestKey } from '../lib/offers/build-generation-artifacts';
import { loadSourceCatalogAndDetails } from '../lib/offers/publish-generation';
import { assertGenerationArtifactsValid } from '../lib/offers/validate-generation';
import { writeJsonAtomic } from '../lib/offers/write-runtime-catalog';

const DETAIL_FIELDS = [
  'descriptionLong',
  'feedDescription',
  'accommodation',
  'images',
  'latitude',
  'longitude',
  'durationType',
  'variations',
  'localizedDescriptions',
  'imageLarge',
  'imageSmall',
] as const;

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

async function main(): Promise<void> {
  const fromLocal = process.env.VACATIONWEB_PUBLISH_FROM_LOCAL === '1';
  const source = await loadSourceCatalogAndDetails({ fromLocal });
  const artifacts = buildGenerationArtifacts(source.runtime, source.sidecar);
  assertGenerationArtifactsValid(artifacts, {
    providers: Object.fromEntries(
      Object.entries(
        source.runtime.reduce<Record<string, number>>((acc, offer) => {
          acc[offer.provider] = (acc[offer.provider] ?? 0) + 1;
          return acc;
        }, {}),
      ),
    ),
  });

  let parityMismatches = 0;
  let nonEmptyDetails = 0;
  const sampleIssues: string[] = [];

  for (const detail of artifacts.details) {
    const sidecar = source.sidecar[detail.externalId] ?? {};
    const parsed = JSON.parse(detail.body) as OfferDetailRecord;
    if (Object.keys(parsed).length > 0) {
      nonEmptyDetails += 1;
    }
    for (const field of DETAIL_FIELDS) {
      const left = stableJson((sidecar as Record<string, unknown>)[field]);
      const right = stableJson((parsed as Record<string, unknown>)[field]);
      if (left !== right) {
        parityMismatches += 1;
        if (sampleIssues.length < 10) {
          sampleIssues.push(`${detail.externalId}.${field}`);
        }
      }
    }
  }

  const root = path.join(process.cwd(), 'data', '_sub19-local-generation');
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(root, { recursive: true });

  writeJsonAtomic(path.join(root, generationManifestKey(artifacts.generationId)), buildCompleteManifest(artifacts));
  writeJsonAtomic(path.join(root, `generations/${artifacts.generationId}/catalog.json`), artifacts.catalog);
  writeJsonAtomic(
    path.join(root, `generations/${artifacts.generationId}/filter-options.json`),
    artifacts.filterOptions,
    true,
  );
  writeJsonAtomic(
    path.join(root, `generations/${artifacts.generationId}/details-index.json`),
    artifacts.detailsIndex,
  );

  for (const detail of artifacts.details) {
    const filePath = path.join(root, detail.key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, detail.body);
  }

  const report = {
    generationId: artifacts.generationId,
    offerCount: artifacts.catalog.length,
    detailObjectCount: artifacts.details.length,
    duplicateCanonicalIdentity: 0,
    parityMismatches,
    nonEmptyDetails,
    sampleIssues,
    localRoot: root,
    source: fromLocal ? 'local' : 'r2',
    providers: artifacts.providers,
  };

  const reportPath = path.join(root, 'validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (parityMismatches > 0) {
    throw new Error(`Detail parity mismatches: ${parityMismatches}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
