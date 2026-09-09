import fs from 'node:fs';
import path from 'node:path';
import { TRADETRACKER_AFFILIATE_WSDL_URL } from '../lib/tradetracker/promotions/constants';
import { ingestTradeTrackerPromotions, snapshotCounts } from '../lib/tradetracker/promotions/ingest';
import { publicErrorMessage } from '../lib/tradetracker/promotions/errors';

const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'tradetracker-promotions');
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, 'snapshot.json');

function printSafe(label: string, value: unknown): void {
  console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
}

async function main(): Promise<void> {
  const started = Date.now();
  try {
    const snapshot = await ingestTradeTrackerPromotions({
      wsdlUrl: TRADETRACKER_AFFILIATE_WSDL_URL,
    });
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');

    printSafe('status', 'SUCCESS');
    printSafe('wsdl', snapshot.wsdlUrl);
    printSafe('latencyMs', Date.now() - started);
    printSafe('counts', snapshotCounts(snapshot));
    printSafe(
      'affiliateSiteIds',
      snapshot.affiliateSites.map((site) => site.siteId),
    );
    printSafe(
      'campaignIds',
      snapshot.campaigns.map((campaign) => campaign.campaignId),
    );
    printSafe(
      'newsItemIds',
      snapshot.newsItems.map((item) => item.newsItemId),
    );
    printSafe(
      'methodErrors',
      snapshot.methodErrors.map((item) => ({ method: item.method, message: item.message })),
    );
    printSafe('snapshotPath', SNAPSHOT_PATH);
  } catch (error) {
    printSafe('status', 'FAILURE');
    printSafe('latencyMs', Date.now() - started);
    printSafe('error', publicErrorMessage(error));
    process.exitCode = 1;
  }
}

void main();
