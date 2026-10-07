import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getStorageObjectBytes, putStorageBytes } from '../../storage/object-storage-client';
import {
  CREATIVE_IMAGE_MANIFEST_STORAGE_KEY,
  publishIsolatedCreativeDocument,
  readIsolatedCreativeDocument,
} from './creative-documents';
import { getObjectStorageConfig } from '../../storage/object-storage-config';
import { CREATIVE_IMAGE_MAX_BYTES, inspectCreativeImage } from './creative-image-bytes';
import {
  CREATIVE_IMAGE_LOCAL_DIR,
  assertIsolatedCreativeImageKey,
  creativeImageFileName,
  creativeImageMaterialKey,
  creativeImagePublicPath,
  creativeImageStorageKey,
  isCanonicalCreativeSite,
  isOwnCreativeImageUrl,
  parseCreativeImagePublicPath,
  type CreativeImageLink,
  type CreativeImageParts,
} from './creative-image-path';
import { evaluateOfferBenefit } from './displayable-offer';
import { parseBannerEmbedCode } from './normalize';
import type { SelectedTradeTrackerCreative } from './types';

/**
 * One-time server ingest of impression images for displayable offers.
 *
 * Local (always): data/tradetracker-creatives/images/{market}/{site}/{campaignId}/{file}
 *   gitignored. Served only by /aanbiedingen/creative-images/...
 * R2/S3 (when OBJECT_STORAGE_* is set): the same relative key under
 *   tradetracker-creatives/images/... via putStorageBytes.
 * The browser never sees /i. This module never writes offers, catalog
 * generations, current.json, or live-price/v1.
 */

export const CREATIVE_IMAGE_MANIFEST_FILE = 'creative-image-manifest.json';

export type CreativeImageManifestEntry = {
  market: 'nl' | 'be';
  affiliateSiteId: string;
  campaignId: string;
  materialItemId: string;
  width: number;
  height: number;
  contentHash: string;
  sourceUrlSha256: string;
  byteSize: number;
  contentType: string;
  ext: string;
  publicPath: string;
  storageKey: string;
  localRelativePath: string;
};

export type CreativeImageManifest = {
  source: 'vacationweb-tradetracker-creative-images';
  generatedAt: string;
  storage: 'local' | 'local+r2';
  entries: CreativeImageManifestEntry[];
};

export type CreativeImageIngestReport = {
  considered: number;
  displayable: number;
  excluded: number;
  doubt: number;
  stored: number;
  skipped: number;
  failed: number;
  storage: 'local' | 'local+r2';
  publicPaths: string[];
  failures: { materialItemId: string; reason: string }[];
  /** Set when this run built a manifest. Remote publish may still be deferred. */
  manifest?: CreativeImageManifest;
};

export class CreativeImageFetchError extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(reason);
    this.name = 'CreativeImageFetchError';
    this.reason = reason;
  }
}

type ImpressionResponse = {
  status: number;
  location: string | null;
  contentType: string | null;
  body: Buffer;
};

export type ImpressionRequest = (url: string) => Promise<ImpressionResponse>;

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Parsed embed `src` whose path is `/i`. Does not build a URL from ids. */
export function impressionUrlFromEmbed(embedCode: string | null): string | null {
  const raw = parseBannerEmbedCode(embedCode).impressionUrlTemplate;
  if (!raw) {
    return null;
  }
  try {
    assertImpressionRequestUrl(raw);
  } catch {
    return null;
  }
  return raw;
}

export function assertImpressionRequestUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CreativeImageFetchError('invalid_impression_url');
  }
  if (url.protocol !== 'https:') {
    throw new CreativeImageFetchError('invalid_impression_url');
  }
  if (url.pathname === '/c' || url.pathname.endsWith('/c')) {
    throw new CreativeImageFetchError('refused_click_url');
  }
  if (url.pathname !== '/i' && !url.pathname.endsWith('/i')) {
    throw new CreativeImageFetchError('not_impression_path');
  }
  return url;
}

function assertSafeRedirect(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CreativeImageFetchError('invalid_redirect');
  }
  if (url.protocol !== 'https:') {
    throw new CreativeImageFetchError('invalid_redirect');
  }
  if (url.pathname === '/c' || url.pathname.endsWith('/c')) {
    throw new CreativeImageFetchError('refused_click_url');
  }
  if (url.hostname === 'ti.tradetracker.net') {
    throw new CreativeImageFetchError('refused_tracker_host');
  }
}

async function readCappedBody(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) {
    return Buffer.alloc(0);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const step = await reader.read();
    if (step.done) {
      break;
    }
    total += step.value.byteLength;
    if (total > CREATIVE_IMAGE_MAX_BYTES) {
      await reader.cancel();
      throw new CreativeImageFetchError('size');
    }
    chunks.push(Buffer.from(step.value));
  }
  return Buffer.concat(chunks);
}

async function nodeImpressionRequest(url: string): Promise<ImpressionResponse> {
  let response: Response;
  try {
    response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new CreativeImageFetchError('fetch_failed');
  }
  const body =
    response.status >= 300 && response.status < 400 ? Buffer.alloc(0) : await readCappedBody(response);
  return {
    status: response.status,
    location: response.headers.get('location'),
    contentType: response.headers.get('content-type'),
    body,
  };
}

/**
 * Fetch one embed `/i` URL. Redirects may land on an image host.
 * A redirect to `/c` or ti.tradetracker.net is refused before the next request.
 */
export async function fetchImpressionImage(
  rawUrl: string,
  request: ImpressionRequest = nodeImpressionRequest,
): Promise<{ body: Buffer; contentType: string }> {
  let current = rawUrl;
  let first = true;
  for (let hop = 0; hop < 3; hop += 1) {
    if (first) {
      assertImpressionRequestUrl(current);
      first = false;
    } else {
      assertSafeRedirect(current);
    }
    const response = await request(current);
    if (response.status >= 300 && response.status < 400) {
      if (!response.location) {
        throw new CreativeImageFetchError('invalid_redirect');
      }
      const next = new URL(response.location, current).toString();
      assertSafeRedirect(next);
      current = next;
      continue;
    }
    if (response.status !== 200) {
      throw new CreativeImageFetchError('http_status');
    }
    const contentType = response.contentType?.split(';')[0]?.trim().toLowerCase() ?? '';
    if (!contentType.startsWith('image/')) {
      throw new CreativeImageFetchError('content_type');
    }
    if (response.body.byteLength === 0 || response.body.byteLength > CREATIVE_IMAGE_MAX_BYTES) {
      throw new CreativeImageFetchError('size');
    }
    return { body: response.body, contentType };
  }
  throw new CreativeImageFetchError('redirects');
}

export function creativeImageManifestPath(root = process.cwd()): string {
  return path.join(root, 'data', 'tradetracker-creatives', CREATIVE_IMAGE_MANIFEST_FILE);
}

export function loadCreativeImageManifest(root = process.cwd()): CreativeImageManifest | null {
  const filePath = creativeImageManifestPath(root);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CreativeImageManifest;
    if (!parsed || !Array.isArray(parsed.entries)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function creativeImageIndexFromManifest(manifest: CreativeImageManifest | null): Map<string, CreativeImageLink> {
  const index = new Map<string, CreativeImageLink>();
  for (const entry of manifest?.entries ?? []) {
    if (!isOwnCreativeImageUrl(entry.publicPath)) {
      continue;
    }
    if (!isCanonicalCreativeSite(entry.market, entry.affiliateSiteId)) {
      continue;
    }
    index.set(creativeImageMaterialKey(entry.market, entry.affiliateSiteId, entry.materialItemId), {
      publicPath: entry.publicPath,
      width: entry.width,
      height: entry.height,
      contentHash: typeof entry.contentHash === 'string' && /^[a-f0-9]{64}$/.test(entry.contentHash) ? entry.contentHash : null,
    });
  }
  return index;
}

export async function loadCreativeImageIndex(
  root = process.cwd(),
  options: { readRemote?: (key: string) => Promise<string | null> } = {},
): Promise<Map<string, CreativeImageLink>> {
  const localPath = creativeImageManifestPath(root);
  if (fs.existsSync(localPath)) {
    return creativeImageIndexFromManifest(loadCreativeImageManifest(root));
  }
  const readRemote = options.readRemote ?? readIsolatedCreativeDocument;
  let raw: string | null;
  try {
    raw = await readRemote(CREATIVE_IMAGE_MANIFEST_STORAGE_KEY);
  } catch {
    return new Map();
  }
  if (!raw) {
    return new Map();
  }
  try {
    const parsed = JSON.parse(raw) as CreativeImageManifest;
    if (!parsed || !Array.isArray(parsed.entries)) {
      return new Map();
    }
    return creativeImageIndexFromManifest(parsed);
  } catch {
    return new Map();
  }
}

function localAbsolutePath(root: string, relativePath: string): string | null {
  if (!relativePath.startsWith(`${CREATIVE_IMAGE_LOCAL_DIR}/`) || relativePath.includes('..')) {
    return null;
  }
  const base = path.resolve(root, CREATIVE_IMAGE_LOCAL_DIR);
  const full = path.resolve(root, relativePath);
  if (full !== base && !full.startsWith(base + path.sep)) {
    return null;
  }
  return full;
}

function emptyManifest(generatedAt: string): CreativeImageManifest {
  return {
    source: 'vacationweb-tradetracker-creative-images',
    generatedAt,
    storage: 'local',
    entries: [],
  };
}

export async function ingestDisplayableCreativeImages(options: {
  creatives: readonly SelectedTradeTrackerCreative[];
  root?: string;
  generatedAt: string;
  resyncStorage?: boolean;
  /**
   * When false, image bytes may still be stored but the manifest document is not
   * published. The refresh entrypoint publishes it only after the run succeeds.
   */
  publishRemote?: boolean;
  /** When false, leave the previous local manifest file untouched. */
  writeLocalManifest?: boolean;
  fetchImpression?: ImpressionRequest;
  putIsolatedBytes?: (key: string, body: Buffer, contentType: string) => Promise<'stored' | 'unavailable'>;
  publishDocument?: (key: string, body: string) => Promise<'stored' | 'unavailable'>;
}): Promise<CreativeImageIngestReport> {
  const root = options.root ?? process.cwd();
  const request = options.fetchImpression ?? nodeImpressionRequest;
  const put = options.putIsolatedBytes ?? defaultPutIsolatedBytes;
  const previous = new Map<string, CreativeImageManifestEntry>();
  for (const entry of loadCreativeImageManifest(root)?.entries ?? []) {
    previous.set(creativeImageMaterialKey(entry.market, entry.affiliateSiteId, entry.materialItemId), entry);
  }

  const report: CreativeImageIngestReport = {
    considered: options.creatives.length,
    displayable: 0,
    excluded: 0,
    doubt: 0,
    stored: 0,
    skipped: 0,
    failed: 0,
    storage: 'local',
    publicPaths: [],
    failures: [],
  };
  const entries: CreativeImageManifestEntry[] = [];
  let usedRemote = false;

  const ordered = [...options.creatives].sort((a, b) => {
    const market = a.market.localeCompare(b.market);
    if (market !== 0) return market;
    const site = a.affiliateSiteId.localeCompare(b.affiliateSiteId);
    if (site !== 0) return site;
    const campaign = a.campaignId.localeCompare(b.campaignId);
    if (campaign !== 0) return campaign;
    return Number(a.materialItemId) - Number(b.materialItemId);
  });

  for (const creative of ordered) {
    const decision = evaluateOfferBenefit(creative);
    if (decision.outcome === 'doubt') {
      report.doubt += 1;
      continue;
    }
    if (decision.outcome !== 'displayable') {
      report.excluded += 1;
      continue;
    }
    report.displayable += 1;
    const materialKey = creativeImageMaterialKey(creative.market, creative.affiliateSiteId, creative.materialItemId);
    const impressionUrl = impressionUrlFromEmbed(creative.embedCode);
    if (!impressionUrl) {
      report.failed += 1;
      report.failures.push({ materialItemId: creative.materialItemId, reason: 'missing_impression' });
      continue;
    }
    const sourceUrlSha256 = sha256(impressionUrl);
    const existing = previous.get(materialKey);
    if (
      existing &&
      existing.sourceUrlSha256 === sourceUrlSha256 &&
      isOwnCreativeImageUrl(existing.publicPath)
    ) {
      const existingPath = localAbsolutePath(root, existing.localRelativePath);
      if (existingPath && fs.existsSync(existingPath)) {
        const bytes = fs.readFileSync(existingPath);
        if (sha256(bytes) === existing.contentHash) {
          if (options.resyncStorage) {
            const remote = await putExisting(put, existing.storageKey, bytes, existing.contentType);
            if (remote) usedRemote = true;
          }
          entries.push(existing);
          report.skipped += 1;
          report.publicPaths.push(existing.publicPath);
          continue;
        }
      }
    }

    try {
      const fetched = await fetchImpressionImage(impressionUrl, request);
      const inspected = inspectCreativeImage(fetched.body, fetched.contentType);
      if (!inspected) {
        throw new CreativeImageFetchError('image_bytes');
      }
      if (inspected.width !== creative.width || inspected.height !== creative.height) {
        throw new CreativeImageFetchError('dimensions');
      }
      const contentHash = sha256(fetched.body);
      const fileName = creativeImageFileName({
        materialItemId: creative.materialItemId,
        width: inspected.width,
        height: inspected.height,
        contentHash: contentHash.slice(0, 16),
        ext: inspected.ext,
      });
      if (!fileName || !isCanonicalCreativeSite(creative.market, creative.affiliateSiteId)) {
        throw new CreativeImageFetchError('invalid_target');
      }
      const parts: CreativeImageParts = {
        market: creative.market,
        affiliateSiteId: creative.affiliateSiteId,
        campaignId: creative.campaignId,
        fileName,
      };
      const storageKey = creativeImageStorageKey(parts);
      const publicPath = creativeImagePublicPath(parts);
      const localRelativePath = `${CREATIVE_IMAGE_LOCAL_DIR}/${creative.market}/${creative.affiliateSiteId}/${creative.campaignId}/${fileName}`;
      const absolute = localAbsolutePath(root, localRelativePath);
      if (!absolute) {
        throw new CreativeImageFetchError('invalid_target');
      }
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, fetched.body);
      const remote = await putExisting(put, storageKey, fetched.body, inspected.contentType);
      if (remote) usedRemote = true;
      const entry: CreativeImageManifestEntry = {
        market: creative.market,
        affiliateSiteId: creative.affiliateSiteId,
        campaignId: creative.campaignId,
        materialItemId: creative.materialItemId,
        width: inspected.width,
        height: inspected.height,
        contentHash,
        sourceUrlSha256,
        byteSize: fetched.body.byteLength,
        contentType: inspected.contentType,
        ext: inspected.ext,
        publicPath,
        storageKey,
        localRelativePath,
      };
      entries.push(entry);
      report.stored += 1;
      report.publicPaths.push(publicPath);
    } catch (error) {
      report.failed += 1;
      const reason = error instanceof CreativeImageFetchError ? error.reason : 'fetch_failed';
      report.failures.push({ materialItemId: creative.materialItemId, reason });
    }
  }

  entries.sort((a, b) => a.publicPath.localeCompare(b.publicPath));
  const manifest: CreativeImageManifest = {
    ...emptyManifest(options.generatedAt),
    storage: usedRemote ? 'local+r2' : 'local',
    entries,
  };
  report.manifest = manifest;
  if (options.writeLocalManifest !== false) {
    const manifestPath = creativeImageManifestPath(root);
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }
  if (options.publishRemote === false) {
    return report;
  }
  const manifestJson = JSON.stringify(manifest, null, 2);
  const publish = options.publishDocument ?? publishIsolatedCreativeDocument;
  const published = await publish(CREATIVE_IMAGE_MANIFEST_STORAGE_KEY, manifestJson);
  report.storage = usedRemote || published === 'stored' ? 'local+r2' : 'local';
  report.manifest = { ...manifest, storage: report.storage };
  return report;
}

async function putExisting(
  put: (key: string, body: Buffer, contentType: string) => Promise<'stored' | 'unavailable'>,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<boolean> {
  assertIsolatedCreativeImageKey(key);
  try {
    const result = await put(key, body, contentType);
    return result === 'stored';
  } catch {
    return false;
  }
}

async function defaultPutIsolatedBytes(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<'stored' | 'unavailable'> {
  assertIsolatedCreativeImageKey(key);
  try {
    getObjectStorageConfig();
  } catch {
    return 'unavailable';
  }
  await putStorageBytes(key, body, contentType);
  return 'stored';
}

export function resolveCreativeImageParts(args: {
  market: string;
  site: string;
  campaignId: string;
  file: string;
}): CreativeImageParts | null {
  if (!/^\d+$/.test(args.campaignId)) {
    return null;
  }
  const publicPath = `/aanbiedingen/creative-images/${args.market}/${args.site}/${args.campaignId}/${args.file}`;
  return parseCreativeImagePublicPath(publicPath);
}

export function readLocalCreativeImage(
  parts: CreativeImageParts,
  root = process.cwd(),
): { bytes: Buffer; contentType: string } | null {
  const relativePath = `${CREATIVE_IMAGE_LOCAL_DIR}/${parts.market}/${parts.affiliateSiteId}/${parts.campaignId}/${parts.fileName}`;
  const absolute = localAbsolutePath(root, relativePath);
  if (!absolute || !fs.existsSync(absolute)) {
    return null;
  }
  const bytes = fs.readFileSync(absolute);
  const ext = parts.fileName.split('.').pop() ?? '';
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const inspected = inspectCreativeImage(bytes, contentType);
  if (!inspected) {
    return null;
  }
  const sizeLabel = `${inspected.width}x${inspected.height}`;
  if (!parts.fileName.includes(`-${sizeLabel}-`) || inspected.ext !== ext && !(ext === 'jpeg' && inspected.ext === 'jpg')) {
    return null;
  }
  return { bytes, contentType: inspected.contentType };
}

export async function readCreativeImage(
  args: { market: string; site: string; campaignId: string; file: string },
  root = process.cwd(),
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const parts = resolveCreativeImageParts(args);
  if (!parts) {
    return null;
  }
  const local = readLocalCreativeImage(parts, root);
  if (local) {
    return local;
  }
  try {
    getObjectStorageConfig();
    const bytes = await getStorageObjectBytes(creativeImageStorageKey(parts));
    const ext = parts.fileName.split('.').pop() ?? '';
    const contentType =
      ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const inspected = inspectCreativeImage(bytes, contentType);
    if (!inspected || !parts.fileName.includes(`-${inspected.width}x${inspected.height}-`)) {
      return null;
    }
    return { bytes, contentType: inspected.contentType };
  } catch {
    return null;
  }
}
