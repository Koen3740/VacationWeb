import fs from 'node:fs';
import path from 'node:path';
import { TRADETRACKER_CREATIVE_CANONICAL_SITE } from '../lib/tradetracker/promotions/constants';
import { ingestDisplayableCreativeImages } from '../lib/tradetracker/promotions/creative-images';
import { selectedCreativeFileName } from '../lib/tradetracker/promotions/select-creatives';
import type { TradeTrackerCredentialMarket } from '../lib/tradetracker/promotions/constants';
import type { SelectedTradeTrackerCreativeSnapshot } from '../lib/tradetracker/promotions/types';

/**
 * Fetch impression images for displayable offers and store them in VacationWeb.
 *
 *   npm run ingest:tradetracker-creative-images
 *   npm run ingest:tradetracker-creative-images -- --resync-storage
 *
 * Reads data/tradetracker-creatives/selected-{market}-{site}.json.
 * Does not call SOAP. Requests embed `/i` URLs only, and only for creatives
 * that pass isDisplayableOffer. Never requests `/c`.
 *
 * Storage:
 * - Always local: data/tradetracker-creatives/images/ (gitignored).
 *   The site serves those bytes at /aanbiedingen/creative-images/...
 * - When OBJECT_STORAGE_BUCKET, OBJECT_STORAGE_REGION, OBJECT_STORAGE_ACCESS_KEY_ID
 *   and OBJECT_STORAGE_SECRET_ACCESS_KEY are set, the same object is also written
 *   to tradetracker-creatives/images/... in that bucket. OBJECT_STORAGE_ENDPOINT
 *   is optional (required for R2). This never writes OBJECT_STORAGE_OFFERS_KEY,
 *   catalog generations, current.json, or live-price/v1.
 * - Without those credentials the local file and the VacationWeb path are enough.
 *   --resync-storage uploads an already stored local file without a new /i fetch.
 */

const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'tradetracker-creatives');
const MARKETS: TradeTrackerCredentialMarket[] = ['nl', 'be'];

function printSafe(label: string, value: unknown): void {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (/referral\.corendon|\/i\?|\/c\?|ti\.tradetracker\.net|passphrase|access_key/i.test(text)) {
    throw new Error(`Refusing to print ${label}`);
  }
  console.log(`${label}: ${text}`);
}

function readSelected(market: TradeTrackerCredentialMarket): SelectedTradeTrackerCreativeSnapshot {
  const affiliateSiteId = TRADETRACKER_CREATIVE_CANONICAL_SITE[market];
  const fileName = selectedCreativeFileName(market, affiliateSiteId);
  const filePath = path.join(SNAPSHOT_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing selected creative snapshot: ${fileName}`);
  }
  const snapshot = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SelectedTradeTrackerCreativeSnapshot;
  if (snapshot.market !== market || snapshot.scopedAffiliateSiteId !== affiliateSiteId) {
    throw new Error(`${fileName} is not the canonical ${market} snapshot`);
  }
  return snapshot;
}

async function main(): Promise<void> {
  const snapshots = MARKETS.map((market) => readSelected(market));
  const generatedAt = snapshots.map((snapshot) => snapshot.selectedAt).sort().at(-1) ?? snapshots[0]?.snapshotIngestedAt;
  if (!generatedAt) {
    throw new Error('Selected snapshots have no selectedAt');
  }
  const report = await ingestDisplayableCreativeImages({
    creatives: snapshots.flatMap((snapshot) => snapshot.creatives),
    generatedAt,
    resyncStorage: process.argv.includes('--resync-storage'),
  });
  printSafe('status', report.failed > 0 && report.stored + report.skipped === 0 ? 'FAILED' : 'SUCCESS');
  printSafe('considered', report.considered);
  printSafe('displayable', report.displayable);
  printSafe('excluded', report.excluded);
  printSafe('doubt', report.doubt);
  printSafe('stored', report.stored);
  printSafe('skipped', report.skipped);
  printSafe('failed', report.failed);
  printSafe('storage', report.storage);
  printSafe('failures', report.failures);
  if (report.failed > 0 && report.stored + report.skipped === 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'creative image ingest failed';
  console.error(message);
  process.exitCode = 1;
});
