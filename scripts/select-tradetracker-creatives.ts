import fs from 'node:fs';
import path from 'node:path';
import { TRADETRACKER_CREATIVE_CANONICAL_SITE, TRADETRACKER_SOURCE } from '../lib/tradetracker/promotions/constants';
import { creativeSnapshotFileName } from '../lib/tradetracker/promotions/ingest-creatives';
import {
  selectedCreativeFileName,
  selectTradeTrackerCreatives,
} from '../lib/tradetracker/promotions/select-creatives';
import type { TradeTrackerCredentialMarket } from '../lib/tradetracker/promotions/constants';
import type { TradeTrackerCreativeSnapshot } from '../lib/tradetracker/promotions/types';

/**
 * Build selected creative snapshots from Slice 1 JSON.
 * Does not call SOAP and does not request /c or /i.
 *
 *   npm run select:tradetracker-creatives
 *
 * Reads data/tradetracker-creatives/snapshot-{market}-{site}.json
 * Writes data/tradetracker-creatives/selected-{market}-{site}.json and selected-index.json.
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

function main(): void {
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
    fs.writeFileSync(outPath, JSON.stringify(selected, null, 2), 'utf8');
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
    });
    printSafe(outFile, {
      inputCount: selected.inputCount,
      selectedCount: selected.selectedCount,
      excludedCount: selected.excludedCount,
      providers: selected.providers,
      dedupe: selected.dedupe,
      exclusionReasons,
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

main();
