import fs from 'node:fs';
import path from 'node:path';
import { normalizeOffer } from '@/lib/feeds/canonical/normalize-offer';
import type { StoredOffer } from '@/lib/feeds/types/stored-offer';
import { FEED_PATHS } from '@/lib/feeds/feed-paths';
import { isVacationWebFlightPackage } from '@/lib/offers/flight-package-eligibility';
import {
  canonicalizeFilterOptions,
  loadFilterOptions,
} from '@/lib/offers/load-filter-options';
import {
  detailObjectSha256,
  detailProviderSlug,
} from '@/lib/offers/canonical-offer-identity';
import {
  CURRENT_POINTER_KEY,
  type CurrentPointer,
} from '@/lib/offers/generation-types';
import type { FilterOptions } from '@/types/travel';
import type { TravelOffer } from '@/types/travel';
import {
  getOffersObject,
  getStorageObject,
  headStorageObject,
} from '@/lib/storage/object-storage-client';

export type RuntimeDataset = {
  mode: 'generation' | 'legacy';
  generationId: string | null;
  pointer: CurrentPointer | null;
  offers: TravelOffer[];
  filterOptions: FilterOptions;
};

let cachedDataset: RuntimeDataset | null = null;

export function resetRuntimeDatasetCacheForTests(): void {
  cachedDataset = null;
}

function resolvePath(value: string): string {
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function localOffersOverride(): string | undefined {
  const override = process.env.VACATIONWEB_OFFERS_FILE?.trim();
  return override ? resolvePath(override) : undefined;
}

function generationRoot(): string | undefined {
  const override = process.env.VACATIONWEB_GENERATION_ROOT?.trim();
  if (override) {
    return resolvePath(override);
  }
  const currentOverride = process.env.VACATIONWEB_CURRENT_FILE?.trim();
  if (currentOverride) {
    return path.dirname(resolvePath(currentOverride));
  }
  const defaultCurrent = path.join(process.cwd(), 'data', 'current.json');
  if (fs.existsSync(defaultCurrent)) {
    return path.join(process.cwd(), 'data');
  }
  return undefined;
}

function parseCatalog(raw: string, requireIdentity: boolean): StoredOffer[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Offers dataset is not valid JSON');
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Offers dataset must be a non-empty JSON array');
  }
  for (const [index, offer] of parsed.entries()) {
    if (typeof offer !== 'object' || offer === null) {
      throw new Error(`Offers dataset contains invalid offer at index ${index}`);
    }
    const record = offer as Record<string, unknown>;
    if (typeof record.externalId !== 'string' || !record.externalId.trim()) {
      throw new Error(`Offers dataset missing externalId at index ${index}`);
    }
    if (typeof record.provider !== 'string' || !record.provider.trim()) {
      throw new Error(`Offers dataset missing provider at index ${index}`);
    }
    if (typeof record.country !== 'string' || !record.country.trim()) {
      throw new Error(`Offers dataset missing country at index ${index}`);
    }
    if (typeof record.price !== 'number') {
      throw new Error(`Offers dataset missing price at index ${index}`);
    }
    if (
      requireIdentity &&
      (typeof record.canonicalOfferIdentity !== 'string' || !record.canonicalOfferIdentity.trim())
    ) {
      throw new Error(`Generation catalog missing canonicalOfferIdentity at index ${index}`);
    }
  }
  return parsed as StoredOffer[];
}

function parsePointer(raw: string): CurrentPointer {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('current.json is not a JSON object');
  }
  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    throw new Error('current.json schemaVersion must be 1');
  }
  if (typeof record.generationId !== 'string' || !record.generationId.trim()) {
    throw new Error('current.json missing generationId');
  }
  if (typeof record.catalogKey !== 'string' || !record.catalogKey.trim()) {
    throw new Error('current.json missing catalogKey');
  }
  if (typeof record.detailsPrefix !== 'string' || !record.detailsPrefix.trim()) {
    throw new Error('current.json missing detailsPrefix');
  }
  if (typeof record.filterOptionsKey !== 'string' || !record.filterOptionsKey.trim()) {
    throw new Error('current.json missing filterOptionsKey');
  }
  if (!record.catalogKey.startsWith(`generations/${record.generationId}/`)) {
    throw new Error('current.json catalogKey is not in the active generation prefix');
  }
  if (!record.detailsPrefix.startsWith(`generations/${record.generationId}/`)) {
    throw new Error('current.json detailsPrefix is not in the active generation prefix');
  }
  if (!record.filterOptionsKey.startsWith(`generations/${record.generationId}/`)) {
    throw new Error('current.json filterOptionsKey is not in the active generation prefix');
  }
  return {
    schemaVersion: 1,
    generationId: record.generationId,
    catalogKey: record.catalogKey,
    detailsPrefix: record.detailsPrefix,
    filterOptionsKey: record.filterOptionsKey,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
  };
}

async function readObject(key: string, root: string | undefined): Promise<string> {
  if (root) {
    const filePath = path.join(root, key);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local generation object missing: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  }
  return getStorageObject(key);
}

async function readPointer(
  root: string | undefined,
): Promise<CurrentPointer | null> {
  if (root) {
    const currentPath =
      process.env.VACATIONWEB_CURRENT_FILE?.trim()
        ? resolvePath(process.env.VACATIONWEB_CURRENT_FILE)
        : path.join(root, 'current.json');
    if (!fs.existsSync(currentPath)) {
      return null;
    }
    return parsePointer(fs.readFileSync(currentPath, 'utf8'));
  }
  const head = await headStorageObject(CURRENT_POINTER_KEY);
  if (!head) {
    return null;
  }
  return parsePointer(await getStorageObject(CURRENT_POINTER_KEY));
}

async function loadLegacyDataset(): Promise<RuntimeDataset> {
  const localPath = localOffersOverride();
  const raw = localPath
    ? fs.readFileSync(localPath, 'utf8')
    : await getOffersObject();
  const stored = parseCatalog(raw, false);
  const offers = stored.map(normalizeOffer).filter(isVacationWebFlightPackage);
  if (offers.length === 0) {
    throw new Error('Legacy offers dataset contains no VacationWeb flight packages');
  }
  return {
    mode: 'legacy',
    generationId: null,
    pointer: null,
    offers,
    filterOptions: loadFilterOptions(),
  };
}

async function loadGenerationDataset(
  pointer: CurrentPointer,
  root: string | undefined,
): Promise<RuntimeDataset> {
  const catalogRaw = await readObject(pointer.catalogKey, root);
  const filterRaw = await readObject(pointer.filterOptionsKey, root);
  const stored = parseCatalog(catalogRaw, true);
  const offers = stored.map(normalizeOffer).filter(isVacationWebFlightPackage);
  if (offers.length === 0) {
    throw new Error('Generation catalog contains no VacationWeb flight packages');
  }
  let parsedFilters: FilterOptions;
  try {
    parsedFilters = JSON.parse(filterRaw) as FilterOptions;
  } catch {
    throw new Error('Generation filter-options.json is not valid JSON');
  }
  return {
    mode: 'generation',
    generationId: pointer.generationId,
    pointer,
    offers,
    filterOptions: canonicalizeFilterOptions(parsedFilters),
  };
}

export async function loadRuntimeDataset(): Promise<RuntimeDataset> {
  if (cachedDataset) {
    return cachedDataset;
  }

  if (localOffersOverride()) {
    cachedDataset = await loadLegacyDataset();
    return cachedDataset;
  }

  const root = generationRoot();
  const pointer = await readPointer(root);
  cachedDataset =
    pointer !== null
      ? await loadGenerationDataset(pointer, root)
      : await loadLegacyDataset();
  return cachedDataset;
}

export async function loadRuntimeFilterOptions(): Promise<FilterOptions> {
  return (await loadRuntimeDataset()).filterOptions;
}

export function generationDetailObjectKeyForOffer(
  dataset: RuntimeDataset,
  offer: TravelOffer,
): string {
  if (dataset.mode !== 'generation' || !dataset.pointer) {
    throw new Error('generationDetailObjectKeyForOffer requires a generation dataset');
  }
  const identity = offer.canonicalOfferIdentity?.trim();
  if (!identity) {
    throw new Error(`Offer ${offer.id} is missing canonicalOfferIdentity`);
  }
  const slug = detailProviderSlug(offer.provider);
  if (!slug) {
    throw new Error(`Offer ${offer.id} has unsupported provider ${offer.provider}`);
  }
  const expectedPrefix = dataset.pointer.detailsPrefix;
  return `${expectedPrefix}${slug}/${detailObjectSha256(identity)}.json`;
}

export async function readGenerationDetailObject(
  dataset: RuntimeDataset,
  offer: TravelOffer,
): Promise<string> {
  const key = generationDetailObjectKeyForOffer(dataset, offer);
  if (!dataset.pointer || !dataset.generationId) {
    throw new Error('Refusing to read a detail object outside a cached generation');
  }
  if (!key.startsWith(`generations/${dataset.generationId}/details/`)) {
    throw new Error('Refusing to read a detail object outside the cached generation prefix');
  }
  const root = localOffersOverride() ? undefined : generationRoot();
  return readObject(key, dataset.mode === 'generation' ? root : undefined);
}

export { FEED_PATHS };
