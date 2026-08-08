import fs from 'node:fs';
import path from 'node:path';

export type FeedSource = {
  type: string;
  path: string;
};

export type FeedManifestEntry = {
  id: string;
  provider: string;
  profile: string;
  format: string;
  enabled: boolean;
  source: FeedSource;
  campaignId?: string;
  preferredFormat?: string;
  checksum?: string;
  lastImport?: string;
  lastSuccess?: string;
  version?: string;
  priority?: number;
};

export type FeedManifest = {
  manifestVersion: number;
  description?: string;
  fieldDocs?: Record<string, string>;
  feeds: FeedManifestEntry[];
};

const MANIFEST_RELATIVE_PATH = path.join('config', 'feed-manifest.json');

let cachedFeeds: FeedManifestEntry[] | null = null;

function manifestPath(): string {
  return path.join(process.cwd(), MANIFEST_RELATIVE_PATH);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertFeedEntry(entry: unknown, index: number): FeedManifestEntry {
  const label = `Feed at index ${index}`;

  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`${label}: entry must be an object`);
  }

  const record = entry as Record<string, unknown>;

  if (!isNonEmptyString(record.id)) {
    throw new Error(`${label}: missing required field "id"`);
  }

  if (!isNonEmptyString(record.provider)) {
    throw new Error(`Feed "${record.id}": missing required field "provider"`);
  }

  if (!isNonEmptyString(record.profile)) {
    throw new Error(`Feed "${record.id}": missing required field "profile"`);
  }

  if (!isNonEmptyString(record.format)) {
    throw new Error(`Feed "${record.id}": missing required field "format"`);
  }

  if (typeof record.source !== 'object' || record.source === null) {
    throw new Error(`Feed "${record.id}": missing required field "source"`);
  }

  const source = record.source as Record<string, unknown>;

  if (!isNonEmptyString(source.type)) {
    throw new Error(`Feed "${record.id}": source.type is required`);
  }

  if (!isNonEmptyString(source.path)) {
    throw new Error(`Feed "${record.id}": source.path is required`);
  }

  return {
    id: record.id.trim(),
    provider: record.provider.trim(),
    profile: record.profile.trim(),
    format: record.format.trim(),
    enabled: record.enabled !== false,
    source: {
      type: source.type.trim(),
      path: source.path.trim(),
    },
    campaignId: typeof record.campaignId === 'string' ? record.campaignId : undefined,
    preferredFormat: typeof record.preferredFormat === 'string' ? record.preferredFormat : undefined,
    checksum: typeof record.checksum === 'string' ? record.checksum : undefined,
    lastImport: typeof record.lastImport === 'string' ? record.lastImport : undefined,
    lastSuccess: typeof record.lastSuccess === 'string' ? record.lastSuccess : undefined,
    version: typeof record.version === 'string' ? record.version : undefined,
    priority: typeof record.priority === 'number' ? record.priority : undefined,
  };
}

function loadAndValidateManifest(): FeedManifestEntry[] {
  const filePath = manifestPath();

  if (!fs.existsSync(filePath)) {
    throw new Error(`Feed manifest not found: ${filePath}`);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Feed manifest is not valid JSON (${filePath}): ${message}`);
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`Feed manifest root must be an object (${filePath})`);
  }

  const root = parsed as Record<string, unknown>;

  if (!Array.isArray(root.feeds)) {
    throw new Error(`Feed manifest must contain a "feeds" array (${filePath})`);
  }

  const feeds = root.feeds.map((entry, index) => assertFeedEntry(entry, index));
  const seenIds = new Set<string>();
  const duplicates = new Set<string>();

  for (const feed of feeds) {
    if (seenIds.has(feed.id)) {
      duplicates.add(feed.id);
    }
    seenIds.add(feed.id);
  }

  if (duplicates.size > 0) {
    throw new Error(
      `Feed manifest contains duplicate id values: ${[...duplicates].sort().join(', ')}`,
    );
  }

  return feeds;
}

function getCachedFeeds(): FeedManifestEntry[] {
  if (cachedFeeds === null) {
    cachedFeeds = loadAndValidateManifest();
  }

  return cachedFeeds;
}

/** Clears the in-memory cache (tests / tooling only). */
export function clearFeedRegistryCache(): void {
  cachedFeeds = null;
}

export function getAllFeeds(): FeedManifestEntry[] {
  return [...getCachedFeeds()];
}

export function getEnabledFeeds(): FeedManifestEntry[] {
  return getCachedFeeds().filter((feed) => feed.enabled);
}

export function getFeedById(id: string): FeedManifestEntry | undefined {
  if (!isNonEmptyString(id)) {
    return undefined;
  }

  return getCachedFeeds().find((feed) => feed.id === id.trim());
}

export function getFeedsByProvider(provider: string): FeedManifestEntry[] {
  if (!isNonEmptyString(provider)) {
    return [];
  }

  const normalized = provider.trim().toLowerCase();
  return getCachedFeeds().filter((feed) => feed.provider.toLowerCase() === normalized);
}

export function getFeedsByProfile(profile: string): FeedManifestEntry[] {
  if (!isNonEmptyString(profile)) {
    return [];
  }

  const normalized = profile.trim().toLowerCase();
  return getCachedFeeds().filter((feed) => feed.profile.toLowerCase() === normalized);
}
