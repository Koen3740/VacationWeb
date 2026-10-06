import fs from 'node:fs';
import path from 'node:path';
import { TRADETRACKER_CREATIVE_CANONICAL_SITE, type TradeTrackerCredentialMarket } from './constants';
import {
  CREATIVE_IMAGE_MANIFEST_STORAGE_KEY,
  publishIsolatedCreativeDocument,
  readIsolatedCreativeDocument,
  selectedCreativeStorageKey,
} from './creative-documents';
import {
  ingestDisplayableCreativeImages,
  loadCreativeImageManifest,
  type CreativeImageManifest,
  type CreativeImageManifestEntry,
} from './creative-images';
import { publicErrorMessage } from './errors';
import { getTradeTrackerSoapCredentials } from './credentials';
import {
  creativeIngestTargets,
  creativeSnapshotFileName,
  ingestTradeTrackerCreatives,
  type CreativeIngestTarget,
} from './ingest-creatives';
import { selectedCreativeFileName, selectTradeTrackerCreatives } from './select-creatives';
import type { SelectedTradeTrackerCreativeSnapshot, TradeTrackerCreativeSnapshot } from './types';

/**
 * One TradeTracker creative refresh.
 *
 * ingest → select → benefit filter (inside image ingest) → own images → publish.
 * Selected snapshots and the image manifest are written only after that market's
 * ingest and selection succeeded. A later failure does not replace the previous
 * object for a market that did not succeed. NL and BE are published apart.
 * Zero displayable creatives is a successful publish.
 *
 * The page never calls this. Campaign news is not part of this chain.
 */

const MARKETS: TradeTrackerCredentialMarket[] = ['nl', 'be'];

export type CreativeRefreshMarketSummary = {
  market: TradeTrackerCredentialMarket;
  affiliateSiteId: string;
  status: 'published' | 'failed';
  inputCount: number;
  selectedCount: number;
  displayableCount: number;
  imageStored: number;
  imageFailed: number;
  storageKey: string | null;
  error: string | null;
};

export type CreativeRefreshSummary = {
  ok: boolean;
  startedAt: string;
  finishedAt: string;
  requireRemote: boolean;
  manifestKey: string | null;
  manifestPublished: boolean;
  publishedKeys: string[];
  markets: CreativeRefreshMarketSummary[];
};

export type CreativeRefreshDependencies = {
  ingestMarket: (target: CreativeIngestTarget) => Promise<TradeTrackerCreativeSnapshot>;
  ingestImages: typeof ingestDisplayableCreativeImages;
  publishDocument: (key: string, body: string) => Promise<'stored' | 'unavailable'>;
  readDocument: (key: string) => Promise<string | null>;
};

type PreparedMarket = {
  market: TradeTrackerCredentialMarket;
  affiliateSiteId: string;
  status: 'ready' | 'failed';
  inputCount: number;
  selectedCount: number;
  displayableCount: number;
  imageStored: number;
  imageFailed: number;
  error: string | null;
  selected: SelectedTradeTrackerCreativeSnapshot | null;
  imageEntries: CreativeImageManifestEntry[];
  remoteStored: boolean;
  storageKey: string | null;
};

function safeError(error: unknown): string {
  return publicErrorMessage(error, 'refresh_failed')
    .replace(/[A-Za-z0-9+/=_-]{24,}/g, '[redacted]')
    .slice(0, 180);
}

function snapshotDir(root: string): string {
  return path.join(root, 'data', 'tradetracker-creatives');
}

function writeJson(filePath: string, body: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body, 'utf8');
}

function parseManifest(raw: string | null): CreativeImageManifest | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as CreativeImageManifest;
    if (!parsed || !Array.isArray(parsed.entries)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function mergeManifest(options: {
  generatedAt: string;
  freshEntries: readonly CreativeImageManifestEntry[];
  previous: CreativeImageManifest | null;
  successfulMarkets: ReadonlySet<TradeTrackerCredentialMarket>;
}): CreativeImageManifest {
  const kept = (options.previous?.entries ?? []).filter((entry) => !options.successfulMarkets.has(entry.market));
  const entries = [...kept, ...options.freshEntries].sort((a, b) => a.publicPath.localeCompare(b.publicPath));
  return {
    source: 'vacationweb-tradetracker-creative-images',
    generatedAt: options.generatedAt,
    storage: options.previous?.storage === 'local+r2' ? 'local+r2' : 'local',
    entries,
  };
}

async function defaultIngestMarket(target: CreativeIngestTarget): Promise<TradeTrackerCreativeSnapshot> {
  const credentials = getTradeTrackerSoapCredentials({ market: target.market });
  return ingestTradeTrackerCreatives({
    market: target.market,
    affiliateSiteId: target.affiliateSiteId,
    campaignIds: target.campaignIds,
    credentials,
  });
}

export async function refreshTradeTrackerCreatives(
  options: {
    root?: string;
    /** Cron sets this. A missing object store then refuses to report success. */
    requireRemote?: boolean;
    includeSecondary?: boolean;
    now?: () => Date;
    deps?: Partial<CreativeRefreshDependencies>;
  } = {},
): Promise<CreativeRefreshSummary> {
  const root = options.root ?? process.cwd();
  const requireRemote = options.requireRemote === true;
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const deps: CreativeRefreshDependencies = {
    ingestMarket: options.deps?.ingestMarket ?? defaultIngestMarket,
    ingestImages: options.deps?.ingestImages ?? ingestDisplayableCreativeImages,
    publishDocument: options.deps?.publishDocument ?? publishIsolatedCreativeDocument,
    readDocument: options.deps?.readDocument ?? readIsolatedCreativeDocument,
  };

  const prepared = new Map<TradeTrackerCredentialMarket, PreparedMarket>();
  for (const market of MARKETS) {
    prepared.set(market, {
      market,
      affiliateSiteId: TRADETRACKER_CREATIVE_CANONICAL_SITE[market],
      status: 'failed',
      inputCount: 0,
      selectedCount: 0,
      displayableCount: 0,
      imageStored: 0,
      imageFailed: 0,
      error: null,
      selected: null,
      imageEntries: [],
      remoteStored: false,
      storageKey: null,
    });
  }

  const targets = creativeIngestTargets(options.includeSecondary === true);
  for (const target of targets) {
    const canonical = target.affiliateSiteId === TRADETRACKER_CREATIVE_CANONICAL_SITE[target.market];
    const row = prepared.get(target.market);
    if (!row) {
      continue;
    }
    try {
      const snapshot = await deps.ingestMarket(target);
      if (snapshot.market !== target.market || snapshot.scopedAffiliateSiteId !== target.affiliateSiteId) {
        throw new Error('creative snapshot market does not match the requested site');
      }
      const rawName = creativeSnapshotFileName(target.market, target.affiliateSiteId);
      writeJson(path.join(snapshotDir(root), rawName), JSON.stringify(snapshot));
      if (!canonical) {
        continue;
      }
      const selected = selectTradeTrackerCreatives(snapshot, { sourceSnapshot: rawName });
      const generatedAt = selected.selectedAt;
      const images = await deps.ingestImages({
        creatives: selected.creatives,
        root,
        generatedAt,
        publishRemote: false,
        writeLocalManifest: false,
        publishDocument: async () => {
          throw new Error('early_manifest_publish');
        },
      });
      row.status = 'ready';
      row.inputCount = selected.inputCount;
      row.selectedCount = selected.selectedCount;
      row.displayableCount = images.displayable;
      row.imageStored = images.stored + images.skipped;
      row.imageFailed = images.failed;
      row.selected = selected;
      row.imageEntries = images.manifest?.entries ?? [];
      row.error = null;
    } catch (error) {
      if (!canonical) {
        continue;
      }
      row.status = 'failed';
      row.selected = null;
      row.imageEntries = [];
      row.error = safeError(error);
    }
  }

  const successful = [...prepared.values()].filter((row) => row.status === 'ready' && row.selected);
  const generatedAt = successful.map((row) => row.selected?.selectedAt ?? '').sort().at(-1) || startedAt;
  const previousLocal = loadCreativeImageManifest(root);
  let previousRemote: CreativeImageManifest | null = null;
  let remoteReadable = true;
  try {
    previousRemote = parseManifest(await deps.readDocument(CREATIVE_IMAGE_MANIFEST_STORAGE_KEY));
  } catch {
    remoteReadable = false;
  }

  const publishable = [...prepared.values()].filter((row) => row.status === 'ready' && row.selected);
  const publishedKeys: string[] = [];
  let manifestPublished = false;
  let remoteFailed = false;

  if (publishable.length > 0 && !remoteFailed) {
    for (const row of publishable) {
      const selected = row.selected;
      if (!selected) {
        continue;
      }
      const key = selectedCreativeStorageKey(row.market);
      const body = JSON.stringify(selected, null, 2);
      const localPath = path.join(snapshotDir(root), selectedCreativeFileName(row.market, row.affiliateSiteId));
      try {
        const stored = await deps.publishDocument(key, body);
        if (stored === 'stored') {
          row.remoteStored = true;
          publishedKeys.push(key);
        } else if (requireRemote) {
          row.status = 'failed';
          row.error = 'object_storage_unavailable';
          remoteFailed = true;
          continue;
        }
        writeJson(localPath, body);
        row.storageKey = key;
      } catch (error) {
        row.status = 'failed';
        row.error = safeError(error);
        remoteFailed = true;
      }
    }
  }

  const stillReady = publishable.filter((row) => row.status === 'ready');
  const shouldPublishManifest =
    stillReady.length > 0 &&
    !remoteFailed &&
    (!requireRemote || stillReady.every((row) => row.remoteStored));

  if (shouldPublishManifest) {
    const freshEntries = stillReady.flatMap((row) => row.imageEntries);
    const marketsToReplace = new Set(stillReady.map((row) => row.market));
    const localManifest = mergeManifest({
      generatedAt,
      freshEntries,
      previous: previousLocal,
      successfulMarkets: marketsToReplace,
    });
    const everyMarketReady = stillReady.length === MARKETS.length;
    const remoteManifest = mergeManifest({
      generatedAt,
      freshEntries,
      previous: everyMarketReady ? null : previousRemote,
      successfulMarkets: marketsToReplace,
    });
    const publishRemoteManifest = remoteReadable || everyMarketReady;
    if (!publishRemoteManifest) {
      if (requireRemote) {
        remoteFailed = true;
      }
    } else {
      try {
        const stored = await deps.publishDocument(
          CREATIVE_IMAGE_MANIFEST_STORAGE_KEY,
          JSON.stringify(remoteManifest),
        );
        if (stored === 'stored') {
          manifestPublished = true;
          publishedKeys.push(CREATIVE_IMAGE_MANIFEST_STORAGE_KEY);
          writeJson(path.join(snapshotDir(root), 'creative-image-manifest.json'), JSON.stringify(localManifest, null, 2));
        } else if (requireRemote) {
          remoteFailed = true;
        } else {
          writeJson(path.join(snapshotDir(root), 'creative-image-manifest.json'), JSON.stringify(localManifest, null, 2));
        }
      } catch (error) {
        remoteFailed = true;
        for (const row of stillReady) {
          if (!row.error) {
            row.error = safeError(error);
          }
        }
      }
    }
  }

  const markets: CreativeRefreshMarketSummary[] = MARKETS.map((market) => {
    const row = prepared.get(market)!;
    const published = row.status === 'ready' && (!requireRemote || row.remoteStored);
    return {
      market,
      affiliateSiteId: row.affiliateSiteId,
      status: published ? 'published' : 'failed',
      inputCount: row.inputCount,
      selectedCount: row.selectedCount,
      displayableCount: row.displayableCount,
      imageStored: row.imageStored,
      imageFailed: row.imageFailed,
      storageKey: published ? row.storageKey : null,
      error: published ? null : row.error,
    };
  });

  const ok = markets.every((market) => market.status === 'published') && (!requireRemote || manifestPublished);

  return {
    ok,
    startedAt,
    finishedAt: now().toISOString(),
    requireRemote,
    manifestKey: manifestPublished ? CREATIVE_IMAGE_MANIFEST_STORAGE_KEY : null,
    manifestPublished,
    publishedKeys,
    markets,
  };
}
