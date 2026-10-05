import fs from 'node:fs';
import path from 'node:path';
import { TRADETRACKER_CREATIVE_CANONICAL_SITE, TRADETRACKER_SOURCE, type TradeTrackerCredentialMarket } from '../lib/tradetracker/promotions/constants';
import { creativeSnapshotFileName } from '../lib/tradetracker/promotions/ingest-creatives';
import {
  publishIsolatedCreativeDocument,
  selectedCreativeStorageKey,
} from '../lib/tradetracker/promotions/creative-documents';
import {
  selectedCreativeFileName,
  selectTradeTrackerCreatives,
} from '../lib/tradetracker/promotions/select-creatives';
import type { TradeTrackerCreativeSnapshot } from '../lib/tradetracker/promotions/types';

/**
 * Build selected creative snapshots from Slice 1 JSON.
 * Does not call SOAP and does not request /c or /i.
 *
 *   npm run select:tradetracker-creatives
 *
 * Reads data/tradetracker-creatives/snapshot-{market}-{site}.json
 * Writes data/tradetracker-creatives/selected-{market}-{site}.json and selected-index.json.
 * When OBJECT_STORAGE_* is set, also stores:
 * tradetracker-creatives/selected-nl-512226.json
 * tradetracker-creatives/selected-be-511873.json
 */

const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'tradetracker-creatives');
const MARKETS: TradeTrackerCredentialMarket[] = ['nl', 'be'];

function printSafe(label: string, value: unknown): void {
  console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
}

function readSnapshot(fileName: string): TradeTrackerCreativeSnapshot {
  const filePath = path.join(SNAPSHOT_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing creative snapshot: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TradeTrackerCreativeSnapshot;
}

async function main(): Promise<void> {
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  const written: Array<{
    market: string;
    affiliateSiteId: string;
    file: string;
    sourceSnapshot: string;
    snapshotIngestedAt: string;
    inputCount: number;
    selectedCount: number;
    excludedCount: number;
    providers: Record<string, number>;
    dedupe: { collapsed: number; relations: Record<string, number> };
    exclusionReasons: Record<string, number>;
    objectStorage: 'stored' | 'unavailable';
  }> = [];

  for (const market of MARKETS) {
    const affiliateSiteId = TRADETRACKER_CREATIVE_CANONICAL_SITE[market];
    const sourceFile = creativeSnapshotFileName(market, affiliateSiteId);
    const snapshot = readSnapshot(sourceFile);
    if (snapshot.market !== market || snapshot.scopedAffiliateSiteId !== affiliateSiteId) {
      throw new Error(
        `${sourceFile} is ${snapshot.market}/${snapshot.scopedAffiliateSiteId}, expected ${market}/${affiliateSiteId}`,
      );
    }
    const selected = selectTradeTrackerCreatives(snapshot, { sourceSnapshot: sourceFile });
    const outFile = selectedCreativeFileName(market, affiliateSiteId);
    const outPath = path.join(SNAPSHOT_DIR, outFile);
    const body = JSON.stringify(selected, null, 2);
    fs.writeFileSync(outPath, body, 'utf8');
    const objectStorage = await publishIsolatedCreativeDocument(selectedCreativeStorageKey(market), body);
    const exclusionReasons: Record<string, number> = {};
    for (const item of selected.exclusions) {
      exclusionReasons[item.reason] = (exclusionReasons[item.reason] ?? 0) + 1;
    }
    written.push({
      market,
      affiliateSiteId,
      file: outFile,
      sourceSnapshot: sourceFile,
      snapshotIngestedAt: selected.snapshotIngestedAt,
      inputCount: selected.inputCount,
      selectedCount: selected.selectedCount,
      excludedCount: selected.excludedCount,
      providers: selected.providers,
      dedupe: { collapsed: selected.dedupe.collapsed, relations: selected.dedupe.relations },
      exclusionReasons,
      objectStorage,
    });
    printSafe(outFile, {
      inputCount: selected.inputCount,
      selectedCount: selected.selectedCount,
      excludedCount: selected.excludedCount,
      providers: selected.providers,
      dedupe: selected.dedupe,
      exclusionReasons,
      objectStorage,
    });
  }

  const selectedAt = written.map((item) => item.snapshotIngestedAt).sort().at(-1) ?? null;
  const index = {
    source: TRADETRACKER_SOURCE,
    selectedAt,
    imageDelivery: 'metadata-and-embed-code' as const,
    snapshots: written,
  };
  const indexPath = path.join(SNAPSHOT_DIR, 'selected-index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  printSafe('status', 'SUCCESS');
  printSafe('indexPath', indexPath);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'select creatives failed';
  console.error(message);
  process.exitCode = 1;
});
