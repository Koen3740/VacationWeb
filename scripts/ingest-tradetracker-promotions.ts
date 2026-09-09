import fs from 'node:fs';
import path from 'node:path';
import {
  TRADETRACKER_AFFILIATE_WSDL_URL,
  VACATIONWEB_TRADETRACKER_AFFILIATE_SITE_ID,
} from '../lib/tradetracker/promotions/constants';
import { ingestTradeTrackerPromotions, snapshotCounts } from '../lib/tradetracker/promotions/ingest';
import { publicErrorMessage } from '../lib/tradetracker/promotions/errors';

const SNAPSHOT_DIR = path.join(process.cwd(), 'data', 'tradetracker-promotions');
const SNAPSHOT_PATH = path.join(SNAPSHOT_DIR, 'snapshot-vacationweb-512226.json');

function printSafe(label: string, value: unknown): void {
  console.log(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
}

async function main(): Promise<void> {
  const started = Date.now();
  try {
    const snapshot = await ingestTradeTrackerPromotions({
      wsdlUrl: TRADETRACKER_AFFILIATE_WSDL_URL,
      affiliateSiteId: VACATIONWEB_TRADETRACKER_AFFILIATE_SITE_ID,
    });
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2), 'utf8');

    const newsTypes: Record<string, number> = {};
    for (const item of snapshot.newsItems) {
      newsTypes[item.newsType] = (newsTypes[item.newsType] ?? 0) + 1;
    }

    printSafe('status', 'SUCCESS');
    printSafe('wsdl', snapshot.wsdlUrl);
    printSafe('vacationWebAffiliateSiteId', snapshot.scopedAffiliateSiteId);
    printSafe('latencyMs', Date.now() - started);
    printSafe('counts', snapshotCounts(snapshot));
    printSafe(
      'affiliateSites',
      snapshot.affiliateSites.map((site) => ({ id: site.siteId, name: site.name })),
    );
    printSafe('newsTypes', newsTypes);
    printSafe(
      'sampleCampaigns',
      snapshot.campaigns.slice(0, 8).map((campaign) => ({
        id: campaign.campaignId,
        name: campaign.campaignName,
      })),
    );
    printSafe(
      'sampleNews',
      snapshot.newsItems.slice(0, 5).map((item) => ({
        id: item.newsItemId,
        type: item.newsType,
        campaignId: item.campaignId,
        active: item.validity.isActive,
      })),
    );
    printSafe(
      'vouchers',
      snapshot.vouchers.map((item) => ({
        id: item.materialItemId,
        name: item.name,
        campaignId: item.campaignId,
        active: item.validity.isActive,
      })),
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
