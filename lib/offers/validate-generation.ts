import type { StoredOffer } from '../feeds/types/stored-offer';
import type { GenerationArtifacts } from './build-generation-artifacts';
import {
  generationCatalogKey,
  generationDetailsIndexKey,
  generationDetailsPrefix,
  generationFilterOptionsKey,
  generationManifestKey,
} from './generation-paths';
import type { GenerationManifest } from './generation-types';

export type GenerationValidationIssue = {
  code: string;
  message: string;
};

export type PreviousGenerationCounts = {
  providers: Record<string, number>;
};

function issue(code: string, message: string): GenerationValidationIssue {
  return { code, message };
}

function parseDetailJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function validateGenerationArtifacts(
  artifacts: GenerationArtifacts,
  previous?: PreviousGenerationCounts,
): GenerationValidationIssue[] {
  const issues: GenerationValidationIssue[] = [];
  const catalog = artifacts.catalog;

  if (!Array.isArray(catalog) || catalog.length < 1) {
    issues.push(issue('catalog_empty', 'Catalog must contain >= 1 offer'));
    return issues;
  }

  const externalIds = new Set<string>();
  const identities = new Set<string>();
  const duplicateExternal: string[] = [];
  const duplicateIdentity: string[] = [];

  for (const [index, offer] of catalog.entries()) {
    if (typeof offer.externalId !== 'string' || !offer.externalId.trim()) {
      issues.push(issue('row_externalId', `Catalog row ${index} missing externalId`));
    }
    if (typeof offer.provider !== 'string' || !offer.provider.trim()) {
      issues.push(issue('row_provider', `Catalog row ${index} missing provider`));
    }
    if (typeof offer.country !== 'string' || !offer.country.trim()) {
      issues.push(issue('row_country', `Catalog row ${index} missing country`));
    }
    if (typeof offer.canonicalOfferIdentity !== 'string' || !offer.canonicalOfferIdentity.trim()) {
      issues.push(
        issue(
          'row_canonicalOfferIdentity',
          `Catalog row ${index} (${offer.externalId ?? '?'}) missing canonicalOfferIdentity`,
        ),
      );
    }
    if (offer.externalId) {
      if (externalIds.has(offer.externalId)) {
        duplicateExternal.push(offer.externalId);
      }
      externalIds.add(offer.externalId);
    }
    if (offer.canonicalOfferIdentity) {
      if (identities.has(offer.canonicalOfferIdentity)) {
        duplicateIdentity.push(offer.canonicalOfferIdentity);
      }
      identities.add(offer.canonicalOfferIdentity);
    }
  }

  if (duplicateExternal.length > 0) {
    issues.push(
      issue(
        'duplicate_externalId',
        `Duplicate externalId count ${duplicateExternal.length}: ${duplicateExternal.slice(0, 5).join(', ')}`,
      ),
    );
  }
  if (duplicateIdentity.length > 0) {
    issues.push(
      issue(
        'duplicate_canonicalOfferIdentity',
        `Duplicate canonicalOfferIdentity count ${duplicateIdentity.length}: ${duplicateIdentity.slice(0, 5).join(', ')}`,
      ),
    );
  }

  const index = artifacts.detailsIndex.byExternalId;
  const indexKeys = Object.keys(index);
  if (indexKeys.length !== catalog.length) {
    issues.push(
      issue(
        'index_count',
        `details-index has ${indexKeys.length} entries; catalog has ${catalog.length}`,
      ),
    );
  }

  for (const offer of catalog) {
    const entry = index[offer.externalId];
    if (!entry) {
      issues.push(issue('index_missing', `No details-index entry for ${offer.externalId}`));
      continue;
    }
    if (entry.canonicalOfferIdentity !== offer.canonicalOfferIdentity) {
      issues.push(
        issue(
          'index_identity_mismatch',
          `Index identity differs for ${offer.externalId}`,
        ),
      );
    }
    if (entry.key !== artifacts.details.find((item) => item.externalId === offer.externalId)?.key) {
      issues.push(issue('index_key_mismatch', `Index key differs for ${offer.externalId}`));
    }
  }

  for (const key of indexKeys) {
    if (!externalIds.has(key)) {
      issues.push(issue('index_orphan', `details-index entry ${key} is not in catalog`));
    }
  }

  if (artifacts.details.length !== catalog.length) {
    issues.push(
      issue(
        'detail_count',
        `detail objects ${artifacts.details.length} != catalog ${catalog.length}`,
      ),
    );
  }

  const detailKeys = new Set<string>();
  for (const detail of artifacts.details) {
    if (detailKeys.has(detail.key)) {
      issues.push(issue('detail_key_collision', `Duplicate detail object key ${detail.key}`));
    }
    detailKeys.add(detail.key);
    const parsed = parseDetailJson(detail.body);
    if (!parsed.ok) {
      issues.push(issue('detail_json', `Detail JSON for ${detail.externalId}: ${parsed.error}`));
      continue;
    }
    if (typeof parsed.value !== 'object' || parsed.value === null || Array.isArray(parsed.value)) {
      issues.push(issue('detail_shape', `Detail for ${detail.externalId} is not a JSON object`));
    }
  }

  const generationId = artifacts.generationId;
  const expectedCatalog = generationCatalogKey(generationId);
  const expectedFilters = generationFilterOptionsKey(generationId);
  const expectedIndex = generationDetailsIndexKey(generationId);
  const expectedPrefix = generationDetailsPrefix(generationId);
  if (!artifacts.details.every((item) => item.key.startsWith(expectedPrefix))) {
    issues.push(issue('generation_mismatch', 'A detail object key is outside this generation prefix'));
  }
  if (artifacts.detailsIndex.generationId !== generationId) {
    issues.push(issue('generation_mismatch', 'details-index generationId does not match'));
  }

  void expectedCatalog;
  void expectedFilters;
  void expectedIndex;

  if (previous) {
    for (const [provider, count] of Object.entries(previous.providers)) {
      if (count > 0 && (artifacts.providers[provider] ?? 0) === 0) {
        issues.push(
          issue(
            'provider_zero',
            `Provider ${provider} had ${count} offers in the previous generation and 0 in this generation`,
          ),
        );
      }
    }
  }

  return issues;
}

export function assertGenerationArtifactsValid(
  artifacts: GenerationArtifacts,
  previous?: PreviousGenerationCounts,
): void {
  const issues = validateGenerationArtifacts(artifacts, previous);
  if (issues.length > 0) {
    throw new Error(
      `Generation validation failed (${issues.length}): ${issues
        .slice(0, 15)
        .map((item) => `${item.code}: ${item.message}`)
        .join(' | ')}`,
    );
  }
}

export function assertManifestComplete(
  manifest: GenerationManifest,
  artifacts: GenerationArtifacts,
): void {
  if (manifest.status !== 'complete') {
    throw new Error('Manifest status is not complete');
  }
  if (manifest.generationId !== artifacts.generationId) {
    throw new Error('Manifest generationId does not match artifacts');
  }
  if (manifest.offerCount !== artifacts.catalog.length) {
    throw new Error('Manifest offerCount does not match catalog');
  }
  if (manifest.details.objectCount !== artifacts.details.length) {
    throw new Error('Manifest detail objectCount does not match artifacts');
  }
  if (manifest.catalog.key !== generationCatalogKey(artifacts.generationId)) {
    throw new Error('Manifest catalog key mismatch');
  }
  if (manifest.filterOptions.key !== generationFilterOptionsKey(artifacts.generationId)) {
    throw new Error('Manifest filter-options key mismatch');
  }
  if (manifest.detailsIndex.key !== generationDetailsIndexKey(artifacts.generationId)) {
    throw new Error('Manifest details-index key mismatch');
  }
  void generationManifestKey;
}
